# Auditoría de welevelup.org

**Fecha:** 2026-06-10
**Repo:** `welevelup/welevelup-astro` · Astro `output: server` sobre Vercel Functions
**Auditor:** Claude (sesión asistida por Catalina)
**Alcance:** FASE 1 — Diagnóstico Mollie (crítico) · FASE 2 — Auditoría completa del sitio
**Regla de trabajo:** Diagnóstico → propuesta → (con aprobación) implementación. **No se ha tocado producción ni se ha commiteado nada.**

> Toda la evidencia "EN VIVO" se obtuvo con peticiones de solo-lectura (`curl`, GET/POST sin efectos) contra `https://welevelup.org`. La evidencia de código se obtuvo de `git show origin/main:<archivo>` (lo realmente desplegado en producción) vs `staging`.

---

# FASE 1 — DIAGNÓSTICO MOLLIE (PRIORIDAD CRÍTICA)

## Resumen de causas raíz

| # | Síntoma | Causa raíz confirmada | Tipo de fix |
|---|---------|----------------------|-------------|
| 1 | El pago se cobra pero el usuario **no vuelve al sitio** | `donate/thank-you.astro` en producción tiene un **gate server-side que exige una cookie `paymentId`**. Esa cookie se pierde en el round-trip cross-site de Mollie (sobre todo en navegadores in-app de Meta/IG). Sin cookie → `Astro.redirect('/donate')`. **Existe solo en `main`; `staging` no lo tiene → por eso "staging funciona y prod no".** | Código |
| 2 | Confirmaciones de cobro llegan **horas tarde** | El handler del webhook hace **todo el trabajo pesado (Mollie API + email + GA4 + crear suscripción) con `await` ANTES de responder 200**. Bajo condiciones de prod (cold start + múltiples llamadas secuenciales) supera el timeout de Vercel → Mollie no recibe 200 → **reintenta con backoff durante horas**. | Código |
| 3 | Emails de confirmación llegan **horas tarde** | **Consecuencia directa del #2**: el email se dispara dentro del webhook. Si el webhook entra por reintento horas después, el email sale horas después. | Código (se arregla con #2) |

**Diagnóstico transversal: el drift staging↔producción es bidireccional.** Ninguna rama está "bien" entera:

- **`main` (producción)** tiene: ✅ CSP correcta con dominios Mollie · ❌ gate de cookie que rompe el retorno · ❌ 5 endpoints de debug/test expuestos · ❌ webhook síncrono.
- **`staging`** tiene: ✅ sin gate de cookie · ✅ sin endpoints de debug · ❌ CSP vieja **sin** dominios Mollie · ❌ webhook síncrono (tampoco lo arregló).

> ⚠️ **Por esto un `merge staging → main` (o al revés) es PELIGROSO**: mergear staging a prod **revertiría la CSP** y podría romper la pantalla de pago; mergear main a staging reintroduciría el gate roto. **El fix debe ser quirúrgico, archivo por archivo** (ver plan abajo).

---

## A. Drift entre staging y producción — CONFIRMADO

`origin/main` y `staging` divergieron fuerte. `staging` está **detrás** en commits de fix de Mollie/CSP pero **adelante** en limpieza. Evidencia:

```
git diff origin/main..staging --stat   (resumen)
 api/check-config.ts              |  26 ----   ← staging BORRÓ (bueno)
 api/test-mollie-webhook.ts       |  75 ----   ← staging BORRÓ (bueno)
 api/test-webhook-signature.ts    |  56 ----   ← staging BORRÓ (bueno)
 api/test-webhook-status.ts       |  19 ----   ← staging BORRÓ (bueno)
 api/validate-payment.ts          |  40 ----   ← staging BORRÓ (bueno)
 api/create-donation.ts           |  52 +----  ← staging quitó cookie/token (bueno)
 api/mollie-webhook.ts            |  94 +----  ← staging quitó verif. firma (neutro)
 src/pages/donate/thank-you.astro |  33 +----  ← staging quitó gate server-side (bueno)
 vercel.json                      |   4 +-     ← staging tiene CSP VIEJA sin Mollie (MALO)
```

**Variables de entorno requeridas por el código de producción** (`git grep process.env` sobre `origin/main`), contrastadas con lo que está realmente definido (vía endpoint `/api/check-config` en vivo — ver hallazgo S-1):

