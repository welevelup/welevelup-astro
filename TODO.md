# TODO — Next Session (FRESH START on these items)

## Critical — Mobile
1. Nav mobile: DONATE siempre visible, hamburguesa alineada, menu dropdown funcional
2. Secciones no se deben mezclar/superponer en mobile
3. Announcement bar legible en mobile
4. Hero responsive
5. Petition cards responsive (2 cols tablet, 1 col phone)

## Critical — Home Desktop
6. Video TedxLondon (youtube: xj-alDQD2fg) NO se carga — el JS loader no funciona con la estructura Elementor
7. Footer logo: texto "UP" navy no se lee sobre fondo navy — necesita versión blanca del logo
8. Petition cards: usar las imágenes EXACTAS del original WP, no aproximaciones
9. Petition cards: diseño más similar al original (fotos reales, frame correcto)

## Design Polish
10. Blog post títulos: color verde claro/lime como "Feminist Thinking" header
11. Stats strip en campañas que tienen datos numéricos
12. Quitar subrayado de action cards en campañas (Sign petition, Donate, Join)

## Architecture Note
The home page uses clone HTML (mainContent via set:html) which causes persistent issues with:
- Elementor CSS/JS not loading (videos, lazy images, widgets)
- Sections bleeding into each other
- Duplicate elements

RECOMMENDATION: Rebuild home as fully custom editorial page (like campaigns) in next session. Extract ALL text verbatim but write clean HTML. This eliminates all clone-related bugs permanently.
