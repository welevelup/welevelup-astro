# Level Up — Estrategia de captación de donantes

**Fecha:** 2026-06-11 · Basado en datos reales (audiencia, Mollie/GoCardless/PayPal, GA4, Search Console)
**Para:** equipo de Level Up · **Objetivo:** crecer la lista de contactos + las donaciones mensuales

---

## TL;DR — la foto en una frase

Has construido un **movimiento de 22.636 personas** que se sumaron por una causa, pero solo una **fracción mínima** dona mensualmente. Tu mayor palanca de crecimiento **no es más publicidad** — es **convertir la lista caliente que ya tienes**, mientras los Facebook ads la siguen alimentando por arriba. Y tu web ya convierte de maravilla: el cuello de botella es **llevar gente a pedir la donación**, no la donación en sí.

---

## 1. Tu audiencia (lo que tienes)

**22.636 personas, 2.317 distritos postales del UK, 99,8% geolocalizadas.** Por campaña que las trajo:

| Campaña de entrada | Personas | % | Lectura |
|---|---|---|---|
| **Dignity for Dead Women** (media) | 7.518 | 33% | Tu mayor imán de contactos |
| **Pregnancy in Prison** | 5.718 | 25% | Segundo motor |
| **No More Lyes** (relaxers) | 3.561 | 16% | Tema con búsqueda viral (salud) |
| **Football** (violencia sexual) | 2.768 | 12% | Gancho mediático fuerte |
| **Abortion is Healthcare** | 2.150 | 9% | Causa grande, competida |
| Dignity 2 | 899 | 4% | |
| Join us (directo) | 76 | 0,3% | Casi nadie llega "en frío" |

**Concentración geográfica (oro para tácticas locales):** Brighton (**BN1, BN2**) y East London (**E17** Walthamstow, **N16** Stoke Newington, **E5** Clapton). Son bastiones progresistas/feministas clásicos del UK — densos, jóvenes, afines.

**Insight #1:** tu motor de captación son las **peticiones** ligadas a momentos noticiosos. Dignity (7.518) y PIP (5.718) lo prueban. "Join us" en frío trae 76. **La gente no llega a donar de la nada — llega por una causa concreta y urgente.**

---

## 2. Los números que importan (y la oportunidad)

**Donaciones 2026:** 808 donaciones, £5.418. Pasarelas: PayPal 307 · Mollie 298 · GoCardless 203.

**Web (28 días):** 668 visitantes · 807 sesiones · **conversión 5,33%**.

**El funnel (revelador):**
```
807 sesiones  →  59 ven /donate (7,3%)  →  43 donan (¡73% de quien la ve!)
```

**Insight #2 — tu web NO tiene un problema de conversión, tiene un problema de "consideración".** El 73% de quien llega a `/donate` dona. Brutal. Solo hay que **llevar más gente a esa página** (con emails, peticiones y prompts en el sitio).

**Donaciones por canal (28d):**
| Canal | Donaciones | £ |
|---|---|---|
| **Unassigned** | 17 | **£305** |
| Referral | 14 | £14 |
| Organic Search | 7 | £7 |
| Direct | 5 | £5 |

**Insight #3 — "Unassigned" (£305, el que más recauda) es casi seguro tu propio email/peticiones** (enlaces sin etiqueta UTM, así que Google no ve de dónde vienen). Traducción: **tu lista ya es tu canal #1 de donaciones**, solo que está "ciego" por falta de etiquetas. Esto valida toda la estrategia: **el dinero está en tu gente.**

**La brecha = la oportunidad:** 22.636 contactos vs unos pocos cientos de donantes. Cálculo ilustrativo:
> Convertir solo el **2%** de 22.636 a **£4/mes** = **~450 donantes nuevos** = **~£21.600/año** de ingreso recurrente nuevo. A coste casi cero (es tu lista). Eso multiplica varias veces tu recurrente actual.

---

## 3. ESTRATEGIA 1 — Convertir los 22.636 que YA tienes (máximo ROI)

Esto es lo primero porque es lo más barato y lo más rentable. No cuesta ads — cuesta secuencias de email bien hechas.

### 3.1 Secuencia "firmante → donante mensual", **segmentada por campaña**
Tienes 7 segmentos distintos. Quien firmó por **Pregnancy in Prison** debe recibir un pedido **enmarcado en PIP**, no genérico.
- **Cómo:** una secuencia de 3-4 emails que arranca al firmar (o un reenvío a la lista existente por segmento). Estructura: (1) gracias + impacto de SU causa, (2) la historia humana detrás, (3) el pedido mensual concreto: *"£3/mes mantiene viva la campaña por la que firmaste"*, (4) última oportunidad + match si hay.
- **Por qué funciona:** pides poco (£3-4/mes), atado a la causa que YA les importó.
- **Quién:** equipo redacta (te ayudo con las plantillas y la lógica de segmentos). Lo monto si quieres.

### 3.2 Arreglar el "punto ciego" de medición (UTMs)
Hoy £305 de donaciones aparecen como "Unassigned" porque los enlaces de email/peticiones no llevan etiqueta.
- **Cómo:** añadir `?utm_source=email&utm_campaign=pip_ask` (etc.) a cada enlace que mandas. Te dejo una **plantilla de enlaces UTM** lista para copiar.
- **Impacto:** podrás ver qué email/petición trae donaciones y duplicar lo que funciona.

### 3.3 Pedido en la página de agradecimiento de cada petición
El momento de máxima emoción es justo después de firmar. Ahí, un pedido mensual suave atado a la causa convierte muchísimo.
- **Cómo:** en la thank-you de cada petición, un bloque "convierte tu firma en acción mensual — £3/mes". Esto **lo puedo construir** en el sitio.

---