| Variable | Requerida por | ¿Definida en prod? |
|----------|--------------|--------------------|
| `MOLLIE_API_KEY` | create-donation, webhook, validate | ✅ `live_uvdBw...` (LIVE, correcto) |
| `MOLLIE_WEBHOOK_URL` | create-donation, webhook | ✅ `https://welevelup.org/api/mollie-webhook?v=2` |
| `MOLLIE_WEBHOOK_SECRET` | webhook, test-* | ✅ `CMSFk33A8x...` (32 chars) |
| `PUBLIC_SITE_URL` | create-donation, sitemap | ✅ `https://welevelup.org` |
| `RESEND_API_KEY` | webhook (email) | ✅ SET |
| `GA4_MEASUREMENT_ID` | webhook (GA4) | ✅ SET |
| `GA4_API_SECRET` | webhook (GA4 server) | ⚠️ **el código lee `GA4_API_SECRET` pero `check-config` solo confirma `GA4_MEASUREMENT_ID`. Verificar que `GA4_API_SECRET` exista**, o el evento server-side de GA4 se omite en silencio (`mollie-webhook.ts` L116-121). |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | middleware, rate-limit, admin | Verificar (no expuestas por check-config) |

> **Nota sobre `?v=2`:** el webhook URL de prod lleva `?v=2`. El handler ignora la query string, así que es inofensivo y la URL es accesible (probado: POST devuelve 400/500 correctamente). **PERO** los endpoints de test (`test-mollie-webhook.ts`, `test-webhook-signature.ts`) hacen fetch a `https://welevelup.org/api/mollie-webhook` **sin** `?v=2` — inconsistencia menor, irrelevante para el fix pero indicio de que `?v=2` se añadió a mano en el dashboard de Mollie para forzar algo.

---

## B. `redirectUrl` — OK en producción (NO es la causa del síntoma 1)

A diferencia de lo que sugería una primera lectura, **producción SÍ construye el redirectUrl completo**:

```ts
// git show origin/main:api/create-donation.ts  (L57-60)
const baseUrl = siteUrl.replace(/\\n/g, '').trim().replace(/\/$/, '');
const donationType = recurring ? 'monthly' : 'one-time';
const redirectUrl = `${baseUrl}/donate/thank-you?amount=${formattedAmount}&type=${donationType}`;
```

`PUBLIC_SITE_URL=https://welevelup.org` (verificado en vivo). El redirectUrl resultante es correcto: `https://welevelup.org/donate/thank-you?amount=10.00&type=one-time`.

**El problema NO es la URL de retorno — es lo que la página de retorno hace al recibir al usuario.** Ver C.

> Bug menor latente: `replace(/\\n/g, '')` busca el literal `\n` (backslash-n), no saltos de línea reales. Si `PUBLIC_SITE_URL` tuviera un newline real no se limpiaría. Hoy no afecta. Fix trivial: `replace(/\s+/g, '')`.

---

## C. Causa raíz del síntoma 1 — Gate de cookie server-side en `thank-you.astro` (PRODUCCIÓN)

**Evidencia de código** (`git show origin/main:src/pages/donate/thank-you.astro`, frontmatter):

```ts
const amount = Astro.url.searchParams.get('amount') || '0';
const amountNum = parseFloat(amount);
if (amountNum <= 0) {
  return Astro.redirect('/donate');           // (1)
}
const cookies = Astro.request.headers.get('cookie') || '';
const hasPaymentCookie = cookies.includes('paymentId=');
if (!hasPaymentCookie) {
  return Astro.redirect('/donate');           // (2)  ← AQUÍ SE PIERDE AL DONANTE
}
```

La cookie se setea en la respuesta del `fetch()` POST a `/api/create-donation`:

```ts
// git show origin/main:api/create-donation.ts
res.setHeader('Set-Cookie', `paymentId=${payment.id}; Path=/; Max-Age=3600; HttpOnly`);
```

**Por qué falla** (la cookie no sobrevive el viaje):

