# Guía de despliegue – Belissa Joyas

Arquitectura: **Neon** (PostgreSQL) + **Render** (backend NestJS) + **Vercel** (frontend Next.js). Los tres tienen plan gratuito.
Las imágenes ya van a Cloudinary, así que no se pierden al reiniciar el backend.

## 1. Base de datos (Neon)
1. Crear un proyecto en neon.tech y copiar los datos de conexión (host, base, usuario, contraseña).
2. Desde tu computadora, exportar la estructura y los datos base de tu base local:
   ```
   pg_dump --schema-only --no-owner --no-privileges -U postgres belissa > schema.sql
   pg_dump --data-only --no-owner -U postgres -t configuracion -t nivel_vip -t provincia -t tarifa_envio belissa > datos-base.sql
   ```
3. Cargarlos en Neon (con la cadena de conexión de Neon):
   ```
   psql "<cadena-de-conexion-neon>" -f schema.sql
   psql "<cadena-de-conexion-neon>" -f datos-base.sql
   ```
   No subas `schema.sql` ni `datos-base.sql` al repositorio si contienen datos reales de clientes.
4. Revisar en `configuracion` que `tiempo_abandono_carrito_minutos` valga 60 o más.

## 2. Backend (Render)
Nuevo "Web Service" conectado al repositorio, carpeta raíz `backend`.
- Build command: `npm install --include=dev && npm run build`
- Start command: `npm run start:prod`
- Variables de entorno (ver `backend/.env.example`):
  `DB_HOST, DB_PORT=5432, DB_NAME, DB_USER, DB_PASS, DB_SSL=true, JWT_SECRET` (cadena larga y aleatoria),
  `FRONTEND_URL` (URL de Vercel, sin barra final), `BACKEND_PUBLIC_URL` (URL de Render),
  `MP_ACCESS_TOKEN, CLOUDINARY_*, EMAIL_*, ADMIN_PRINCIPAL_EMAIL, NODE_ENV=production`.
- El plan gratuito se duerme tras 15 minutos sin uso: la primera visita tarda unos segundos y las tareas programadas
  (carritos abandonados, niveles VIP) solo corren mientras está despierto.

## 3. Frontend (Vercel)
Importar el repositorio, carpeta raíz `frontend`, y definir `NEXT_PUBLIC_API_URL` con la URL pública del backend.
Después de publicarlo, copiar la URL de Vercel a `FRONTEND_URL` en Render y volver a desplegar el backend.

## 4. Mercado Pago
- En el panel de Mercado Pago, configurar las notificaciones (webhooks) hacia `https://<tu-backend>/pago/webhook`
  (o definir `NOTIFICATION_URL`). Evento: pagos.
- Para la presentación usar las credenciales de prueba y las tarjetas de prueba de Mercado Pago.

## 5. Verificación posterior
- `GET https://<backend>/categorias` responde 200.
- `GET https://<backend>/auditoria` sin token responde 401.
- Registrar una cuenta con el email de `ADMIN_PRINCIPAL_EMAIL` y comprobar que puede entrar al panel de administración.
- Hacer una compra de prueba completa y confirmar que el pedido aparece confirmado en Pedidos.
