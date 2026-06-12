# Guía de enlaces UTM + pedido en peticiones

Dos cosas para tapar el "punto ciego" (los £305 que aparecían como *Unassigned*) y para convertir firmantes en donantes.

---

## 1. Enlaces UTM — para saber QUÉ trae donaciones

Hoy, cuando mandas un email o pones un enlace en una petición, Google no sabe de dónde vino la donación. Solución: pegarle "etiquetas UTM" al final del enlace. Es solo texto extra en la URL — la persona no nota nada, pero tu dashboard sí.

### La fórmula
```
https://welevelup.org/donate?utm_source=FUENTE&utm_medium=MEDIO&utm_campaign=CAMPAÑA
```
- **utm_source** = de dónde viene: `email`, `instagram`, `facebook`, `petition`, `newsletter`
- **utm_medium** = el tipo: `email`, `social`, `paid`, `thankyou`
- **utm_campaign** = qué campaña/envío: `pip_ask`, `dignity_ask`, `nomorelyes`, `xmas2026`

### Plantillas listas para copiar (cámbiale solo la campaña)
| Dónde lo usas | Enlace |
|---|---|
| Email de pedido (PIP) | `https://welevelup.org/donate?utm_source=email&utm_medium=email&utm_campaign=pip_ask` |
| Email de pedido (Dignity) | `https://welevelup.org/donate?utm_source=email&utm_medium=email&utm_campaign=dignity_ask` |
| Newsletter mensual | `https://welevelup.org/donate?utm_source=newsletter&utm_medium=email&utm_campaign=monthly_news` |
| Bio de Instagram | `https://welevelup.org/donate?utm_source=instagram&utm_medium=social&utm_campaign=bio` |
| Post de Facebook | `https://welevelup.org/donate?utm_source=facebook&utm_medium=social&utm_campaign=post` |
| Gracias de una petición | `https://welevelup.org/donate?utm_source=petition&utm_medium=thankyou&utm_campaign=NOMBRE_PETICION` |

> Regla simple: **todo enlace a donar que mandes, lleva UTM.** Al mes verás en tu dashboard (`/levelup` → Website → "What brings donations") qué email/canal recauda más, y duplicas eso.

**Atajo:** guarda esta tabla y copia-pega. Si quieres, te genero un mini-formulario que arma el enlace solo.

---

## 2. Pedido mensual en la página de gracias de las peticiones (yourmovement.org)

Tus peticiones viven en yourmovement.org, así que esto lo configura el equipo **ahí** (no en el sitio Astro). El momento justo después de firmar es el de **máxima emoción** → un pedido mensual suave, atado a la causa, convierte muchísimo.

### Copia lista (versión PIP — adapta el texto por campaña)
> **You've added your name. Now make it last.**
> Pregnant women are still being sent to prison. Your signature is the first step — a small monthly gift keeps this campaign fighting until the law changes.
> **[ Give £3 a month → ]** (enlaza a: `https://welevelup.org/donate?frequency=monthly&utm_source=petition&utm_medium=thankyou&utm_campaign=pip`)

### Bloque HTML listo para pegar (si la plataforma permite HTML)
```html
<div style="background:#0C0A3E;padding:32px 24px;text-align:center;font-family:'DM Sans',Arial,sans-serif;margin:24px 0;">
  <p style="margin:0 0 10px;font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#CCFF33;">Make it last</p>
  <h3 style="margin:0 0 12px;font-size:24px;font-weight:800;color:#EEEBD3;line-height:1.1;">You've added your name. Now make it count every month.</h3>
  <p style="margin:0 auto 20px;max-width:420px;font-size:16px;line-height:1.6;color:rgba(238,235,211,0.75);">A small monthly gift keeps this campaign going until we win. £3 a month makes you part of it.</p>
  <a href="https://welevelup.org/donate?frequency=monthly&utm_source=petition&utm_medium=thankyou&utm_campaign=GENERIC" style="display:inline-block;background:#CCFF33;color:#0C0A3E;font-size:14px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;text-decoration:none;padding:16px 32px;">Give £3 a month →</a>
</div>
```
Cambia `utm_campaign=GENERIC` por el nombre de cada petición (`pip`, `dignity`, `nomorelyes`…) para medir cuál convierte mejor.

> Nota: en el sitio Astro, este mismo bloque ya aparece **automáticamente** en la página de gracias tras una donación única (pidiendo pasar a mensual). Esto de arriba es para replicarlo en las **peticiones** de yourmovement.
