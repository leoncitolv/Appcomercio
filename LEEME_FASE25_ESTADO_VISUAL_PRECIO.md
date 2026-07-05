# DealWatch MX / Appcomercio — Fase 25 Estado visual del precio

Esta fase agrega etiquetas visuales para distinguir el estado del precio sin cambiar la lógica principal de compra/alertas.

## Archivos a reemplazar

1. `index.html` en la raíz del repositorio.
2. `scripts/check-prices.mjs`.
3. `.github/workflows/check-prices.yml` es opcional, pero se incluye actualizado con `DEALWATCH_MODE` de Fase 25.

Conserva sin borrar:

```text
service-worker.js
manifest.webmanifest
.nojekyll
icons/
assets/ si existe
```

## Qué se ve en la app

- ✅ Precio automático actualizado
- 🟡 Precio manual conservado
- 🟠 Precio sospechoso ignorado
- 🔵 Precio manual seguro
- ⚪ Precio automático pendiente

## Cómo funciona

El robot guarda dentro de `price_history.raw.priceStatus` un objeto con:

```json
{
  "code": "manual_conserved",
  "label": "Precio manual conservado",
  "tone": "warning",
  "icon": "🟡",
  "reason": "Mercado Libre bloqueó la lectura o el producto no está disponible. Se conservó el precio manual guardado."
}
```

La app lee el último historial de cada producto y muestra una tarjeta de estado dentro de Productos, Alertas y Top precios.

## Validación hecha

- `node --check check-prices.mjs`: OK
- extracción y validación de sintaxis del `<script>` de `index.html`: OK

## Importante

Para que aparezcan estados reales de Mercado Libre/Eneba, primero debe correr GitHub Actions y guardarse historial en `price_history`.
Si aún no hay historial, la app mostrará estados seguros como “Precio automático pendiente” o “Precio manual seguro”.
