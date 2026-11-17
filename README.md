# NexoTico — portal de personas

## Iniciar el backend

Se requiere Node.js 22.12 o posterior y una base PostgreSQL de desarrollo con el esquema de `database/` aplicado. Copia `backend/.env.example` a `backend/.env`, configura `DATABASE_URL` con la conexión de servidor y define `JWT_SECRET` como un valor aleatorio privado de al menos 32 caracteres. Para generarlo localmente:

```powershell
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

No compartas el valor generado. En `backend/`, ejecuta `npm install` y `npm run dev`. El servicio inicia en `http://localhost:3000`, Swagger está en `http://localhost:3000/api/docs` y `npm run db:verify` comprueba la conexión. El servidor puede iniciar sin conexión, pero el login necesita una base disponible y usuarios activos con hashes bcrypt válidos.

En Supabase aplica además `database/auth-permissions.sql` después de `permissions.sql`. La conexión de aplicación debe usar un usuario de base de datos dedicado, sin propiedad de tablas ni `BYPASSRLS`, con membresía heredable en `nexotico_backend`; la configuración de esa cuenta queda a cargo del administrador de la base. No uses la contraseña administrativa ni las claves privilegiadas en el frontend. La API comprueba el usuario y su rol en cada solicitud; el JWT propio de la API no habilita acceso directo a la API de datos de Supabase.

Para establecer la contraseña de un usuario ya creado en desarrollo, ejecuta `npm run user:set-password` desde una terminal interactiva en `backend/`. El proceso pide el correo y la contraseña sin mostrarla y actualiza el hash mediante una consulta parametrizada. Este paso administrativo requiere temporalmente una conexión con permiso de actualización de `usuarios.password_hash`; restaura la conexión de mínimo privilegio antes de ejecutar la API. La contraseña no debe enviarse por chat ni guardarse en el repositorio.

## Iniciar el frontend

En `frontend/`, ejecuta `npm install` y `npm run dev`, luego abre `http://localhost:5173`. Vite envía las llamadas `/api` al backend local. La sesión se mantiene en memoria y se pierde al recargar; cerrar sesión descarta el token en el navegador, pero no lo revoca en el servidor antes de su vencimiento. Los cambios de rol o la desactivación se comprueban nuevamente en cada llamada al servidor.

## Pruebas

Ejecuta `npm test` en `backend/` y `frontend/`; `npm run build` en `frontend/` valida la compilación. Las pruebas de API usan repositorios aislados, por lo que no sustituyen una prueba de integración con Supabase real ni comprueban las políticas RLS de la base.

El límite de inicio de sesión se guarda en memoria por instancia (cinco solicitudes por IP cada quince minutos). Antes de ejecutar múltiples réplicas se requiere un almacén compartido y configuración explícita del proxy; no se debe habilitar `trust proxy` sin conocer la topología de despliegue.