## 4. ESTRATEGIA 2 — Crecer la lista más inteligente (complementa tus FB ads)

Ya tienes los ads a 600 postcodes (mujeres de izquierda que no te conocen). Súmale:

### 4.1 **Lookalike de Meta a partir de tus 22.636** ← la de mayor impacto
Sube tu lista de 22.636 emails a Meta como **Custom Audience** → Meta crea un **Lookalike** (gente parecida a quien YA te apoya). Es muchísimo más eficiente que targetear postcodes en frío, porque parte de tu mejor señal: tus propios firmantes.
- **Cómo:** Meta Ads Manager → Audiences → Custom Audience (customer list) → luego Lookalike 1%. Corre ese lookalike **en paralelo** a tu campaña de postcodes y compara coste por lead.
- ⚠️ **GDPR:** Meta hashea los emails; aun así, confirma que tu **política de privacidad** cubre el uso publicitario de la lista de campaña. Para una org feminista, esto importa — déjalo documentado.
- **Impacto esperado:** normalmente baja el coste por contacto 30-50% vs targeting en frío.

### 4.2 Sigue lanzando **peticiones afiladas atadas a la actualidad**
Es tu motor probado. Cada petición sobre un momento noticioso = lista nueva. El tema **relaxers/cáncer** (No More Lyes) tiene demanda de búsqueda real y potencial viral — explótalo.

### 4.3 Táctica **local** en tus hotspots (Brighton + East London)
Tienes densidad real ahí. Bajo coste, alta afinidad:
- Sociedades feministas universitarias (Sussex/Brighton, SOAS, Goldsmiths) → charlas + captación.
- Alianzas con grupos feministas locales y espacios (cafés, librerías independientes) → QR a una petición.
- Un evento pequeño en Brighton o Stoke Newington → contactos + prensa local + enlaces (bueno para SEO también).

### 4.4 Intercambio/co-firma con orgs aliadas
Sister's Uncut, Abortion Rights, Centenary Action, etc. Co-firman una campaña, comparten audiencias afines. Crecimiento gratis y de calidad.

### 4.5 Video corto (TikTok/Reels) en los temas con demanda
"¿Los alisadores causan cáncer?" y "formación gratuita de bystander" son temas que la gente busca activamente. Video → bio link a petición.

---

## 5. ESTRATEGIA 3 — De donante puntual a mensual + retención

### 5.1 Campaña de "upgrade" a mensual
Tienes 800+ donaciones puntuales al año. Pídele a quien dio una vez que se haga mensual ("£3/mes hace tu impacto continuo").

### 5.2 Campaña de **match** (1-2 veces al año)
Consigue que un financiador iguale las **nuevas** donaciones mensuales durante un mes. Es la palanca más fuerte para picos de conversión ("tu £4 se convierte en £8").

### 5.3 Recuperar fallidos y cancelados
Tu dashboard ya muestra pagos fallidos/cancelados (tarjeta caducada suele ser la causa). Un email amable "actualiza tu tarjeta" recupera donantes que NO quisieron irse.

### 5.4 Onboarding de donante mensual (confianza)
Hoy las renovaciones son **silenciosas** (no molestamos, bien). Pero un **email de bienvenida** + un **reporte de impacto trimestral** corto sube la retención y baja el churn. (Y ya arreglamos el bug que cobraba doble — eso protegía la confianza.)

---

## 6. Plan priorizado de 90 días

**Semanas 1-2 — medir y preparar (rápido, alto impacto):**
- [ ] Poner UTMs en todos los enlaces de email/peticiones (te doy la plantilla)
- [ ] Subir la lista a Meta → crear Custom Audience + Lookalike 1% (corre junto a tus 600 postcodes)
- [ ] Definir el pedido mensual estándar: £3/£5/£10, enmarcado por campaña

**Semanas 3-6 — convertir la lista (el oro):**
- [ ] Lanzar la secuencia "firmante → mensual" segmentada por campaña (empieza por los 2 segmentos grandes: Dignity 7.518 y PIP 5.718)
- [ ] Añadir el bloque de pedido mensual en las thank-you de peticiones (lo construyo yo)
- [ ] Campaña de upgrade a los donantes puntuales

**Semanas 7-12 — escalar y retener:**
- [ ] Evaluar lookalike vs postcodes → mover presupuesto a lo que rinde
- [ ] Campaña de match (buscar financiador que iguale)
- [ ] Email de recuperación de pagos fallidos/cancelados
- [ ] Probar 1 táctica local en Brighton o East London
- [ ] Bienvenida + primer reporte de impacto a donantes mensuales

---

## 7. Qué puedo construir YO para apoyar esto (dime y lo hago)
- **Export de la lista para Meta** (emails hasheados o en el formato que pide el Custom Audience) desde tu base de audiencia.
- **Plantilla de enlaces UTM** lista para el equipo.
- **Bloque de pedido mensual** en las páginas de agradecimiento de peticiones (segmentado por campaña).
- **Plantillas de la secuencia de email** "firmante → donante mensual" por segmento.
- **Una página/dashboard** que mida la conversión de cada secuencia (sobre lo que ya construimos).

---

## Resumen de la lógica
1. **Tu web convierte (73% de quien ve /donate dona)** → el trabajo es llevar gente a pedir.
2. **Tu lista es tu canal #1** (los £305 "Unassigned") → conviértela: es lo más barato y rentable.
3. **Los FB ads + lookalike de tu propia lista** mantienen la lista creciendo por arriba.
4. **Peticiones noticiosas + táctica local** en tus hotspots = crecimiento de calidad.
5. **Match + upgrade + recuperación de fallidos** maximizan el recurrente.

> El número a vigilar cada mes (en tu dashboard `/levelup`): **donantes mensuales activos** y **conversión por canal**. Si sube el recurrente, vas bien.
