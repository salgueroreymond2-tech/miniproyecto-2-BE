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

## Ingesta documental desde Google Drive

1. Habilita Google Drive API y crea una clave JSON de cuenta de servicio con acceso de solo lectura. Guarda el archivo fuera del repositorio y comparte la carpeta documental con el correo de esa cuenta, con permiso **Lector**.
2. Completa `GOOGLE_APPLICATION_CREDENTIALS` en `backend/.env` con la ruta local del JSON y confirma `GOOGLE_DRIVE_FOLDER_ID`. No copies el JSON, su clave privada ni sus valores al repositorio.
3. Desde `backend/`, ejecuta `npm run db:migrate` para agregar los datos de aprobación documental. La ingesta utiliza únicamente MySQL/Sequelize y el embedding local E5.
4. Con un JWT de RRHH, consulta `GET /api/admin/ingestion/candidates`. Revisa cada documento directamente en Drive y aprueba el hash exacto mediante `POST /api/admin/ingestion/approvals`, aportando categoría, URLs oficiales y las atestaciones `reviewedNormativeContent: true` y `reviewedNoPersonalData: true`. Los hashes modificados pierden la aprobación.
5. Ejecuta `POST /api/admin/ingestion/pilot` con `{"driveFileId":"<ID elegido>"}` para procesar únicamente el documento aprobado seleccionado. Verifica el resultado y luego usa `POST /api/admin/ingestion/sync` para el resto. La sincronización consume `changes.list` y reconcilia el árbol de carpetas para detectar movimientos y eliminaciones; `GET /api/admin/ingestion/status` informa su estado.

Se admiten PDF, DOCX, XLSX, TXT, Google Docs y Google Sheets. La detección automática de datos personales es una barrera adicional, no una garantía; el control depende también de la revisión humana antes de aprobar. Los documentos no aprobados no generan fragmentos ni embeddings.

Los fragmentos objetivo son de 350–450 tokens, con solapamiento de 50–80 tokens y un máximo efectivo de 512 tokens para E5 contando el prefijo y tokens especiales. Si el documento es muy corto o su longitud hace matemáticamente imposible cubrir todo el texto dentro de ambos rangos, se conserva íntegro el fragmento final aunque sea menor de 350 tokens; no se trunca contenido.

## Reportes diarios de RRHH

Las definiciones y fórmulas de indicadores están en [`docs/reports.md`](docs/reports.md). La migración `npm run db:migrate` crea el registro idempotente de trabajos y sus índices; las lecturas requieren `DB_READ_USER` y `DB_READ_PASSWORD` con privilegio `SELECT`. El servidor debe permanecer activo para que `node-cron` sincronice Drive a las 06:00 y genere el reporte a las 07:00 en `America/Costa_Rica`. Los endpoints `/api/reports/*` requieren un JWT con rol `RRHH` y consultan los reportes ya almacenados.

## Seguridad y pruebas

`npm test` en `backend/` y `frontend/` ejecuta las pruebas automatizadas aisladas. Para ejecutar la integración MySQL real desde PowerShell en `backend/`, usa `$env:MYSQL_INTEGRATION='1'; node --test test/mysql-vector.integration.test.js`. La prueba usa una transacción que se revierte. La sesión autenticada del frontend se conserva en `sessionStorage` para restaurarse al recargar la pestaña y se elimina al cerrar sesión; el servidor no revoca el token antes de su vencimiento. El límite de login se almacena en memoria por instancia: en despliegues con varias instancias se necesita un almacén compartido y configuración de proxy revisada.

El servicio limita las categorías y metadatos que acepta, pero **no puede demostrar por sí solo que el contenido esté libre de datos personales**: se requiere validación humana antes de publicar. Los fragmentos referencian físicamente sus documentos con una clave foránea en MySQL. MySQL 8 almacena los vectores en JSON y el backend calcula similitud coseno exacta por lotes; este enfoque escala peor que un índice vectorial especializado y debe evaluarse con el volumen real.

La tabla activa del modelo E5 es `document_chunks_e5`. Los vectores anteriores permanecen separados en `document_chunks` y no participan en la búsqueda; es necesario generar embeddings E5 nuevos antes de recuperar contenido anterior. El umbral configurado de similitud debe calibrarse con preguntas evaluadas del proyecto.

Las configuraciones y scripts PostgreSQL/Supabase anteriores se retiraron del árbol del proyecto y pueden recuperarse en el historial de Git. No se ha eliminado ningún dato de servicios remotos.
