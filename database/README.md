# Almacenamiento de NexoTico

MySQL 8 / `portal_rrhh` contiene información administrativa y fragmentos documentales. `mysql/schema.sql` es el esquema inicial aplicado por la primera migración Sequelize; migraciones posteriores crean `document_chunks` y `document_chunks_e5`. `mysql/reports.sql` contiene consultas de indicadores y `mysql/roles.sql` ejemplos de mínimos privilegios.

`document_chunks_e5.document_id` es una clave foránea física hacia `documentos.id`. La tabla activa almacena vectores JSON de 384 componentes y restringe el modelo a `Xenova/multilingual-e5-small`. `document_chunks` conserva por separado los vectores antiguos de 768 componentes; la búsqueda actual no los compara ni los borra.

## Consulta y publicación

Desde `backend/`, `npm run db:migrate` aplica las migraciones pendientes. No uses `sync({ force: true })` ni vuelvas a ejecutar el esquema inicial sobre una base ya poblada. Las migraciones MySQL con DDL tienen confirmación implícita y deben revisarse ante cualquier error.

La búsqueda calcula la similitud coseno exacta en el backend, leyendo fragmentos activos por lotes bajo una transacción de lectura consistente. `RAG_TOP_K` controla el máximo y `RAG_SIMILARITY_THRESHOLD` el umbral. El costo crece con el número de fragmentos: no existe índice ANN o HNSW en esta implementación.

Los fragmentos nuevos quedan pendientes e inactivos. `publishVersion` comprueba que el documento esté validado, que coincida la versión y que exista una secuencia completa de fragmentos antes de activar la versión dentro de una transacción MySQL. Un bloqueo de la fila del documento serializa las escrituras del servicio. La validación humana del contenido debe hacerse antes de cambiar el estado del documento a `VALIDADO`.

Las restricciones de privilegios se configuran con `mysql/roles.sql` después de revisión. La autorización por usuario y rol sigue siendo responsabilidad del backend; no se usa RLS de PostgreSQL.

El modelo local `Xenova/multilingual-e5-small` utiliza los prefijos `query: ` y `passage: `, mean pooling y normalización. Véase la [tarjeta del modelo original](https://huggingface.co/intfloat/multilingual-e5-small).

## Archivos históricos

Los scripts de PostgreSQL y Supabase anteriores se retiraron del árbol, pero se pueden recuperar desde Git. No se han borrado ni modificado datos remotos.

El enunciado académico original no estaba disponible al diseñar las tablas. Compara los campos con ese documento antes de afirmar cobertura total.
