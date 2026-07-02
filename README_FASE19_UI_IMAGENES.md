# DealWatch MX · Fase 19 UI Premium + imágenes de producto

## Archivos a subir/reemplazar

- `index.html`
- `service-worker.js`
- `manifest.webmanifest` opcional, recomendado para mejorar color de PWA
- `.nojekyll` conservarlo si ya existe

## Cambios incluidos

- Rediseño visual más iOS premium en modo oscuro.
- Tarjetas de productos más profesionales.
- Vista previa del producto en pantalla Agregar.
- Soporte para imágenes de producto usando el campo existente `icon` de Supabase.
- No requiere SQL nuevo.
- Logos/badges visuales para tiendas:
  - Amazon México
  - Mercado Libre
  - Walmart
  - Liverpool
  - Otra tienda
- Si pegas un link de Mercado Libre con item real, la app intenta detectar nombre, precio e imagen usando la API pública de Mercado Libre.
- Para Amazon, Walmart y Liverpool, se puede pegar manualmente la URL de imagen en `Opciones avanzadas → Imagen del producto`.

## Nota importante

No se agregó scraping de Amazon/Walmart/Liverpool para evitar que la app se rompa o dependa de bloqueos externos. La imagen puede guardarse manualmente y Mercado Libre puede autocompletar cuando el link permite detectar el item.
