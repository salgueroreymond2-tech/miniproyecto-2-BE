# NexoTico — portal de Recursos Humanos

MySQL 8 almacena los datos administrativos y los fragmentos documentales del RAG mediante Sequelize/mysql2. DeepSeek genera respuestas estructuradas y `Xenova/multilingual-e5-small` genera embeddings de 384 dimensiones localmente. El backend Express gestiona JWT y bcrypt; el navegador nunca recibe credenciales.

## Preparación local

1. Completa `backend/.env` con tus credenciales de MySQL y `DEEPSEEK_API_KEY`. El archivo está excluido de Git: no compartas sus valores. `DB_READ_USER` y `DB_READ_PASSWORD` deben corresponder a una cuenta distinta con solo lectura. Para `JWT_SECRET` usa un valor aleatorio privado de al menos 32 caracteres.
2. Crea la base MySQL con una cuenta administradora:

   ```sql
   CREATE DATABASE IF NOT EXISTS portal_rrhh CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```

3. Desde `backend/`, ejecuta `npm install`, `npm run db:mysql:verify` y `npm run db:migrate`. Las migraciones se han diseñado para una base nueva: no usan `sync({ force: true })` ni eliminan datos, y DDL MySQL no es transaccional.
4. Solo en una base de desarrollo vacía, establece una contraseña temporal privada de al menos 12 caracteres en `DEMO_PASSWORD` y ejecuta `npm run db:seed`. El seeder crea 50 cuentas y colaboradores ficticios; los dos primeros usuarios son RRHH. El historial del seeder evita repetirlo; no lo ejecutes sobre datos reales.
5. Desde `backend/`, ejecuta `npm run ai:verify-embeddings` y `npm run ai:verify-deepseek` para comprobar el modelo local y DeepSeek. La primera carga de E5 descarga el modelo público y lo guarda en `backend/.cache/huggingface`, excluida de Git; las siguientes inferencias son locales.
6. Desde `backend/`, ejecuta `npm run dev`; desde `frontend/`, ejecuta `npm install` y `npm run dev`. Abre `http://localhost:5173`; la documentación de la API está en `http://localhost:3000/api/docs`.

Los roles y privilegios de ejemplo están en `database/mysql/roles.sql`. Ejecuta migraciones y seed con una cuenta de instalación y usa cuentas separadas de mínimo privilegio para la API y las consultas de solo lectura. Para cambiar una contraseña existente, `npm run user:set-password` solicita la nueva contraseña en una terminal sin eco y requiere temporalmente permiso de actualización del hash.

## Seguridad y pruebas

`npm test` en `backend/` y `frontend/` ejecuta las pruebas automatizadas aisladas. Para ejecutar la integración MySQL real desde PowerShell en `backend/`, usa `$env:MYSQL_INTEGRATION='1'; node --test test/mysql-vector.integration.test.js`. La prueba usa una transacción que se revierte. La sesión del frontend vive en memoria; cerrar sesión elimina el token local, pero no lo revoca antes de su vencimiento. El límite de login se almacena en memoria por instancia: en despliegues con varias instancias se necesita un almacén compartido y configuración de proxy revisada.

El servicio limita las categorías y metadatos que acepta, pero **no puede demostrar por sí solo que el contenido esté libre de datos personales**: se requiere validación humana antes de publicar. Los fragmentos referencian físicamente sus documentos con una clave foránea en MySQL. MySQL 8 almacena los vectores en JSON y el backend calcula similitud coseno exacta por lotes; este enfoque escala peor que un índice vectorial especializado y debe evaluarse con el volumen real.

La tabla activa del modelo E5 es `document_chunks_e5`. Los vectores anteriores permanecen separados en `document_chunks` y no participan en la búsqueda; es necesario generar embeddings E5 nuevos antes de recuperar contenido anterior. El umbral configurado de similitud debe calibrarse con preguntas evaluadas del proyecto.

Las configuraciones y scripts PostgreSQL/Supabase anteriores se retiraron del árbol del proyecto y pueden recuperarse en el historial de Git. No se ha eliminado ningún dato de servicios remotos.
