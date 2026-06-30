# DealWatch MX · Fase 13.1

## Objetivo

Agregar el primer extractor de precios reales para **Mercado Libre México** usando GitHub Actions + Supabase + Telegram.

La app sigue siendo HTML/PWA para GitHub Pages. No se agrega backend permanente.

## Qué hace esta fase

- Lee productos desde Supabase.
- Detecta productos de Mercado Libre por tienda o URL.
- Extrae el ID de publicación desde links tipo `MLM-1234567890` o `MLM1234567890`.
- Consulta `https://api.mercadolibre.com/items/{ITEM_ID}`.
- Actualiza `current_price` en Supabase si cambió.
- Guarda `price_history` cuando cambia el precio.
- Evalúa precio objetivo y descuento mínimo.
- Crea eventos de alerta.
- Envía alertas por Telegram cuando hay oferta nueva.

## Archivos que debes subir

Reemplaza en la raíz del repo:

```text
index.html
service-worker.js
manifest.webmanifest
README_FASE13_1_MERCADOLIBRE.md
```

Reemplaza también:

```text
.github/workflows/check-prices.yml
scripts/check-prices.mjs
```

## No necesitas SQL nuevo

Si ya ejecutaste las fases 10 y 11, esta fase no requiere crear tablas nuevas. Usa las tablas existentes:

```text
products
price_history
monitor_runs
monitor_results
alert_events
```

## Requisitos en GitHub Secrets

Deben existir estos secretos:

```text
SUPABASE_SERVICE_ROLE_KEY
TELEGRAM_BOT_TOKEN
TELEGRAM_CHAT_ID
```

No pegues llaves secretas en `index.html`.

## Cómo configurar productos de Mercado Libre

Para que el robot actualice precios reales, el producto debe tener:

```text
Tienda: Mercado Libre
Link del producto: link exacto de publicación
```

Ejemplo válido:

```text
https://articulo.mercadolibre.com.mx/MLM-1234567890-nombre-del-producto
```

También puede funcionar:

```text
https://www.mercadolibre.com.mx/...MLM1234567890...
```

## Ojo con links de catálogo

Los links tipo `/p/MLM...` pueden ser páginas de catálogo y no siempre corresponden a una publicación directa con precio de vendedor. Para esta fase conviene usar links de artículo que tengan `MLM-`.

## Probar manualmente

En GitHub:

```text
Actions → DealWatch MX - Revisar ofertas → Run workflow
```

Activa:

```text
live_prices = true
```

Opcional:

```text
telegram_test = true
```

Después revisa en la app:

```text
Nube → Actualizar monitoreo
Historial
Alertas
```

## Limitaciones

- Solo se implementa Mercado Libre en esta fase.
- Amazon y PlayStation quedan para fases posteriores.
- Si Mercado Libre cambia su respuesta o bloquea un ID, el robot registrará el error en `monitor_results.raw`.
- El robot no compra, no modifica carritos y no inicia sesión en Mercado Libre.
