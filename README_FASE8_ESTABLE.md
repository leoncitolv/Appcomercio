# DealWatch MX / Appcomercio — Fase 8 estable

Esta fase no agrega un backend real todavía. Cierra una versión estable para GitHub Pages con la app funcionando como HTML/PWA pura.

## Archivos principales

Sube estos archivos a la raíz del repositorio:

- `index.html`
- `service-worker.js`
- `manifest.webmanifest`
- `README_FASE8_ESTABLE.md`

Y conserva la carpeta:

- `icons/`
  - `icon-192.png`
  - `icon-512.png`

## Funciones incluidas

- Diseño tipo iOS.
- Modo administrador local.
- Productos favoritos.
- Búsqueda y filtros.
- Historial de precios.
- Alertas locales.
- Exportar e importar respaldo JSON.
- Instalación PWA.
- Panel de preparación para backend futuro.
- Checklist de versión estable.

## Archivos viejos que conviene eliminar del repo

Para evitar conflictos con GitHub Pages y versiones anteriores, elimina si existen:

- `.github/`
- `public/`
- `scripts/`
- `src/`
- `package.json`
- `render.yaml`
- `.env.example`

## Configuración recomendada de GitHub Pages

En GitHub:

`Settings → Pages → Source: Deploy from a branch → Branch: main → Folder: /root`

No uses GitHub Actions para esta versión HTML/PWA.

## Prueba final

1. Abre la app en incógnito.
2. Entra a Admin con `admin123`.
3. Agrega un producto real con link específico.
4. Edita el precio para generar historial.
5. Revisa Alertas.
6. Exporta JSON.
7. Borra productos de prueba.
8. Importa el JSON.
9. Instala la PWA en celular.
10. Usa “Limpiar caché” si aparece una versión anterior.

Cuando todo funcione, esta carpeta puede considerarse la versión `v1 estable` antes de avanzar a Supabase, Firebase o backend real.
