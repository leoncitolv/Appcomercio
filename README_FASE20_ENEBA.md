# DealWatch MX · Fase 20 · Eneba

Esta versión agrega **Eneba** como tienda dentro de DealWatch MX.

## Qué incluye

- Nueva tienda: **Eneba**.
- Detección automática cuando pegas links de `eneba.com`.
- Logo/badge visual de Eneba en vista previa y tarjetas de producto.
- Vista previa con imagen si pegas la URL de imagen manualmente.
- Relleno básico del nombre del producto desde el slug del enlace de Eneba cuando el campo está vacío.
- Categoría sugerida: `Gaming digital`.
- Alertas por reglas manuales: precio actual, precio objetivo y descuento mínimo.
- Telegram muestra la tienda como `🎮 Eneba` cuando aplica.

## Importante

Eneba tiene documentación de API, pero está orientada a comerciantes/sellers y requiere OAuth/credenciales de merchant. Para esta app familiar, esta fase implementa Eneba en modo seguro/manual, sin scraping ni claves privadas.

## Archivos a subir

Reemplaza en GitHub:

```text
index.html
service-worker.js
manifest.webmanifest
scripts/check-prices.mjs
```

Conserva:

```text
.nojekyll
.github/workflows/check-prices.yml
icons/
```

## Cómo usar Eneba

1. Ve a **Agregar**.
2. Pega un link de Eneba.
3. La tienda cambia a **Eneba** automáticamente.
4. Escribe precio actual y precio objetivo.
5. En **Opciones avanzadas**, pega la URL de imagen si quieres que se vea la portada/tarjeta del juego.
6. Guarda el producto.

Si quieres precio automático real de Eneba en el futuro, habría que evaluar una API externa o una integración de merchant. Esta versión prioriza estabilidad.
