# Plantilla API futura para DealWatch MX

## GET /health

Respuesta esperada:

```json
{
  "ok": true,
  "app": "DealWatch MX",
  "version": "1.0.0"
}
```

## POST /api/products/sync

Recibe productos desde la app.

```json
{
  "type": "dealwatch-backend-sync-payload",
  "version": "7.0",
  "products": []
}
```

## POST /api/prices/check

Recibe productos y regresa precios actualizados.

```json
{
  "checkedAt": "2026-06-30T00:00:00.000Z",
  "results": [
    {
      "productId": "abc",
      "currentPrice": 999,
      "discountPercent": 25,
      "offerDetected": true,
      "source": "Amazon México"
    }
  ]
}
```

## POST /api/alerts/send

Envía alertas externas.

```json
{
  "productId": "abc",
  "title": "Oferta detectada",
  "message": "Control DualSense llegó a $999",
  "channels": ["email", "telegram"]
}
```