1. La cookie se setea **sin `SameSite` explícito** → el navegador asume `SameSite=Lax`, y **sin `Secure`**.
2. El usuario sale a `pay.mollie.com` (checkout hosteado, redirect top-level) y vuelve a `welevelup.org/donate/thank-you` — una navegación **cross-site**.
3. En Chrome desktop, una cookie Lax **sí** se envía en navegación top-level GET → funciona. **Pero**:
   - En **navegadores in-app (Instagram/Facebook webview)** — que son una fracción enorme del tráfico de una org que corre **Meta Pixel + ads** — el webview frecuentemente **no persiste la cookie** a través del salto externo a Mollie, o reabre en un contexto nuevo al volver. Cookie ausente → redirect (2) → el donante aterriza de vuelta en `/donate` y **cree que el pago falló**.
   - Métodos de pago que abren la app del banco (iDEAL, etc.) pueden volver en un contexto sin la cookie.

**Evidencia EN VIVO** (reproduce exactamente el fallo del donante sin cookie):

```
$ curl -s -o /dev/null -w "%{http_code} -> %{redirect_url}" \
    "https://welevelup.org/donate/thank-you?amount=10.00&type=one-time"
302 -> https://welevelup.org/donate          ← rebote, aun con query params válidos
```

**Confirmación del drift:** `staging` **no tiene** este gate (`git show staging:src/pages/donate/thank-you.astro` → sin `Astro.redirect`, sin `paymentId`, sin `cookie`). Por eso **"en staging funciona y en prod no"**. El gate se añadió a `main` como medida "anti-acceso-directo" (commits `cd23d83 security: prevent direct access to thank-you page`, `43a364a server-side payment validation using cookies`) y rompió el caso real.

**Manejo de estados de pago (`paid`/`pending`/`failed`/`canceled`/`expired`):** la página de retorno **no consulta el estado real del pago**. Solo mira `amount > 0` + cookie y muestra "Donation received". Existe `/api/validate-payment` (GET, devuelve estado real por `paymentId`) pero **la página no lo usa**. Resultado: un pago `failed`/`canceled` que vuelve con la cookie mostraría igualmente "gracias". Para una org de donaciones esto es un fallo de UX/confianza, aunque secundario al rebote.

---

## D. Causas raíz de síntomas 2 y 3 — Webhook hace trabajo pesado antes de responder 200

**Evidencia de código** (`git show origin/main:api/mollie-webhook.ts`, handler):

```ts
const payment = await mollie.payments.get(paymentId);     // llamada Mollie #1
...
if (shouldEmail && meta) {
  await sendDonationConfirmation({ ... });                 // Resend, AWAIT (bloquea)
}
await sendGA4Event({ ... });                               // fetch a GA4, AWAIT
...
// solo para recurring first:
const existing = await mollie.customerSubscriptions.page({ customerId });  // Mollie #2
const subscription = await mollie.customerSubscriptions.create({ ... });   // Mollie #3
return res.status(200).send('OK');                         // 200 recién AQUÍ
```

El 200 OK se emite **al final**, después de 1–3 llamadas a la API de Mollie + Resend + GA4, **todas secuenciales con `await`**.

**Por qué produce el patrón "horas tarde":**

- Mollie espera un **200 rápido** (timeout corto). Si no llega 200, **reintenta con backoff exponencial durante ~24-48h**.
- En Vercel, una Function con cold start + `payments.get` + Resend (red) + GA4 (red) + (recurring) 2 llamadas más a Mollie puede acercarse o superar el **límite de ejecución** (10s en Hobby; configurable en Pro). Si Vercel mata la función o Resend tarda, Mollie ve un no-200/timeout.
- Mollie reintenta más tarde; cuando un reintento cae en una ventana caliente/rápida, **ahí** se procesa → email y registro **horas después**. **Es el patrón EXACTO descrito.**

**Evidencia EN VIVO de latencia base** (sin trabajo de email real, solo verificación):
```
POST /api/mollie-webhook?v=2  id=tr_xxxxxxxxxx  → HTTP 500 en 0.77s
```
Ya con un `id` inexistente (un solo `payments.get` fallido) tarda ~0.8s. Con un pago real `paid` + email + GA4 + (recurring) 2 llamadas más, el tiempo se multiplica.

**Idempotencia (riesgo de duplicados):** si Mollie reintenta un evento `paid` que en el primer intento **alcanzó a enviar el email** antes de morir, el reintento **vuelve a enviar el email** — no hay deduplicación por `paymentId`. Para suscripciones sí hay guard anti-duplicado (`customerSubscriptions.page` + check `active/pending`), pero **para emails no**. Posibles **emails de gracias duplicados**.

