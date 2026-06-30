# DealWatch MX · Fase 13.2 · Mercado Libre estable

Esta fase mejora el monitoreo automático de Mercado Libre en GitHub Actions.

## Qué mejora

- Detecta links directos tipo `articulo.mercadolibre.com.mx/MLM-1234567890`.
- Detecta links modernos tipo catálogo `/p/MLM...` cuando incluyen `wid=MLM...`.
- Detecta `item_id=MLM...` incluso si viene dentro de `pdp_filters`.
- Evita usar por error el ID de catálogo cuando existe un `wid` real.
- Agrega diagnóstico en el mensaje del monitoreo:
  - productos Mercado Libre detectados
  - productos con item real
  - productos actualizados
  - links de catálogo sin `wid/item_id`
  - links inválidos
- Mantiene Telegram, Supabase, historial y multi-admin.

## Ejemplo de link compatible

```text
https://www.mercadolibre.com.mx/producto/p/MLM37117526?pdp_filters=item_id%3AMLM2071997505&wid=MLM2071997505
```

El robot usa primero:

```text
wid=MLM2071997505
```

Si no existe `wid`, intenta usar:

```text
item_id=MLM2071997505
```

## Qué subir a GitHub

Reemplaza:

```text
index.html
service-worker.js
manifest.webmanifest
README_FASE13_2_MERCADOLIBRE_ESTABLE.md
.github/workflows/check-prices.yml
scripts/check-prices.mjs
```

## Cómo probar

1. Crea o edita un producto con tienda `Mercado Libre`.
2. Pega un link real de producto de Mercado Libre.
3. En GitHub entra a `Actions`.
4. Ejecuta `DealWatch MX - Revisar ofertas`.
5. Marca `live_prices = true`.
6. Revisa el log del workflow.

El log debe mostrar algo parecido a:

```text
DealWatch MX OK: 12 productos revisados, 1 alerta(s) nueva(s), 1 precio(s) ML actualizado(s), 1 Telegram. ML: 1 detectado(s), 1 con item real, 0 catálogo(s), 0 inválido(s).
```

## Si no actualiza precio

Revisa el resumen del monitoreo. Si dice:

```text
catálogo(s) sin wid/item_id
```

significa que el link trae solo `/p/MLM...` pero no trae la publicación real.

Si dice:

```text
link(s) inválido(s)
```

significa que el link no contiene un ID de Mercado Libre útil.

