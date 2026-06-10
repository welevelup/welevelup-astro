# Guía SEO de Level Up — cómo subir en Google (y en IA)

**Fecha:** 2026-06-10 · Datos: Google Search Console, últimos 28 días
**Para:** equipo de Level Up (lenguaje llano, sin tecnicismos)

> Tu base técnica ya está **muy bien**: schema FAQ en las campañas, `llms.txt` para IA, redirects, canonical y Open Graph correctos. Esto NO es una lista de cosas rotas — es una guía de **contenido y estrategia** para ganar posiciones. Las acciones aquí las ejecuta el equipo (escribir, conseguir enlaces); casi nada es de código.

---

## 1. Lo primero: la caída del 34% de tráfico

| | Hace 28 días | Últimos 28 días |
|---|---|---|
| Clicks desde Google | 282 | **186** |
| Impresiones | 9.575 | 6.921 |
| Posición media | — | 9,3 |

**Qué pasó (casi con certeza):** la migración de WordPress a Astro. Cuando cambias toda la plataforma, las URLs y la estructura cambian, y Google tarda **2–3 meses** en re-rastrear, re-evaluar y reconectar tu autoridad. Es la causa #1 de caídas temporales y le pasa a todo el mundo que migra.

**La buena noticia:** parte de lo que arreglamos hoy ataca justo esto — redirects de URLs viejas que daban error, eliminación de restos de WordPress, y consolidación de URLs duplicadas. Eso ayuda a recuperar.

**Qué hacer para acelerar la recuperación (haz esto YA):**
1. En **Google Search Console** → *Sitemaps* → reenvía `https://welevelup.org/sitemap-index.xml` (le dice a Google "vuelve a rastrear todo").
2. En GSC → *Inspección de URLs* → pega tu home y tus 6 campañas → botón **"Solicitar indexación"** una por una.
3. En GSC → *Páginas* (Indexación) → mira si hay muchas en "Detectada, no indexada" o "Excluida". Si ves URLs viejas de WordPress ahí, mándame la lista y añado redirects.

---

## 2. La foto grande: te encuentran por tu NOMBRE, no por tus CAUSAS

Tus búsquedas top son casi todas tu marca: *"level up", "level up charity", "level up uk", "levelup"*. Es decir, **Google te trae gente que YA te conoce**. Apenas apareces cuando alguien busca los **temas** por los que luchas.

**El dato clave:** el **92% de las veces que apareces, estás en posiciones 4–10** — la primera página, pero rara vez en el top 3 (donde se llevan ~80% de los clicks). Estás "a un empujón" en montones de búsquedas. Ahí está casi todo tu potencial de crecimiento.

**La estrategia general, entonces:** ganar terreno en búsquedas de **tema/causa** (no de marca), porque ahí están las personas que aún no te conocen y podrían volverse donantes o activistas.

---

## 3. ¿Estás lista para la IA (ChatGPT, Google AI, Perplexity)? — Sí, y bien

Cuando alguien le pregunta a ChatGPT "¿qué organizaciones luchan por la despenalización del aborto en UK?", quieres aparecer. Tu sitio ya hace lo correcto:
- ✅ Tienes **`llms.txt`** (un resumen para IA) — y está completo y bien escrito.
- ✅ Tus campañas usan **schema FAQPage** (preguntas y respuestas estructuradas que la IA cita textualmente).
- ✅ Permites a los bots de IA (`GPTBot`, `ClaudeBot`, `PerplexityBot`) en tu `robots.txt`.

**Para mantener la ventaja:**
1. **Escribe en formato pregunta-respuesta.** La IA cita respuestas directas. En cada campaña, una sección "Preguntas frecuentes" con respuestas de 2–3 frases que empiecen respondiendo (ya lo haces en pregnancy-in-prison — replícalo en TODAS).
2. **Pon las cifras y la fuente juntas.** "196 mujeres embarazadas en prisión en 2024/25 (Ministry of Justice)". La IA confía en datos con fuente y los cita con tu nombre.
3. **Actualiza el `llms.txt`** cada vez que cambien las cifras de firmas o lances campaña nueva (puedo automatizarlo si quieres).