**Accesibilidad del endpoint:** ✅ correcta. El middleware (`src/middleware.ts` L8) excluye `/api/*` de la auth; el webhook acepta POST público y responde 400/500 sin auth. No hay WAF/CSRF bloqueando. La CSP no aplica a llamadas server-to-server. Mollie puede llegar.

---

## E. API keys test vs live — CORRECTO (pero expuesto, ver Fase 2)

Verificado en vivo vía `/api/check-config`:
```json
"mollie": { "apiKey": "live_uvdBw...", "isLive": true, "keyType": "🔴 LIVE" }
```
Producción usa `live_`. Correcto. **No se cruzaron las keys.** (El problema es que este dato es público — ver S-1 en Fase 2).

---

## F. Emails — dependen 100% del webhook

`sendDonationConfirmation` solo se invoca dentro de `mollie-webhook.ts`. No hay cola ni reintento propio. Por tanto **el retraso de emails es síntoma del problema D y se corrige con D**. No hay un segundo problema de proveedor de email; Resend está configurado (`RESEND_API_KEY` ✅). El remitente es `no-reply@welevelup.org` (requiere dominio verificado en Resend — asumir OK porque algunos emails sí llegan).

---

## PLAN DE FIX — FASE 1

### (a) Cambios de CÓDIGO a mergear (quirúrgico, NO merge de rama completa)

Propuesta: crear rama `fix/mollie-production` desde **`main`** (para conservar la CSP buena) y aplicar:

1. **Eliminar el gate de cookie del retorno** — tomar la versión de `staging` de:
   - `src/pages/donate/thank-you.astro` (quita `Astro.redirect('/donate')` por cookie ausente).
   - `api/create-donation.ts` (quita `Set-Cookie`/token; deja el JSON `{ checkoutUrl }`).
   - *Refuerzo opcional recomendado:* en vez de simplemente quitar el gate, **validar el estado real** llamando a `/api/validate-payment?paymentId=...` desde el cliente y mostrar estado correcto para `paid/pending/failed`. Pero el fix mínimo y seguro es quitar el gate (como staging).

2. **Webhook: responder 200 ANTES del trabajo pesado.** Reordenar `api/mollie-webhook.ts`:
   ```ts
   // Validar firma/secret y status, luego:
   if (status !== 'paid') return res.status(200).send('OK');
   res.status(200).send('OK');              // ← responder YA
   // …y a partir de aquí hacer email/GA4/suscripción sin bloquear el ACK
   ```
   En Vercel Functions lo robusto es responder 200 y **procesar en el mismo invoke tras el `res.end`** envolviendo el trabajo en try/catch (o migrar a una cola/`waitUntil`). Mínimo viable: emitir 200 y `await` el resto en background con `.catch` para que un fallo de email no genere 500 → no más reintentos por timeout.

3. **Idempotencia de email:** registrar `paymentId` ya procesado (Upstash Redis ya está disponible: `SETNX webhook:emailed:<paymentId>` con TTL) y saltar si ya se envió. Evita duplicados en reintentos.

4. **Eliminar endpoints de debug/test** (también es hallazgo de seguridad S-1/S-2): borrar `api/check-config.ts`, `api/test-mollie-webhook.ts`, `api/test-webhook-signature.ts`, `api/test-webhook-status.ts`, `api/validate-payment.ts` **o** protegerlos. `staging` ya los borró; replicar esa eliminación en el fix.

5. **(Menor) Regex de URL:** `replace(/\\n/g,'')` → `replace(/\s+/g,'')` en `create-donation.ts`.

> **CSP: NO tocar.** Mantener la de `main` (tiene los dominios Mollie). No traer la de staging.

### (b) Cambios de CONFIGURACIÓN en servidor / Vercel

- **Verificar `GA4_API_SECRET`** existe en el entorno de producción de Vercel (el código lo usa pero `check-config` no lo confirma). Sin él, el GA4 server-side se omite silenciosamente.
- **Confirmar `MOLLIE_WEBHOOK_SECRET`** está en prod (sí, vía check-config) y decidir si se mantiene la verificación de firma (hoy es "best effort": si falla, igual procesa — ver `verifyMollieSignature`).
- **Timeout de la Function del webhook:** si se queda en plan que limita a 10s, subir `maxDuration` del webhook en `vercel.json`/config de la función, como red de seguridad mientras se hace el procesamiento async.
- No hace falta cambiar `PUBLIC_SITE_URL` ni `MOLLIE_API_KEY` (correctos).

