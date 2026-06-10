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

> Recon inicial hecho en vivo + análisis de código. Esta fase se profundiza tras estabilizar Mollie, pero los hallazgos críticos de seguridad de abajo **deberían entrar junto con el fix de Fase 1** porque comparten archivos.

## CRÍTICO

### S-1 · Endpoint público filtra secretos de pago — `/api/check-config`
**EN VIVO:** `https://welevelup.org/api/check-config` responde **sin auth**:
```json
{"mollie":{"apiKey":"live_uvdBw...","isLive":true},
 "webhook":{"secret":"CMSFk33A8x... (32 chars)"},
 "env":{"PUBLIC_SITE_URL":"https://welevelup.org","RESEND_API_KEY":"✅ SET"}}
```
Expone el **prefijo de la API key LIVE de Mollie**, el **prefijo y longitud del webhook secret**, y el inventario de variables presentes. Es reconocimiento directo para un atacante. **Archivo:** `api/check-config.ts`. **Fix:** eliminar (staging ya lo borró). **Severidad: CRÍTICA.**

### S-2 · Endpoints de test que reenvían webhooks firmados al handler real
`/api/test-mollie-webhook` y `/api/test-webhook-signature` (**públicos, POST**) generan una **firma HMAC válida** con el secret del servidor y la **POSTean al webhook real** con un `paymentId` arbitrario. **EN VIVO:** `/api/test-webhook-status` confirma estar activo y filtra `secret_prefix`. Permiten a un anónimo **forzar ejecuciones del webhook** (emails, eventos GA4, lógica de suscripción) y enumerar el comportamiento de verificación. **Archivos:** `api/test-mollie-webhook.ts`, `api/test-webhook-signature.ts`, `api/test-webhook-status.ts`. **Fix:** eliminar (staging ya). **Severidad: CRÍTICA.**

## ALTO

### S-3 · `npm audit`: 5 high + 4 moderate
```
high     tar              (path traversal / arbitrary file write)  → vía @mapbox/node-pre-gyp
high     path-to-regexp   (ReDoS backtracking)                     → vía @vercel/routing-utils → @astrojs/vercel
high     @astrojs/vercel / @vercel/routing-utils
moderate esbuild          (dev server SSRF — solo dev)
moderate ajv (ReDoS), @vercel/node, @vercel/static-config
```
La mayoría son **transitivas del toolchain de build** (`@vercel/*`, `esbuild` solo afecta al dev server). Riesgo en producción **bajo-medio**, pero conviene `npm audit fix` y subir `@astrojs/vercel` a una versión parcheada. **Plan:** `npm audit fix`; si requiere mayor, probar `@astrojs/vercel` última en una rama y verificar build. **Severidad: ALTA (mayormente build-time).**

### S-4 · `validate-payment` sin rate limiting expone estado de pagos
`/api/validate-payment?paymentId=tr_...` (GET público) devuelve estado/monto de cualquier `paymentId`. Sin rate limit permite enumeración. Hoy la página ni lo usa. **Fix:** eliminar (staging ya) o añadir rate limit + no usarlo sin la cookie/token del propio pago. **Severidad: ALTA.**

### SEO-1 · `staging.welevelup.org` es totalmente indexable
**EN VIVO:** `staging.welevelup.org/robots.txt` = `Allow: /`, **sin `noindex`**, y su `Sitemap:` apunta a `https://welevelup.org/...`. Riesgo de **contenido duplicado** y de que Google indexe el entorno de pruebas. **Fix:** en staging, servir `X-Robots-Tag: noindex` (o `robots.txt` con `Disallow: /`) y/o proteger con auth básica. **Severidad: ALTA (SEO).**

## MEDIO

- **SEC-headers:** la mayoría están y bien (`HSTS preload`, `X-Frame-Options: DENY`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `frame-ancestors 'none'`). **Observación:** la CSP de prod incluye `'unsafe-inline'` **y** `'unsafe-eval'` en `script-src` (necesario por scripts inline de Astro, pero debilita XSS-hardening). Plan a futuro: mover a CSP con nonce. **Severidad: MEDIA.**
- **SEO-2 · Redirects WP→Astro:** `vercel.json` tiene una tabla **extensa y buena** de 301 desde URLs WordPress (`/category/*`, `/tag/*`, `/author/*`, `/wp-admin*`, slugs viejos…). Falta verificar contra el **sitemap viejo de WP** las URLs con tráfico real que aún den 404. **Pendiente Fase 2:** crawl de 404s con datos de Search Console. **Severidad: MEDIA.**
- **MIG-1 · Restos WordPress:** referencias a rutas `/wp-content/uploads/...` siguen usándose como assets (p.ej. `ogImage` en `donate.astro`). Verificar que existan en `public/` y no apunten al WP viejo. **Pendiente:** grep en `dist/` tras build + revisar imágenes huérfanas. **Severidad: MEDIA.**

## BAJO / PENDIENTE DE PROFUNDIZAR (Fase 2 completa)

- **A11y** del flujo de donación: el formulario usa `fieldset/legend`, inputs con `label`, radios accesibles con focus visible — buena base. Falta auditar contraste (`#CCFF33` sobre `#0C0A3E`), `aria-live` en errores, y navegación por teclado completa en el retorno.
- **Rendimiento:** Astro `output: server` con `cssMinify: false` (desactivado a propósito por corrupción de esbuild — commit `8c7e45b`). Revisar si se puede re-activar con la versión parcheada de esbuild. Auditar imágenes (srcset/lazy) heredadas de WP y `font-display`.
- **Sitemap:** `/sitemap-index.xml` existe y filtra páginas transaccionales/proposals correctamente (`astro.config.mjs`). Validar que no liste URLs rotas.
- **Formularios:** `contact.ts` usa Turnstile (opcional) + rate limit Upstash. Validar sanitización server-side.

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