---

## 4. Consejos POR CAMPAÑA (con tu posición real en Google)

> Regla de oro para cada página: **título** (lo que se ve en Google) + **primer párrafo** que responda la búsqueda + **cifras con fuente** + **FAQ** + **una acción clara** (firmar/donar).

### 🟣 Dignity for Dead Women — *media-guidelines-domestic-abuse* (pos. 10,1)
Tu campaña con MÁS firmas (29.200) pero está en el borde de la página 1. Es tu mayor oportunidad de "empujón al top 3".
- **Búsquedas a ganar:** "reporting domestic abuse deaths", "media guidelines domestic homicide", "how to report domestic violence death".
- **Acción:** eres **la** autoridad mundial en esto (creaste las primeras guías, usadas por 500+ periodistas). Tu página debe decirlo arriba del todo. Añade una FAQ: "How should the media report domestic abuse deaths?".
- **Enlaces:** pide a las 100+ organizaciones que respaldan las guías que **enlacen** a esa página. Cada enlace de un medio o ONG sube tu autoridad muchísimo.

### 🟣 Pregnancy in Prison — *pregnancy-in-prison* (pos. 8,2)
Ya tiene FAQ schema (¡bien!). 13.100 firmas.
- **Búsquedas a ganar:** "pregnant women in prison UK", "babies born in prison UK", "should pregnant women go to prison".
- **Acción:** mantén las cifras actualizadas con fuente (Ministry of Justice). Añade preguntas tipo "How many babies are born in prison in the UK?".
- **Enlaces:** artículos de prensa sobre el tema — pídeles que enlacen tu toolkit legal.

### 🟣 Sexual Violence in Football — *sexual-violence-in-football* (pos. 8,3)
- **Búsquedas a ganar:** "sexual violence football Premier League", "footballers domestic abuse", "Premier League safeguarding".
- **Título actual flojo:** "Sexual Violence in Football | Level Up" → súmale intención, ej. *"Sexual Violence in Football: Holding the Premier League & FA to Account | Level Up"*.
- **Gancho mediático:** lo del avión con la pancarta es muy citable — esa historia atrae enlaces de prensa.

### 🟣 #NoMoreLyes — *nomorelyes-2* (pos. 6,4 / 9,8)
Tu mejor posición. Tema con búsqueda real de salud.
- **Búsquedas a ganar:** "are hair relaxers dangerous", "lye hair relaxer cancer risk", "toxic hair relaxers UK".
- **Acción:** la conexión relaxer–cáncer de útero es de alto volumen de búsqueda. Una FAQ "Do hair relaxers cause cancer?" con datos y fuente puede traerte mucho tráfico nuevo (y posiciones de IA).
- **Nota:** `/active-campaigns/nomorelyes` (versión corta) redirige a `nomorelyes-2` — correcto, así Google consolida en la buena.

### 🟣 Abortion is Healthcare — *abortion-is-healthcare* (pos. 10, **0 clicks**)
⚠️ Apareces para "abortion is healthcare" pero en posición 10 y **sin clicks** — y perdiste "abortion is health care". Tema enorme y competido.
- **Búsquedas a ganar:** "decriminalise abortion UK", "is abortion legal in England", "Offences Against the Person Act abortion".
- **Acción:** este necesita **contenido más profundo** para competir. Una página/artículo que explique claramente la ley de 1861, qué significa despenalizar, y casos reales. Es tu causa más difícil de rankear — invierte contenido aquí.

### 🟣 Finish Holloway Women's Centre — *holloway* (1.964 firmas)
- **Búsquedas a ganar:** "Holloway Women's Centre", "Islington women's centre" — búsqueda **local**, más fácil de ganar.
- **Acción:** como es local y específico, con buen título y una mención de Islington/Holloway en el primer párrafo puedes rankear rápido. Bajo esfuerzo, buena recompensa.

