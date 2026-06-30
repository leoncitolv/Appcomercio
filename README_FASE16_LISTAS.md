# DealWatch MX · Fase 16 · Listas familiares y amigos

Esta fase organiza los productos en listas de interés sin crear más grupos de Telegram. Seguimos usando un solo grupo de Telegram, pero cada alerta incluye la lista correspondiente.

## Listas incluidas

### Familia
- Despensa
- Hogar
- Tecnología
- Salud
- Regalos

### Amigos gaming
- PlayStation
- Controles
- Juegos
- Audífonos
- Monitores

### Compras personales
- Ropa
- Celulares
- Herramientas
- Ofertas especiales

## Qué cambia

- Nuevo campo `deal_list` en Supabase.
- Nuevo selector “Lista familiar / amigos” al agregar o editar productos.
- Nuevo filtro por lista en Favoritos.
- El mensaje de Telegram incluye `Lista: ...`.
- El monitor guarda la lista en `monitor_results` y `alert_events`.
- Mercado Libre, Amazon seguro, anti-spam y multi-admin se mantienen.

## Orden para subir

1. Ejecuta primero `SUPABASE_SQL_FASE16_LISTAS.sql` en Supabase → SQL Editor.
2. Reemplaza en GitHub:
   - `index.html`
   - `service-worker.js`
   - `manifest.webmanifest`
   - `README_FASE16_LISTAS.md`
   - `SUPABASE_SQL_FASE16_LISTAS.sql`
3. Reemplaza también:
   - `.github/workflows/check-prices.yml`
   - `scripts/check-prices.mjs`
4. Abre la app con Ctrl + F5 o limpia caché desde la app.

## Prueba recomendada

1. Edita un producto existente.
2. Selecciona una lista, por ejemplo `Amigos gaming · Controles`.
3. Guarda.
4. Corre GitHub Actions con `live_prices = true`.
5. Si genera alerta, Telegram debe decir la lista en el mensaje.

## Nota

No necesitas crear otro grupo de Telegram. Esta fase mantiene un solo grupo familiar/amigos.
