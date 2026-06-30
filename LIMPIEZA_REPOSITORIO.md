# Limpieza del repositorio — DealWatch MX

## Dejar en la raíz

- `index.html`
- `service-worker.js`
- `manifest.webmanifest`
- `README_FASE8_ESTABLE.md`
- `README_SUBIR_A_GITHUB.md` si ya lo tienes
- `icons/`

## Borrar si aparecen

- `.github/`
- `public/`
- `scripts/`
- `src/`
- `package.json`
- `package-lock.json`
- `render.yaml`
- `.env.example`
- archivos de backend Node anteriores

## Motivo

La app actual funciona como HTML/PWA pura en GitHub Pages. Los archivos de Node, backend o workflows pueden hacer que GitHub Pages despliegue otra versión o que se mezcle una app anterior con la app nueva.