### 🟣 We Protect Us — *we-protect-us*
Apareció "bystander training online free" — hay demanda de formación gratuita.
- **Búsquedas a ganar:** "free bystander intervention training UK", "how to intervene in street harassment".
- **Acción:** una página que diga claramente "formación gratuita" + fechas de los talleres mensuales. La gente busca esto activamente.

---

## 5. Consejos a nivel ORGANIZACIÓN

1. **Gana el top 3 para tu propia marca.** Apareces en posición 5–6 para *"level up"* (compites con gaming, fitness, etc.). Para tu nombre deberías ser #1. Refuerza la home con "Level Up — UK feminist campaigning organisation" claro en el título y primer párrafo, y consigue que medios/aliados te enlacen como "Level Up".

2. **Persigue "feminist campaigns/organisations UK".** Ya apareces en posición 3–11 para "feminist campaigns" y "feminist organizations uk". Una página tipo *"Our Campaigns"* bien hecha, que liste todas tus causas con enlaces internos, puede capturar a gente buscando ONGs feministas para apoyar.

3. **Enlaces, enlaces, enlaces (lo #1 fuera de tu web).** En SEO, que otros sitios de confianza te enlacen es el factor más fuerte. Para una ONG:
   - Pide a cada organización aliada/coalición que te enlace.
   - Cada vez que salgas en prensa, pide que **enlacen** tu campaña (no solo que te mencionen).
   - Perfiles en directorios de charities UK (Charity Commission, NCVO, directorios feministas).

4. **Enlaces internos.** Desde cada blog/recurso, enlaza a la campaña relacionada con el texto del enlace siendo la búsqueda objetivo (ej. un blog enlaza a "decriminalise abortion" → tu página de aborto).

5. **Blog con constancia.** Tu blog ya rankea ("gender critical feminism isnt feminist" en pos 17). Publicar sobre momentos de actualidad (lo que ya hacéis) atrae tráfico nuevo y enlaces. Cada post debe enlazar a una campaña.

6. **Google Search Console = tu tablero.** Ya lo tienes conectado al dashboard (/levelup → Google Search → "Opportunities"). Revísalo mensualmente: las búsquedas en posición 4–10 con muchas impresiones son tu lista de "qué mejorar este mes".

---

## 6. Checklist priorizado

**Esta semana (recuperar la caída):**
- [ ] Reenviar el sitemap en Search Console + "Solicitar indexación" de home y 6 campañas
- [ ] Revisar GSC → Páginas: mandarme cualquier URL vieja de WP que dé error
- [ ] Pedir 3–5 enlaces a organizaciones aliadas hacia tus campañas

**Este mes (ganar el "empujón al top 3"):**
- [ ] Reescribir el primer párrafo de las 6 campañas para que respondan la búsqueda y lleven la cifra+fuente arriba
- [ ] Añadir sección FAQ (pregunta-respuesta) en las campañas que aún no la tienen
- [ ] Mejorar el título de "Sexual Violence in Football" y "Abortion is Healthcare"

**Continuo:**
- [ ] Revisar el dashboard "Google Search → Opportunities" cada mes y atacar 2–3 búsquedas
- [ ] Cada aparición en prensa → pedir enlace
- [ ] Mantener `llms.txt` actualizado con cifras nuevas

---

## Lo que YO ya dejé hecho (código)
- ✅ Canonical normalizado (URLs con/sin barra final ya no se duplican)
- ✅ (En sesión previa) redirects de `/feed` y URLs viejas de WP, `noindex` en entornos no-producción, eliminación de restos WP, OG image arreglada

*Lo demás de esta guía es contenido y enlaces — eso lo gana el equipo, no el código. Cuando quieras, te ayudo a reescribir los párrafos/títulos de una campaña concreta.*
