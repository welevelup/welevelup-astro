# TODO — Próxima sesión

## Cola en orden de prioridad

1. **Reconstruir HOME completo** como página editorial propia (no parches sobre clone)
   - Video TedxLondon (youtube: xj-alDQD2fg) embebido en sección "How Collective Care Can Change Society"
   - Sección "Who We Are" limpia
   - Esconder/eliminar "Next Event" vacío
   - Petitions con imágenes exactas del original y estilo similar
   - Sección "From the Blog" ya hecha (cards navy)
   - CTA "Join the Level Up community" ya hecho

2. **Stats strip** en campañas que tienen datos numéricos

3. **Audit colores** — pasada final de texto navy-sobre-navy en TODAS las campañas

4. **Mobile responsive** — revisión completa de Nav, campañas, blog, home

5. **Imágenes exactas** de cada petition card del original de WordPress

6. **Sign petition links** correctos en mega-dropdown del Nav

7. **Menú caído** — fix spacing/layout del nav (items posiblemente wrapping)

8. **Estilo petition cards** similar al original (marco lime, layout)

9. **Blog post títulos** — cambiar color y estilo de letra al verde claro/mint como la propuesta "Feminist Thinking" (ver screenshot de referencia)

## Lo que está HECHO

- 9 campañas con diseño editorial (pregnancy-in-prison manualmente, resto via agentes)
- Blog listing /blog (Magazine editorial - Proposal A)
- Blog posts /blog/[slug] (con campaign callout, related posts, share)
- Contacto /contact (form + info)
- Donate /donate (Mollie integration, test mode funciona)
- Nav component (2 filas, mega-dropdown de campaigns)
- Footer component (logo, sociales, contacto, CC license)
- Mollie integration (create-donation, webhook, idempotente)
- Script legacy webhooks (dry-run exitoso, 75 subs)
- SEO: URLs preservadas, redirects, sitemap, JSON-LD de Rank Math
- GitHub: welevelup/welevelup-astro (público, auto-deploy)
- Vercel: levelup-astro.vercel.app (producción)
