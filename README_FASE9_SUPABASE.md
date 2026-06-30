# DealWatch MX / Appcomercio — Fase 9 Supabase

Esta versión conecta la app HTML/PWA de GitHub Pages con Supabase Free.

## Archivos a subir a GitHub

Sube o reemplaza en la raíz del repo:

- `index.html`
- `service-worker.js`
- `manifest.webmanifest`

Conserva:

- `icons/icon-192.png`
- `icons/icon-512.png`

## Antes de usar

1. Entra a Supabase.
2. Abre `SQL Editor`.
3. Ejecuta el archivo `SUPABASE_SQL_FASE9.sql`.
4. Crea tu usuario en `Authentication → Users`.
5. Sube los archivos a GitHub Pages.
6. Abre la app y ve a `Nube`.
7. Inicia sesión con tu correo y contraseña de Supabase.
8. Presiona `Migrar locales a Supabase`.

## Seguridad

El archivo usa `Project URL` y `publishable key`, correctas para frontend.
No pegues nunca en `index.html`:

- secret key
- service_role key
- password de base de datos
- connection string
- JWT secret

## Modo de trabajo

La app guarda copia local en `localStorage` y, cuando hay sesión, guarda también en Supabase.
