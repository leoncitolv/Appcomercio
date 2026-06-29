# DealWatch MX

App web instalable tipo iOS para monitorear productos favoritos en Amazon, Mercado Libre y PlayStation Store.

Incluye:

- PWA instalable en celular.
- Diseño estilo iOS con tarjetas, blur y modo responsivo.
- Login de administrador.
- Alta de productos favoritos.
- Historial de precios.
- Reglas para detectar oferta realmente buena.
- Endpoint protegido para cron.
- Alertas por Telegram o correo opcionales.
- Preparado para subir a GitHub y desplegar en Render, Railway, VPS o servidor propio.

## 1. Instalación local

```bash
npm install
cp .env.example .env
nano .env
npm run seed
npm start
```

Abre:

```text
http://localhost:3000
```

## 2. Usuario administrador

Edita tu `.env` antes de iniciar:

```env
ADMIN_NAME=David
ADMIN_EMAIL=tu_correo@example.com
ADMIN_PASSWORD=tu_password_seguro
JWT_SECRET=una_clave_larga_y_segura
CRON_SECRET=otra_clave_larga_y_segura
```

No existe registro público. Solo un admin puede crear otros admins desde la sección **Administradores**.

## 3. Subir a GitHub

```bash
git init
git add .
git commit -m "DealWatch MX inicial"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/dealwatch-mx.git
git push -u origin main
```

## 4. Despliegue recomendado

Puedes desplegarlo en Render/Railway/VPS.

Variables mínimas:

```env
NODE_ENV=production
APP_URL=https://tu-dominio.com
JWT_SECRET=clave_larga
CRON_SECRET=clave_larga_cron
ADMIN_NAME=David
ADMIN_EMAIL=tu_correo@example.com
ADMIN_PASSWORD=tu_password_seguro
```

## 5. Cron automático con GitHub Actions

El archivo `.github/workflows/check-prices.yml` llama al endpoint protegido:

```text
POST /api/cron/check
```

En GitHub agrega estos Secrets:

- `DEALWATCH_URL`: URL de tu app desplegada, por ejemplo `https://dealwatch.onrender.com`
- `CRON_SECRET`: mismo valor que tienes en `.env`

## 6. Alertas por Telegram

1. Crea un bot con BotFather.
2. Guarda el token en `TELEGRAM_BOT_TOKEN`.
3. Obtén tu chat ID y guárdalo en `TELEGRAM_CHAT_ID`.

## 7. Alertas por correo

Configura SMTP:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=correo@gmail.com
SMTP_PASS=app_password
EMAIL_FROM=DealWatch MX <correo@gmail.com>
ALERT_EMAIL_TO=tu_correo@gmail.com
```

## 8. Notas importantes

- Amazon puede bloquear consultas si se hacen muchas revisiones seguidas. Para uso serio conviene integrar API oficial o servicio autorizado de tracking.
- Mercado Libre funciona mejor porque se intenta leer el item ID y consultar su API pública.
- PlayStation se revisa mediante lectura de la página pública; puede cambiar si Sony modifica su HTML.
- Esta app está pensada para monitoreo personal y responsable.

## 9. Estructura

```text
public/              Frontend PWA
src/                 Backend Express
scripts/             Scripts manuales
.github/workflows/   Cron para GitHub Actions
data/                Base SQLite local
```
