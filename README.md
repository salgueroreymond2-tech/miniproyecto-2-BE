# NexoTico — portal de Recursos Humanos

MySQL 8 es la fuente de verdad administrativa y usa Sequelize/mysql2. Supabase con pgvector almacena solo fragmentos documentales autorizados para el RAG. El backend Express gestiona JWT y bcrypt; el navegador nunca recibe credenciales de bases de datos ni claves privilegiadas.

## Preparación local

1. Completa `backend/.env` con tus credenciales. El archivo está excluido de Git: no compartas sus valores. `DB_READ_USER` y `DB_READ_PASSWORD` deben corresponder a una cuenta distinta con solo lectura. Para `JWT_SECRET` usa un valor aleatorio privado de al menos 32 caracteres.
2. Crea la base MySQL con una cuenta administradora:

   ```sql
   CREATE DATABASE IF NOT EXISTS portal_rrhh CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```

3. Desde `backend/`, ejecuta `npm install`, `npm run db:mysql:verify` y `npm run db:migrate`. Las migraciones se han diseñado para una base nueva: no usan `sync({ force: true })` ni eliminan datos, y DDL MySQL no es transaccional.
4. Solo en una base de desarrollo vacía, establece una contraseña temporal privada de al menos 12 caracteres en `DEMO_PASSWORD` y ejecuta `npm run db:seed`. El seeder crea 50 cuentas y colaboradores ficticios; los dos primeros usuarios son RRHH. El historial del seeder evita repetirlo; no lo ejecutes sobre datos reales.
5. Ejecuta los scripts de Supabase en el orden descrito en [database/README.md](database/README.md) y verifica con `npm run db:supabase:verify`. El cliente admite `SUPABASE_SECRET_KEY` o la clave anterior `SUPABASE_SERVICE_ROLE_KEY`, exclusivamente en el backend.
6. Desde `backend/`, ejecuta `npm run dev`; desde `frontend/`, ejecuta `npm install` y `npm run dev`. Abre `http://localhost:5173`; la documentación de la API está en `http://localhost:3000/api/docs`.

Los roles y privilegios de ejemplo están en `database/mysql/roles.sql`. Ejecuta migraciones y seed con una cuenta de instalación y usa cuentas separadas de mínimo privilegio para la API y las consultas de solo lectura. Para cambiar una contraseña existente, `npm run user:set-password` solicita la nueva contraseña en una terminal sin eco y requiere temporalmente permiso de actualización del hash.

## Seguridad y pruebas

`npm test` en `backend/` y `frontend/` ejecuta las pruebas automatizadas aisladas. Estas no sustituyen las pruebas contra MySQL y Supabase reales. La sesión del frontend vive en memoria; cerrar sesión elimina el token local, pero no lo revoca antes de su vencimiento. El límite de login se almacena en memoria por instancia: en despliegues con varias instancias se necesita un almacén compartido y configuración de proxy revisada.

La clave secreta Supabase omite RLS. El servicio limita las categorías y metadatos que acepta, pero **no puede demostrar por sí solo que el contenido esté libre de datos personales**: se requiere validación humana antes de publicar. `document_id` es una referencia lógica a MySQL, no una clave foránea entre bases de datos; la sincronización entre almacenes necesita reconciliación y no comparte transacciones.

Los scripts PostgreSQL que existían directamente en `database/` son históricos e incompatibles con esta arquitectura. No los ejecute para crear tablas administrativas en Supabase. No se ha eliminado ningún dato de un proyecto remoto.