### (c) Cambios en el DASHBOARD de Mollie

- **Ninguno imprescindible.** El webhook URL (`…/api/mollie-webhook?v=2`) y la key `live_` son correctos. Los reintentos atascados actuales se irán drenando solos una vez el webhook responda 200 rápido.
- *Opcional:* revisar en Mollie → Developers → Webhooks el historial de entregas para confirmar los reintentos (verás muchos no-200 seguidos de un 200 tardío — la huella del problema D).

### Checklist de verificación POST-FIX

- [ ] **Pago real de bajo importe (£1)** desde un **navegador in-app de Instagram/Facebook** (no solo Chrome desktop) → al pagar, **vuelve a `/donate/thank-you` y se queda ahí** (no rebota a `/donate`).
- [ ] Repetir el pago en Chrome desktop y en Safari iOS.
- [ ] En Mollie → Webhooks, la entrega del pago muestra **200 en < 1s** (no reintentos).
- [ ] **Email de confirmación llega en segundos / < 1 min**, no horas.
- [ ] Hacer **una donación recurrente (£1/mes)**: se crea la suscripción, llega email, y un reintento manual del webhook **no duplica** el email (idempotencia).
- [ ] GA4: en el reporte en tiempo real aparece el evento `purchase` (cliente y/o server-side).
- [ ] `curl https://welevelup.org/api/check-config` → **404** (endpoint eliminado).
- [ ] Pago `canceled`/`expired` de prueba → la página de retorno **no** afirma "Donation received" falsamente (si se implementa el refuerzo de estado).

---

# FASE 2 — AUDITORÍA COMPLETA DEL SITIO

> Auditoría completa hecha en vivo (`curl` solo-lectura contra producción) + análisis de código y de `public/`/`dist/`. Fecha: 2026-06-10.

## ✅ YA RESUELTO (desplegado en Fase 1 — PR #81)

| ID | Hallazgo | Estado |
|----|----------|--------|
| S-1 | `/api/check-config` filtraba prefijo de API key LIVE + webhook secret | ✅ Eliminado — `curl` da **404** |
| S-2 | `test-mollie-webhook` / `test-webhook-signature` / `test-webhook-status` permitían forjar webhooks firmados | ✅ Eliminados — **404** |
| S-4 | `validate-payment` enumeraba estado de pagos sin rate limit | ✅ Eliminado — **404** |

## ✅ LO QUE ESTÁ BIEN (sin acción)

- **Headers de seguridad:** todos presentes y fuertes — `HSTS max-age=31536000; preload`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`, CSP con `frame-ancestors 'none'` y `object-src 'none'`. Sin fuga de `X-Powered-By`.
- **Accesibilidad (base sólida):** `<html lang="en-GB">`, **un solo `<h1>`** por página, **todas las imágenes con `alt`** (homepage 10/10), landmark `<main id="main-content">`, formulario de donación con **11 inputs / 11 labels**, `fieldset/legend`, radios accesibles con `:focus-within` visible. Contraste lima `#CCFF33` sobre navy `#0C0A3E` = alto (correcto).
- **Sin secretos hardcodeados** en `src/`/`api/` y **ninguna `import.meta.env` no-`PUBLIC_`** expuesta al cliente.
- **`robots.txt`** sensato; **sitemap** (41 URLs) **no** filtra staging, `thank-you`, `donor-portal` ni proposals; `/404` devuelve **404 real** (no soft-404).

## ALTO

### MIG-1 · Dumps de WordPress servidos en producción (`public/wp-*`)
**EN VIVO:** `https://welevelup.org/wp-json` devuelve **JSON real estilo WP REST API**: `{"name":"We Level Up",...,"namespaces":["give-api/...","oembed/1.0"],"page_on_front":1818}`. Origen: carpetas estáticas copiadas en la migración:
```
public/wp-content   → 91 MB   (imágenes WP, ver PERF-1)
public/wp-json      → 3.7 MB  (respuestas cacheadas de la REST API de WP)
public/wp-includes  → 340 KB  (jQuery, jquery-migrate, dashicons, datepicker, hoverIntent — puro cruft)
```
**Por qué importa:** (1) `wp-json`/`wp-includes` **identifican el sitio como WordPress** → atraen bots y escáneres que prueban exploits de WP/plugins; (2) `wp-json` **filtra IDs internos viejos** (`page_on_front:1818`); (3) son 100% inútiles en un sitio Astro. **Fix:** eliminar `public/wp-includes/` y `public/wp-json/` por completo; mantener solo las imágenes de `public/wp-content/uploads/` que se usan (ver MIG-2). **Severidad: ALTA.**

