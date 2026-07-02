# Continuar proyecto: DealWatch MX / Appcomercio

## Estado actual guardado

Proyecto: **DealWatch MX / Appcomercio**  
Repo: **leoncitolv/Appcomercio**  
Tipo: **HTML/PWA pura para GitHub Pages**  
Hosting: **GitHub Pages**  
Base de datos / login: **Supabase**  
Sincronización: **Supabase Realtime**  
Robot de precios: **GitHub Actions + Telegram**  

## Versión actual

La versión actual corresponde a:

- **Fase 18 — Sincronización en vivo con Supabase Realtime**
- **Fase 19 — UI premium + imágenes de producto + logos de tiendas**

## Archivos principales para subir a GitHub

Subir/reemplazar en la raíz del repo:

```text
index.html
service-worker.js
manifest.webmanifest
.nojekyll
```

Conservar también:

```text
.github/workflows/check-prices.yml
scripts/check-prices.mjs
icons/
assets/ si existe en el repo
```

## Qué tiene la app actualmente

- Login real con Supabase Auth.
- Equipo/workspace compartido.
- Productos guardados en Supabase.
- Listas/categorías personalizables.
- Sincronización en vivo entre PC y celular con Supabase Realtime.
- Botón “Sincronizar ahora” como respaldo.
- Alertas y monitoreo de precios.
- GitHub Actions para revisar precios.
- Telegram para avisos.
- Interfaz modo oscuro estilo iOS premium.
- Tonos morado/neón/glassmorphism.
- Tarjetas redondeadas.
- Bottom nav tipo app.
- Imágenes de producto en tarjetas.
- Logos/badges de tiendas.

## Tiendas actuales

- Mercado Libre
- Amazon México
- Walmart
- Liverpool
- Eneba
- Otra tienda

## Notas importantes

### Mercado Libre

Mercado Libre puede detectar automáticamente algunos datos del producto cuando el enlace trae item real:

- nombre
- precio
- imagen

### Amazon, Walmart y Liverpool

Por seguridad, las imágenes pueden agregarse manualmente desde:

```text
Agregar producto → Opciones avanzadas → Imagen del producto
```

La URL de imagen se guarda con el producto y se muestra en tarjetas.

## Supabase

Ya se usó SQL para fases anteriores:

- `SUPABASE_SQL_FASE16_LISTAS.sql`
- `SUPABASE_SQL_FASE18_REALTIME.sql`

No ejecutar de nuevo si ya está funcionando, salvo que se cree una base nueva.

## GitHub Secrets necesarias para el robot

En el repo, en:

```text
Settings → Secrets and variables → Actions
```

Debe existir:

```text
SUPABASE_SERVICE_ROLE_KEY
TELEGRAM_BOT_TOKEN
TELEGRAM_CHAT_ID
```

No pegar esas llaves en conversaciones ni en archivos públicos.

### Eneba

Eneba quedó agregada como tienda seleccionable/detectable. El robot intenta leer precio desde enlaces de Eneba y mantiene avisos por Telegram cuando el producto cumple precio objetivo o descuento mínimo.

## Problemas corregidos en esta conversación

- Productos que se borraban al sincronizar: corregido con guardado cloud-first.
- Celular/PC no sincronizaban: corregido con Supabase Realtime.
- Listas eliminadas seguían apareciendo: corregido para respetar listas personalizadas.
- Modo oscuro raro: corregido con UI dark premium.
- App parecía página web: rediseñada a estilo iOS premium.

## Próximas mejoras sugeridas

- Implementar extracción automática de imagen en más tiendas si se encuentra método seguro.
- Mejorar pantalla de productos con vista tarjetas/lista.
- Agregar opción para subir imagen manual local o pegar URL.
- Mejorar notificaciones visuales dentro de la app.
- Crear pantalla de “Ajustes visuales” para cambiar colores.

## Frase para continuar en otra ocasión

Puedes decir:

> Continuemos con DealWatch MX / Appcomercio desde la Fase 19, la app HTML/PWA de GitHub Pages con Supabase Realtime, estilo iOS premium morado, imágenes de productos y logos de tiendas.

