# Level Up — Plan de crecimiento y captación de donantes
### Diseñado por Fable · 2026-06-11 · v2 (captación-primero)

**Premisa del equipo (la respeto como restricción de diseño):** nuestra comunidad ya está
sobre-emailiada. **Este plan NO le pide más a la lista existente.** Crece hacia afuera:
gente nueva, convertida en el sitio, retenida en silencio.

Todo lo que sigue sale de datos reales del 10-11 de junio: audiencia geolocalizada
(22.636 personas), funnel de GA4, donaciones Mollie/GoCardless/PayPal y Search Console.

---

## 1 · Lo que los datos nos dijeron (y que el plan explota)

| Dato | Número | Implicación estratégica |
|---|---|---|
| Conversión de quien VE la página de donar | **73%** | La web no es el problema. Llevar gente a ella, sí. |
| Visitas que llegan a /donate | solo 7% | El pedido tiene que salir a buscar a la persona, no esperar el clic. |
| Cómo llegó la audiencia actual | Peticiones (Dignity 7.5k, PIP 5.7k) | **La causa convierte; la marca no.** "Join us" en frío: 76 personas. |
| Dónde vive la audiencia | Brighton (BN1/BN2), East London (E17/N16/E5) | Sabemos exactamente cómo es nuestra persona-tipo → lookalike + local. |
| Tráfico de búsqueda | 92% de impresiones en posición 4-10 | Miles ya casi nos encuentran. Un empujón de contenido = gente nueva gratis. |

**El modelo mental del plan — la rueda de la causa:**

```
 Momento noticioso → Petición/contenido afilado → Persona NUEVA firma
        ↑                                              ↓
 Prensa y victorias ← Donante mensual ← Pedido £3/mes EN EL SITIO
```

Cada vuelta de la rueda trae gente nueva y la convierte en el momento de máxima
emoción — sin tocar la bandeja de entrada de la comunidad existente.

---

## 2 · Objetivos (90 días)

| Métrica norte | Hoy (aprox) | Meta 90 días |
|---|---|---|
| Contactos NUEVOS / mes | — (orgánico irregular) | **+800/mes** sostenidos |
| Donantes mensuales nuevos / mes | un puñado | **+30/mes** |
| Coste por contacto nuevo (ads) | sin medir | **< £1,50** con lookalike |
| % de donaciones atribuidas (no "Unassigned") | ~30% | **> 90%** (disciplina UTM) |

Se miden en el dashboard `/levelup` (Donations · Website · Google Search · Audience).

---

## 3 · Frente A — ADQUIRIR: salir a buscar gente nueva

### A1. Pagado: Lookalike encima de tus ads de postcodes ⭐ ya listo
Tus dos ads de Facebook (600 postcodes, mujeres de izquierda) son la apuesta fría.
El **Lookalike** es la caliente: Meta busca gente que se parece a tus 30.492 contactos.
- **Acción:** subir `data/meta-custom-audience.csv` → Custom Audience → Lookalike 1% UK.
- **Presupuesto:** 60% lookalike / 40% postcodes las primeras 2 semanas → mover el dinero al ganador por coste-por-contacto.
- **Destino del ad:** SIEMPRE una petición/causa concreta, nunca "conócenos" (los datos lo prueban: causa 5.700 vs marca 76).
- ⚠️ GDPR: confirmar que la política de privacidad cubre uso publicitario de la lista. Meta hashea los datos.

### A2. El motor probado: peticiones atadas a la actualidad ⭐
Una petición nueva por momento noticioso relevante. Es el canal de adquisición más
barato que tienen y el que construyó toda la audiencia actual.
- **Regla operativa:** kit de lanzamiento en 48h del momento noticioso (petición + post + nota de prensa con CTA).

### A3. Video corto (TikTok/Reels): alcance a desconocidas, gratis
El algoritmo muestra el contenido a gente que NO te sigue — es el único canal orgánico
que regala desconocidos. Ángulos con demanda probada (de Search Console):
- **NoMoreLyes:** "¿Tu alisador puede doblar el riesgo de cáncer de útero?" (la gente YA busca esto)
- **Fútbol:** los momentos noticiosos de la Premier League
- **We Protect Us:** "Qué hacer si presencias acoso callejero" (formato salvable/compartible)
- **Formato:** 30-60s, una sola idea, CTA a firmar (link en bio con UTM).

### A4. Audiencias prestadas: alianzas y co-firmas
Co-campañas con Sisters Uncut, Abortion Rights, Centenary Action, etc. → te expones a
sus comunidades sin gastar y sin tocar la tuya. Una co-firma por trimestre es razonable.

### A5. Prensa que captura, no solo que suena
Ya generan prensa (el avión de la Premier League, las guías Dignity). La regla nueva:
**ninguna aparición sin CTA** — todo quote/nota termina en "firma en welevelup.org/...".
Pedir el enlace al medio (además ayuda al SEO, que está a un empujón del top 3).

### A6. La comunidad como altavoz (no como cartera)
Lo único que sí pediremos a la base existente — y no es dinero ni atención:
**"comparte esto con una persona a la que le importe"** al final de cada petición.
Convierte a 22.636 personas en canal de distribución hacia gente nueva.

