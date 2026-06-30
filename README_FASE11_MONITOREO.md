# DealWatch MX · Fase 11

## Monitoreo automático gratuito con GitHub Actions + Supabase

Esta fase agrega un monitor programado. Sigue siendo una app HTML/PWA para GitHub Pages. No se agrega backend Node permanente.

## Qué hace esta fase

- Lee productos guardados en Supabase.
- Revisa reglas ya capturadas: precio objetivo y descuento mínimo.
- Guarda una ejecución en `monitor_runs`.
- Guarda resultados por producto en `monitor_results`.
- Crea alertas en `alert_events` cuando un producto cumple reglas.
- Se puede ejecutar manualmente desde GitHub Actions.
- También queda programado cada 6 horas.

## Qué NO hace todavía

Todavía no extrae precios automáticamente de Amazon, Mercado Libre ni PlayStation. Esta fase deja el robot funcionando y la estructura lista. La conexión a proveedores reales será una fase posterior.

## Paso 1: Ejecutar SQL

En Supabase:

```text
SQL Editor → New query → pegar SUPABASE_SQL_FASE11_MONITOREO.sql → Run
```

## Paso 2: Subir archivos a GitHub

Sube/reemplaza en la raíz:

```text
index.html
service-worker.js
manifest.webmanifest
SUPABASE_SQL_FASE11_MONITOREO.sql
README_FASE11_MONITOREO.md
```

Sube también:

```text
.github/workflows/check-prices.yml
scripts/check-prices.mjs
```

## Paso 3: Crear el secreto en GitHub

En GitHub:

```text
Settings → Secrets and variables → Actions → New repository secret
```

Nombre:

```text
SUPABASE_SERVICE_ROLE_KEY
```

Valor:

```text
Tu service_role / secret key de Supabase
```

No pegues esa llave dentro de `index.html`.

## Paso 4: Ejecutar manualmente

En GitHub:

```text
Actions → DealWatch MX - Revisar ofertas → Run workflow
```

Después abre tu app:

```text
Nube → Fase 11 · Monitoreo automático → Actualizar monitoreo
```

## Horario

El workflow está programado cada 6 horas:

```yaml
- cron: "17 */6 * * *"
```

GitHub usa UTC para cron. Puedes cambiarlo después.

## Seguridad

- `publishable key`: puede estar en `index.html` con RLS configurado.
- `service_role` / secret key: solo en GitHub Secrets.
- No subas `service_role` al repo.
