# Parámetros de despliegue (Vercel + Railway + Supabase + Sentry)

Nunca subir valores reales al repositorio. Los nombres de variables están en `backend/.env.example` y `frontend/.env.example`.

## 1. Supabase (PostgreSQL)

1. Crear el proyecto y guardar la contraseña de la base de datos.
2. En *Connect → Session pooler* copiar la cadena (puerto **5432**). Railway solo tiene IPv4 y la conexión directa de Supabase es IPv6, por eso se usa el pooler.
3. Formato: `postgresql://postgres.<ref>:<PASSWORD>@aws-0-<region>.pooler.supabase.com:5432/postgres?sslmode=require`
   - Con modo *Transaction* (6543) añadir `&pgbouncer=true`. Se recomienda *Session* (5432): las transferencias usan transacciones con `SELECT ... FOR UPDATE`.
   - Si la contraseña tiene caracteres especiales, codificarlos en URL.
4. Aplicar el esquema **una vez** desde tu máquina (necesita Java 17+), con la misma cadena en formato JDBC:
   ```bash
   cd backend
   export LIQUIBASE_COMMAND_URL="jdbc:postgresql://aws-0-<region>.pooler.supabase.com:5432/postgres?sslmode=require"
   export LIQUIBASE_COMMAND_USERNAME="postgres.<ref>"
   export LIQUIBASE_COMMAND_PASSWORD="<PASSWORD>"
   npm run db:status   # revisar cambios pendientes
   npm run db:update   # v1 esquema, v2 auditoría, v3 sesión/admin/roles, v4 RLS
   ```
   Las variables de entorno tienen prioridad sobre `db/liquibase.properties` (que solo trae credenciales de desarrollo local).
5. `v4_seguridad_rls.yaml` activa RLS en todas las tablas y quita privilegios a `anon`/`authenticated`: sin esto, la *anon key* pública de Supabase podría leer las tablas. El backend usa el rol propietario, que no se ve afectado.
6. (Opcional, desarrollo/demo) cargar datos demo: `DATABASE_URL=... npm run db:seed`. **No ejecutar en producción real** (contraseña demo `123456`).
7. Backups: activar los automáticos del plan (o PITR) y anotarlo para el informe (capítulo 3.2).

## 2. Railway (backend)

- *Root Directory*: `backend`. Se usa `backend/railway.json` (build `npm run build`, start `node dist/main`, healthcheck `/api/health`).
- `npm install` ejecuta `prisma generate` (script `postinstall`).
- Variables (pestaña *Variables*):

| Variable | Valor | Obligatoria |
|---|---|---|
| `NODE_ENV` | `production` | Sí |
| `DATABASE_URL` | Cadena del Session pooler (paso 1.3) | Sí |
| `JWT_SECRET` | Aleatorio largo (≥ 32 caracteres), p. ej. `openssl rand -base64 48` | Sí (no arranca sin él) |
| `CORS_ORIGINS` | URL pública de Vercel, sin `/` final, separadas por coma si hay varias | Sí (no arranca sin él) |
| `SENTRY_DSN` | DSN del proyecto Node/NestJS en Sentry | Recomendada |
| `SENTRY_ENVIRONMENT` | `production` | No |
| `SENTRY_TRACES_SAMPLE_RATE` | `0.1` | No |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | Proveedor de correo real | Sí, para recuperación de contraseña (sin SMTP el OTP solo se escribe en logs) |
| `MAX_ACCOUNTS_PER_CLIENT`, `TRANSFER_LIMIT_PER_OPERATION`, `TRANSFER_LIMIT_DAILY` | Reglas de negocio (valores provisionales por defecto) | No |
| `ENABLE_SWAGGER` | `true` solo si se quiere `/api/docs` en producción | No |

- `PORT` lo inyecta Railway. El servidor escucha en `0.0.0.0` y confía en el proxy (`trust proxy`) para ver la IP real en el rate limiting.
- Tras desplegar, generar el dominio público (HTTPS lo da Railway) y comprobar `https://<dominio>/api/health` → `{"status":"ok","database":"up"}`.

## 3. Vercel (frontend)

- *Root Directory*: `frontend`. Framework: Next.js (detectado).
- Variable: `NEXT_PUBLIC_API_URL` = `https://<dominio-railway>/api` (con `/api`, sin `/` final). Se hornea en el build: si cambia, hay que volver a desplegar.
- Después, poner la URL de Vercel en `CORS_ORIGINS` de Railway. Si usas *preview deployments*, añadir cada origen o usar un dominio fijo.

## 4. Sentry

- **Backend** (ya implementado): `src/instrument.ts` + `SentryGlobalFilter`. Solo se activa con `SENTRY_DSN`. Se eliminan cuerpos de petición, cookies, query strings y cabeceras `Authorization`/`Idempotency-Key`. Muestreo de trazas por `SENTRY_TRACES_SAMPLE_RATE`. `release` usa `RAILWAY_GIT_COMMIT_SHA`.
- **Frontend**: pendiente (requiere cambios en `frontend/`: `@sentry/nextjs`, `instrumentation*.ts`, `next.config`). Variables previstas: `NEXT_PUBLIC_SENTRY_DSN`, y `SENTRY_AUTH_TOKEN`/`SENTRY_ORG`/`SENTRY_PROJECT` en Vercel (solo build) para subir *source maps*.
- Prueba de humo sugerida para el informe: provocar un error controlado en un entorno de prueba y capturar el evento en Sentry.

## 5. Verificación posterior (evidencias para APF2)

1. `GET /api/health` → 200 con `database: up`.
2. Login desde la URL de Vercel; en Supabase (*Table editor*) se ve la fila nueva en `sesion`.
3. CORS: petición con `Origin: https://malo.com` no recibe `Access-Control-Allow-Origin`.
4. Cabeceras: `curl -I https://<dominio-railway>/api/health` muestra `Strict-Transport-Security`, `X-Content-Type-Options`, `Content-Security-Policy`.
5. Rate limit: 11 logins seguidos devuelven 429 en el 11.º.
6. `/api/users` y `/api/admin/metrics` sin token → 401; con token de cliente → 403.
7. Supabase → *Advisors*: verificar que no queden alertas de tablas sin RLS.

## 6. Pendientes conocidos que afectan producción

- Crear un administrador real en `admin`/`admin_rol` (el seed demo usa contraseña `123456`) y no cargar el seed en producción.
- Reglas de negocio con valores provisionales (límites, máximo de cuentas) por confirmar.
- Bloqueo por intentos fallidos y OTP de recuperación siguen en memoria (se pierden al reiniciar/escalar a más de una instancia).
- El backend usa el rol `postgres` de Supabase; un rol de aplicación con mínimo privilegio queda como mejora.