### MIG-2 · OG image de la página de donación está rota (404)
**EN VIVO:** `donate.astro:15` declara `ogImage="/wp-content/uploads/2023/05/Level-Up-OG.png"` → **404**. La **página de donación — la que genera ingresos —** no muestra imagen al compartirse en Facebook/WhatsApp/Twitter. Otras OG sí cargan (NML11-2.webp, we-protect-us-2.webp → 200), así que es **inconsistente**: las imágenes referenciadas pero no copiadas a `public/wp-content/uploads/` dan 404. **Fix:** crear/copiar `Level-Up-OG.png` (o apuntar a una OG existente en `public/images/`), y auditar las ~13 `ogImage=` de `src/pages/` para confirmar que todas resuelven 200. **Severidad: ALTA (conversión/redes).**

### SEO-1 · `staging.welevelup.org` es totalmente indexable
**EN VIVO:** `staging.welevelup.org/robots.txt` = `Allow: /`, **sin `noindex`**, y su `Sitemap:` apunta a `https://welevelup.org/...`. Riesgo de **contenido duplicado** en Google. **Fix:** servir `X-Robots-Tag: noindex` en staging (header en su `vercel.json`/deployment) o protegerlo con auth. **Severidad: ALTA (SEO).** *(Nota: la rama git `staging` fue borrada del remoto; staging.welevelup.org corre un deployment de Vercel separado — revisar su config ahí.)*

### DEP-1 · `npm audit`: 5 high + 4 moderate
```
high     tar              (path traversal)          → vía @mapbox/node-pre-gyp
high     path-to-regexp   (ReDoS)                   → vía @vercel/routing-utils → @astrojs/vercel
high     @astrojs/vercel / @vercel/routing-utils
moderate esbuild (dev server SSRF — solo dev), ajv, @vercel/node, @vercel/static-config
```
**Transitivas del toolchain de build** (`@vercel/*`, `esbuild` solo dev). Riesgo en runtime de prod **bajo**. **Fix:** `npm audit fix`; si pide major, probar `@astrojs/vercel` última en rama + verificar build. **Severidad: ALTA (mayormente build-time).**

## MEDIO

### PERF-1 · `public/wp-content` = 91 MB → `dist/client` = 102 MB
Las imágenes heredadas de WP se sirven tal cual: variantes múltiples (`-scaled`, `-768x511`, `-300x200`), PNGs grandes (capturas de pantalla), sin pipeline de optimización. **Impacto:** deploy pesado y LCP alto en páginas con estas imágenes. **Fix:** pasar imágenes clave por `astro:assets` (`<Image>` con `srcset`/AVIF/WebP) o, mínimo, comprimir y purgar las no usadas. Cruzar las referencias reales (`grep wp-content src/`) contra `public/wp-content/uploads/` y **borrar las huérfanas**. **Severidad: MEDIA.**

### SEO-2 · URLs viejas de WP dan 404 en vez de 301 (pérdida de link equity)
**EN VIVO** (destino final siguiendo redirects):
```
/feed                 → 404      (RSS viejo — probable tráfico/suscriptores)
/comments/feed        → 404
/2024/05/<post>       → 404      (permalinks con fecha — patrón WP común)
/wp-content/uploads/2023/05/Level-Up-OG.png → 404
/?p=123  /?page_id=42 → 200      (sirven la HOME → soft-duplicado, no 301)
```
`vercel.json` ya cubre **muchísimas** URLs (`/category/*`, `/tag/*`, `/author/*`, slugs viejos…), pero faltan: `/feed`, archivos por fecha, y los `?p=`/`?page_id=` que deberían 301 a su destino o devolver 410. **Acción recomendada:** exportar de **Google Search Console** las URLs indexadas con impresiones que hoy dan 404 y añadir 301 puntuales. **Severidad: MEDIA.**

