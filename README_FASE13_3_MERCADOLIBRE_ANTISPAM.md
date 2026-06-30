# DealWatch MX · Fase 13.3

## Mercado Libre producción estable + anti-spam

Esta fase deja Mercado Libre más estable para uso real con familia/amigos.

## Qué agrega

- Precios reales de Mercado Libre mediante GitHub Actions.
- Soporte para links directos `MLM-...`.
- Soporte para links de catálogo `/p/MLM...` cuando traen `wid=MLM...` o `item_id=MLM...`.
- Diagnóstico en la app del último monitoreo.
- Mensajes de Telegram mejorados con precio anterior, precio actual, meta, item ML y fuente.
- Anti-spam para evitar repetir avisos por el mismo producto y precio.
- Envío de Telegram solo cuando hay una oferta nueva o una bajada relevante.

## Anti-spam configurado

El workflow usa estos valores:

```yaml
DEALWATCH_ALERT_LOOKBACK_DAYS: "7"
DEALWATCH_SIGNIFICANT_DROP_PERCENT: "1"
```

Eso significa:

- No repite Telegram por el mismo producto y mismo precio durante 7 días.
- Si ya avisó una oferta, solo vuelve a avisar si el precio baja al menos 1% respecto al último aviso relevante.

Puedes cambiar esos valores en `.github/workflows/check-prices.yml`.

## Archivos que debes subir

Reemplaza en la raíz:

```text
index.html
service-worker.js
manifest.webmanifest
README_FASE13_3_MERCADOLIBRE_ANTISPAM.md
```

Reemplaza también:

```text
.github/workflows/check-prices.yml
scripts/check-prices.mjs
```

## SQL

No necesitas ejecutar SQL nuevo si ya aplicaste Fase 10 y Fase 11.

## Prueba recomendada

1. Edita un producto de Mercado Libre.
2. Coloca un link completo de producto.
3. Baja el precio objetivo para que cumpla o usa temporalmente una meta alta para probar.
4. Ejecuta GitHub Actions:

```text
Actions → DealWatch MX - Revisar ofertas → Run workflow
live_prices = true
telegram_test = false
```

5. Revisa el log. Debe mostrar algo parecido a:

```text
DealWatch MX OK: ... Anti-spam: 7d / 1%.
```

6. Revisa la app:

```text
Nube → Actualizar monitoreo
```

7. Si hay oferta nueva o bajada relevante, debe llegar mensaje al grupo de Telegram.

## Nota importante

Si vuelves a correr el workflow muchas veces con el mismo producto y el mismo precio, Telegram no se repetirá. Eso es intencional y es parte de esta fase.