### A7. Local en los bastiones: Brighton + East London
Donde la audiencia es más densa. Bajo coste, alta afinidad: sociedades feministas
universitarias (Sussex, SOAS, Goldsmiths), librerías/cafés aliados con QR a petición,
un evento pequeño por trimestre. Gente nueva + prensa local + enlaces.

---

## 4 · Frente B — CONVERTIR: en el sitio, en el momento, sin emails masivos

La conversión ocurre **dentro de la experiencia**, en el pico de emoción:

1. **Pedido £3/mes tras donación única** — ya construido (PR #90). Automático.
2. **Pedido £3/mes en la página de gracias de cada petición** (en yourmovement):
   bloque listo para pegar en `MARKETING-UTM-GUIDE.md`. El firmante nuevo recibe el
   pedido AHÍ, una vez, en contexto — no en su bandeja de entrada tres veces.
3. **Email de bienvenida SOLO para firmantes nuevos** (onboarding, no blast): quien
   acaba de firmar recibe 2-3 emails de SU causa con un pedido suave. La comunidad
   histórica no recibe nada. (Textos listos en `MARKETING-EMAIL-SEQUENCES.md`.)
4. **Por qué £3:** pedir poco maximiza el sí inicial; el valor está en la recurrencia
   (£36/año) y en el Gift Aid (+25%). Subir el monto después es más fácil que entrar.

---

## 5 · Frente C — CUIDAR: retener sin molestar

- **Renovaciones silenciosas** (ya implementado): a quien dona mensual no se le escribe cada mes. La mejor retención es no fastidiar.
- **Recuperación de pagos caídos:** único email transaccional justificado — "tu tarjeta caducó, 30 segundos para arreglarlo". Recupera donantes que no querían irse.
- **Match 2 veces/año:** un financiador iguala las donaciones mensuales NUEVAS durante un mes. Se usa como momento de campaña pública (ads + peticiones), no como blast a la lista.
- **Informe de impacto trimestral:** un solo email cada 3 meses a donantes activos. Retención sin ruido.

---

## 6 · Calendario de 90 días

**Semanas 1-2 — encender la medición y lo pagado**
- Subir lista a Meta → Lookalike 1% → arrancar 60/40 contra postcodes
- UTM en todo enlace de donar (herramienta lista) · activar PR #90
- Pegar el bloque de £3/mes en las gracias de las 3 peticiones top

**Semanas 3-6 — el motor de contenido**
- 2 videos cortos/semana (empezar por NoMoreLyes — demanda probada)
- 1 petición nueva si hay momento noticioso (kit de 48h)
- Cerrar 1 co-firma con org aliada
- Onboarding de firmantes nuevos activo (solo nuevos)

**Semanas 7-12 — escalar lo que funciona**
- Rebalancear presupuesto de ads por coste-por-contacto real (dashboard)
- Buscar financiador para el match de otoño
- Evento local piloto (Brighton o Stoke Newington)
- Revisión mensual: 30 min frente al dashboard, mover dinero/esfuerzo al ganador

---

## 7 · Lo que este plan NO hace (igual de importante)

- ❌ **No más blasts a la lista completa.** La comunidad está sobre-emailiada; se respeta.
- ❌ No ads a "conócenos" — solo a causas concretas.
- ❌ No pedir montos grandes de entrada — £3/mes, siempre.
- ❌ No lanzar canales nuevos sin UTM (si no se puede medir, no se lanza).

---

## 8 · Riesgos y mitigación

| Riesgo | Mitigación |
|---|---|
| Lookalike no rinde mejor que postcodes | El 60/40 es prueba A/B con salida a las 2 semanas; el dinero sigue al dato |
| GDPR / lista en Meta | Revisar política de privacidad ANTES de subir; documentar la base legal |
| Capacidad del equipo (video) | Empezar con 1 canal y 2 videos/semana; reciclar contenido de campañas existentes |
| Fatiga de peticiones | Solo lanzar con momento noticioso real; calidad sobre cadencia |

---

## 9 · Quién hace qué (propuesta para asignar el martes)

| Pieza | Quién | Estado |
|---|---|---|
| Subir lista a Meta + Lookalike | equipo (15 min) | archivo listo |
| Activar pedido £3/mes en el sitio | Fable (merge PR #90) | espera OK |
| Bloque £3/mes en gracias de peticiones | equipo (pegar HTML) | copy listo |
| UTM en enlaces | equipo (herramienta lista) | guía lista |
| Videos cortos | equipo (definir quién) | ángulos definidos |
| Co-firmas / alianzas | equipo (relaciones) | lista de orgs sugerida |
| Onboarding firmantes nuevos | equipo + Fable | textos listos |
| Dashboard de seguimiento | ya construido | `/levelup` |

---

*Documentos compañeros: `MARKETING-UTM-GUIDE.md` (enlaces y bloque de peticiones) ·
`MARKETING-EMAIL-SEQUENCES.md` (onboarding de firmantes nuevos, recuperación de pagos) ·
`SEO-PLAYBOOK.md` (el empujón al top 3 de Google).*