### FORM-1 · Rate limit del formulario de contacto es inefectivo en serverless
`api/contact.ts:4-16` usa un `Map` en memoria para rate limiting. En Vercel cada invocación puede caer en una **instancia distinta** (o cold start), así que el contador no persiste → el límite de 5/15min **no se aplica de forma fiable**. Ya existe `src/lib/ratelimit.ts` (Upstash Redis) usado en otros sitios. **Fix:** reemplazar el `Map` por `isRateLimited()` de Upstash. **Severidad: MEDIA.** *(Validación de input y Turnstile opcional están OK; riesgo de inyección en email bajo — es texto plano a su propio buzón.)*

### SEC-1 · CSP con `'unsafe-inline'` + `'unsafe-eval'`
`script-src` incluye ambos (necesario por scripts inline de Astro + Mollie). Debilita la protección anti-XSS. **Fix (largo plazo):** migrar a CSP con **nonce** por request. **Severidad: MEDIA.**

## BAJO

- **MIG-3:** `src/_clone/` = 13 MB de HTML crudo de WP en el repo. **No** se envía a `dist/client` (solo se inlinea en SSR vía `?raw`), pero infla el repo y el bundle del servidor. Evaluar reducir.
- **SEO-3:** algunos paths inexistentes hacen `302` antes del `404` (un salto extra). Menor.
- **MIG-4:** `wp-json` filtra IDs internos viejos (cosmético; se elimina con MIG-1).

## PLAN DE IMPLEMENTACIÓN PRIORIZADO (Fase 2)

**Tanda A — Rápida y de alto impacto (1 PR, bajo riesgo):**
1. Arreglar OG image de `donate.astro` (MIG-2) + auditar las ~13 `ogImage=`.
2. Borrar `public/wp-includes/` y `public/wp-json/` (MIG-1).
3. `noindex` en staging (SEO-1).

**Tanda B — Limpieza WP + perf (1 PR, riesgo medio, requiere verificar imágenes usadas):**
4. Purgar imágenes huérfanas de `public/wp-content/uploads/` y optimizar las usadas (PERF-1).
5. Añadir 301/410 para `/feed`, archivos por fecha y `?p=` según Search Console (SEO-2).

**Tanda C — Hardening (1 PR):**
6. Rate limit de contacto vía Upstash (FORM-1).
7. `npm audit fix` + bump `@astrojs/vercel` (DEP-1).
8. (Opcional, largo plazo) CSP con nonce (SEC-1).

---

## ESTADO Y SIGUIENTES PASOS

**Fase 1: diagnóstico cerrado + FIX IMPLEMENTADO (reforzado) en la rama `fix/mollie-production` (creada desde `main`).** Build ✅ y typecheck ✅ pasando. **No se ha hecho push ni desplegado nada — pendiente de tu aprobación.**

### Cambios aplicados (commit local en `fix/mollie-production`)

| Archivo | Cambio |
|---------|--------|
| `api/create-donation.ts` | Quita la cookie `paymentId`/tokens. Genera `ref` opaco, lo mapea a `paymentId` en Redis (TTL 1h), y lo pasa en `redirectUrl`. Regex de URL corregida. Logs sin fugas. |
| `src/pages/donate/thank-you.astro` | **Refuerzo:** quita el gate de cookie; resuelve `ref`→`paymentId`→estado real vía Mollie API. Renderiza `paid`/`pending`/`failed`/`unknown`. Dispara analytics **solo** en `paid`. Degrada con elegancia si Redis/Mollie falla (nunca rebota al donante). |
| `api/mollie-webhook.ts` | **Responde 200 al instante**; procesa email/GA4/suscripción en background con `waitUntil`. Idempotencia de email vía Redis `SETNX` (sin duplicados). No 500 por fallo de email. `maxDuration: 30s`. Acepta `GA4_API_SECRET` **o** `GA4_MEASUREMENT_PROTOCOL_SECRET`. |
| `api/check-config.ts` · `test-mollie-webhook.ts` · `test-webhook-signature.ts` · `test-webhook-status.ts` · `validate-payment.ts` | **Eliminados** (S-1, S-2, S-4: filtraban secretos / permitían forjar webhooks). |
| `src/lib/mollie-helper.ts` | Eliminado (huérfano, sin usos). |
| `package.json` | `+ @vercel/functions` (para `waitUntil`). |

