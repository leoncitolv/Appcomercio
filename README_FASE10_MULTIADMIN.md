# DealWatch MX / Appcomercio — Fase 10 Multi-admin

Esta fase agrega equipos/workspaces a Supabase para que varios administradores puedan ver y editar los mismos productos.

## Orden correcto

1. En Supabase abre `SQL Editor`.
2. Ejecuta `SUPABASE_SQL_FASE10_MULTIADMIN.sql` completo.
3. Sube a GitHub Pages:
   - `index.html`
   - `service-worker.js`
   - `manifest.webmanifest`
   - `SUPABASE_SQL_FASE10_MULTIADMIN.sql`
4. Abre la app con `Ctrl + F5` o desde incógnito.
5. Inicia sesión en `Nube`.
6. La app creará automáticamente el equipo `DealWatch MX` si no existe.

## Roles

- `owner`: dueño del equipo. Puede administrar productos y miembros.
- `admin`: puede administrar productos y agregar miembros.
- `viewer`: solo consulta productos, historial y alertas.

## Invitar a otro administrador

1. Entra a `Nube`.
2. En `Equipo / multi-admin`, escribe el correo del nuevo miembro.
3. Elige `admin` o `viewer`.
4. La otra persona debe crear/iniciar sesión con ese mismo correo.
5. Esa persona debe presionar `Aceptar invitaciones`.

## Seguridad

El acceso compartido está protegido con Row Level Security (RLS) de Supabase. No subas nunca `service_role`, `secret key`, contraseña de base de datos ni connection string a GitHub.
