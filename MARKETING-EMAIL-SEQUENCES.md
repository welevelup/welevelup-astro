# Secuencias de email — onboarding de firmantes NUEVOS

> ⚠️ **Política del plan v2 (la comunidad está sobre-emailiada):** estas secuencias se
> envían **SOLO a quien acaba de firmar** (automatización de bienvenida, una vez en la
> vida), **NUNCA como blast a la lista existente.** Las únicas excepciones hacia la base
> actual son transaccionales: recuperación de pagos caídos (sección E) y el informe de
> impacto trimestral.

Copia lista para enviar. La lógica: **pides poco (£3/mes), atado a la causa que YA les importó.**

> Etiqueta todos los enlaces con UTM (ver MARKETING-UTM-GUIDE.md). Manda desde tu herramienta de email habitual (Brevo/Mailchimp/etc.), no desde el sitio.

---

## A) Segmento Pregnancy in Prison (5.718 personas)

**Email 1 — Día 0 · Gracias + impacto**
- Asunto: *You stood up for pregnant women. Here's what happens next.*
> Hi [Nombre], thank you for adding your name. Right now, pregnant women are still being sent to prison in England — 196 last year, with babies born behind bars. Your signature tells decision-makers this has to end. Over the coming weeks we'll show you exactly how we're turning names into law.

**Email 2 — Día 3 · La historia humana**
- Asunto: *"No one should give birth in a prison cell."*
> One short, real story (con permiso) que humanice la causa. Cierra con: *This is why we fight — and why we can't stop.*

**Email 3 — Día 6 · El pedido (suave, concreto)**
- Asunto: *Could you give £3 a month to end this?*
> Campaigns like this take years of pressure. A small monthly gift keeps us in the fight every single month — not just when the news breaks. **£3 a month** funds the legal work, the lobbying and the public pressure.
> **[ Give £3 a month → ]** (`/donate?frequency=monthly&utm_source=email&utm_medium=email&utm_campaign=pip_ask`)

**Email 4 — Día 10 · Última llamada + match si lo hay**
- Asunto: *The law won't change on its own*
> Recordatorio breve + urgencia. Si tienes campaña de match: *Right now your £3 becomes £6 — a supporter is matching every new monthly gift this week.*

---

## B) Segmento Dignity for Dead Women (7.518 personas)

**Email 1 — Día 0**
- Asunto: *You're helping change how the media reports domestic abuse deaths.*
> Hi [Nombre], gracias. Thanks to people like you, our media guidelines are now used by hundreds of journalists — ending victim-blaming headlines about women killed by men they knew.

**Email 2 — Día 3 · Prueba del impacto**
- Asunto: *We changed a headline. Here's how.*
> Un ejemplo concreto de antes/después de una cobertura. *This is what your support makes possible.*

**Email 3 — Día 6 · El pedido**
- Asunto: *£3 a month to keep dignity in the headlines*
> Every week, women are killed and reported on without dignity. Keeping the pressure on newsrooms is constant work. **£3 a month** keeps it going.
> **[ Give £3 a month → ]** (`/donate?frequency=monthly&utm_source=email&utm_medium=email&utm_campaign=dignity_ask`)

**Email 4 — Día 10 · Última llamada**

---

## C) Plantilla genérica (No More Lyes, Football, Abortion, etc.)
Reusa la estructura de arriba cambiando: la cifra/dato de impacto, la historia, y el `utm_campaign`. Mantén el pedido en **£3/mes** y el marco de "continuidad: la campaña no para".

| Segmento | Dato/gancho para el Email 1 | utm_campaign |
|---|---|---|
| No More Lyes | "Relaxers linked to womb cancer — and barely anyone's talking about it." | `nomorelyes_ask` |
| Football | "We made the Premier League face up to violence against women." | `football_ask` |
| Abortion is Healthcare | "Abortion is still in a law from 1861. We're changing that." | `abortion_ask` |

---

## D) Secuencia de "upgrade" — de donante puntual a mensual
Para quien ya dio una vez (one-off).
- **Email 1** — Asunto: *Your gift made a difference. Could it do more?*
  > Thank you for your one-off gift. If it became £3 a month, you'd power our campaigns all year. **[ Make it monthly → ]**
- **Email 2** (día 5) — recordatorio + impacto anual de £3/mes (£36 al año = X).

> En el sitio, esto ya pasa **automáticamente**: la página de gracias de una donación única ahora muestra el pedido "¿la haces mensual?". Esta secuencia es el refuerzo por email a tu base existente de puntuales.

---

## E) Recuperación de pagos fallidos / cancelados
Tu dashboard detecta pagos fallidos (suele ser **tarjeta caducada**, no que se quieran ir).
- **Email** — Asunto: *Your monthly gift didn't go through — quick fix*
  > Hi [Nombre], your monthly donation to Level Up couldn't be processed — usually an expired or changed card. It takes 30 seconds to fix. **[ Update your details → ]** (enlaza al portal: `/donor-portal`)
  > We'd hate to lose you. Thank you for everything.

---

## Reglas de oro (para todas)
1. **Pide poco:** £3/mes convierte mejor que pedir un gran one-off.
2. **Atado a la causa** que firmaron, no genérico.
3. **Una sola llamada a la acción** por email (un botón).
4. **Asuntos cortos y humanos**, no corporativos.
5. **Mide** con UTM y mira el dashboard al mes — duplica lo que funciona.