> ⚠️ **CSP intacta:** se conservó la de `main` (con dominios Mollie). No se trajo la de staging.

### Pendiente de TI (config de servidor, no código)

- **Vercel → Production env:** confirmar que **`GA4_API_SECRET`** existe (o renombrar a lo que esté). El código ahora acepta ambos nombres, pero verifica que al menos uno esté.
- **Vercel:** confirmar que el plan permite `maxDuration: 30` en la función del webhook (Hobby suele permitir 60s; si no, Vercel lo capa sin romper).
- **Mollie → Developers → Webhooks:** opcional, solo para corroborar el patrón de reintentos no-200 → 200 tardío.

### Pendiente de TU aprobación

1. **Push de `fix/mollie-production` + PR → `staging`** para validar en `staging.welevelup.org` antes de prod.
2. Tras verificar en staging con el checklist de abajo → **PR `staging` → `main`** (prod).

> Recomendación de timing: desplegar el fix un día de bajo tráfico de donaciones y monitorear las primeras transacciones en los logs de Vercel + dashboard de Mollie.

---

## FASE 2 — IMPLEMENTACIÓN (rama `fix/phase2-cleanup`)

Build ✅ y typecheck ✅ pasando. Alcance decidido por **evidencia** (no romper páginas en producción).

### ✅ Hecho en esta tanda

| ID | Cambio | Archivos |
|----|--------|----------|
| MIG-2 | **OG image branded generada** (1200×630, navy+lima) y conectada como default. Antes el default y `/donate` apuntaban a un PNG 404 → sharing roto en TODO el sitio. | `scripts/generate-og.mjs`, `public/images/og-default.jpg`, `src/layouts/Layout.astro`, `src/pages/donate.astro` |
| MIG-1 | **`public/wp-json/` eliminado** (127 archivos, 3.7MB). Quita el fingerprint de WP-REST-API y la fuga de IDs internos. | `public/wp-json/**` |
| SEO-1 | **`noindex` para hosts no-producción** (staging, *.vercel.app) vía `X-Robots-Tag` en middleware. | `src/middleware.ts` |
| SEO-2 | **301 para URLs WP viejas:** `/feed`, `/comments/feed`, archivos por fecha `/AAAA/MM/*` → `/blog`. | `vercel.json` |
| FORM-1 | **Rate limit de contacto migrado a Upstash Redis** (el `Map` en memoria no funciona en serverless). | `api/contact.ts` |

### ⏸️ Deferido CONSCIENTEMENTE (con razón, no por olvido)

| ID | Por qué NO se hizo aquí | Recomendación |
|----|--------------------------|---------------|
| MIG-1 (`wp-includes/`) | **jQuery se invoca en 11 páginas clonadas** (incl. home). Borrarlo las rompería. | Migrar esas páginas fuera del clon WP, luego borrar. |
| PERF-1 (91MB imágenes) | **No hay imágenes huérfanas** (solo 2, ~0MB). Las 184 están en uso; solo 7 superan 1920px (3MB). Recomprimir 184 a ciegas degrada calidad sin diff revisable. | Migrar a `astro:assets <Image>` (srcset/AVIF) por página, con revisión visual. PR dedicado. |
| DEP-1 (`npm audit`) | `npm audit fix` sin `--force` **no arregla nada** (los high requieren majors de `@astrojs/vercel` que pueden romper el build). El advisory de `ws` viene de `@vercel/functions` pero **no es alcanzable** en el path del webhook (no abre WebSockets). | PR dedicado: subir `@astrojs/vercel` y verificar build. |
| SEC-1 (CSP nonce) | Migrar de `unsafe-inline`/`unsafe-eval` a nonce requiere tocar cada script inline (Astro + Mollie + GA + Pixel). Grande y arriesgado. | Esfuerzo separado, con pruebas de que nada se rompe. |

### Pendiente de TI (operativo, fuera del código)
- **SEO-1 staging:** `staging.welevelup.org` corre un deployment Vercel separado (la rama git `staging` fue borrada). El `noindex` por host aplicará cuando ese deployment corra este código; si el entorno staging ya no se usa, **considera eliminar el dominio/deployment** en Vercel.
