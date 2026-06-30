# DealWatch MX / Appcomercio — Fase 12 Telegram

Esta fase agrega alertas por Telegram al robot de monitoreo de GitHub Actions.

## Objetivo

Cuando GitHub Actions detecte una oferta nueva, enviará un mensaje a un grupo de Telegram familiar o de amigos.

## Archivos a subir

Reemplaza o sube estos archivos en la raíz del repositorio:

- `index.html`
- `service-worker.js`
- `manifest.webmanifest`
- `README_FASE12_TELEGRAM.md`

Y sube también:

- `.github/workflows/check-prices.yml`
- `scripts/check-prices.mjs`

## Crear bot nuevo

1. Abre Telegram.
2. Busca `@BotFather`.
3. Envía `/newbot`.
4. Pon nombre, por ejemplo: `DealWatch MX Bot`.
5. Pon usuario, por ejemplo: `DealWatchMXBot` o el que esté disponible.
6. Copia el token que entrega BotFather.

No subas ese token a GitHub como archivo público. Debe ir en GitHub Secrets.

## Crear grupo

1. Crea un grupo de Telegram: `DealWatch MX · Ofertas`.
2. Agrega al bot al grupo.
3. Manda un mensaje en el grupo, por ejemplo: `hola bot` o `/start`.

## Obtener chat_id

En tu navegador abre temporalmente:

```txt
https://api.telegram.org/botTU_TOKEN/getUpdates
```

Busca el bloque `chat` y copia el `id` del grupo.

En grupos normalmente es negativo, por ejemplo:

```txt
-1001234567890
```

## GitHub Secrets

En GitHub entra a:

```txt
Settings → Secrets and variables → Actions → New repository secret
```

Crea estos secretos:

```txt
SUPABASE_SERVICE_ROLE_KEY
TELEGRAM_BOT_TOKEN
TELEGRAM_CHAT_ID
```

El secreto `SUPABASE_SERVICE_ROLE_KEY` ya lo estabas usando en Fase 11.

## Probar Telegram

En GitHub:

```txt
Actions → DealWatch MX - Revisar ofertas → Run workflow
```

Activa:

```txt
telegram_test = true
```

Debe llegar un mensaje al grupo confirmando que Telegram está conectado.

## Cómo funciona

- Si no hay ofertas nuevas, no manda alerta.
- Si detecta oferta nueva, manda mensaje al grupo.
- Para evitar spam, el robot evita repetir la misma alerta del mismo producto y precio dentro de 24 horas.
- El token del bot nunca va en `index.html`.

## Siguiente fase sugerida

Fase 13: conectar proveedores reales de precio o fuentes semiautomáticas para Amazon, Mercado Libre y PlayStation.
