# DealWatch MX · Fase 14 · Amazon seguro

Esta fase agrega soporte inicial para Amazon sin hacer scraping.

## Qué hace

- Mantiene Mercado Libre con precio real automático.
- Mantiene Telegram con anti-spam.
- Detecta productos de Amazon por tienda o link.
- Extrae ASIN desde links tipo `/dp/ASIN`, `/gp/product/ASIN` o `asin=ASIN`.
- Aplica reglas de oferta de Amazon usando el precio manual guardado en Supabase.
- Reporta en el log cuántos productos Amazon se detectaron y cuántos tienen ASIN.

## Qué NO hace todavía

- No extrae precio real de Amazon automáticamente.
- No hace scraping de Amazon.
- No usa credenciales de Amazon Product Advertising API todavía.

Amazon debe integrarse por vía oficial/API en una fase posterior. Por ahora esta fase es segura para seguir usando GitHub Actions sin simular navegador ni raspar HTML.

## Cómo guardar un producto Amazon

Usa links como:

```text
https://www.amazon.com.mx/dp/B0XXXXXXXX
https://www.amazon.com.mx/gp/product/B0XXXXXXXX
```

Evita links demasiado recortados donde no aparezca el ASIN.

## Cómo probar

1. Guarda o edita un producto con tienda `Amazon México`.
2. Usa un link con `/dp/ASIN`.
3. Coloca precio actual manual.
4. Ajusta precio objetivo o descuento mínimo para activar alerta.
5. Ejecuta GitHub Actions con `live_prices = true`.
6. Revisa el log:

```text
Amazon: X detectado(s), X con ASIN, X sin ASIN
```

Si el precio manual cumple regla de oferta, se manda Telegram con anti-spam.

## Archivos a reemplazar

```text
index.html
service-worker.js
manifest.webmanifest
README_FASE14_AMAZON_SEGURO.md
.github/workflows/check-prices.yml
scripts/check-prices.mjs
```
