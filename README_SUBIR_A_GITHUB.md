# Appcomercio · versión HTML para GitHub Pages

Esta carpeta es la versión sencilla para subir directo desde la página de GitHub, sin terminal.

## Archivos que debes subir

Sube todos estos archivos y carpetas a la raíz de tu repositorio:

- `index.html`
- `assets/`
- `icons/`
- `manifest.webmanifest`
- `service-worker.js`
- `README_SUBIR_A_GITHUB.md` opcional

No necesitas `.github`, `.env`, `.gitignore`, `node_modules` ni backend para esta versión.

## Activar GitHub Pages

1. Entra a tu repositorio.
2. Ve a `Settings`.
3. Entra a `Pages`.
4. En `Build and deployment`, elige `Deploy from a branch`.
5. En `Branch`, elige `main` y carpeta `/root`.
6. Guarda.
7. Espera unos minutos y abre la URL que te da GitHub.

## Instalar en celular

En iPhone/Safari:

1. Abre la URL de GitHub Pages.
2. Toca el botón de compartir.
3. Selecciona `Agregar a pantalla de inicio`.

En Android/Chrome:

1. Abre la URL.
2. Toca menú de tres puntos.
3. Elige `Instalar app` o `Agregar a pantalla principal`.

## Nota importante

Esta versión es 100% HTML/CSS/JS. Sirve para administrar productos, historial y calcular si una oferta es buena cuando actualizas el precio.

Para monitoreo automático real de Amazon, Mercado Libre o PlayStation se necesita una segunda etapa con backend, API o GitHub Actions.
