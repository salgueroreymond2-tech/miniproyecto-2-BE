# Almacenamiento de NexoTico

MySQL 8 / `portal_rrhh` contiene únicamente información administrativa. `mysql/schema.sql` es el esquema fuente que aplica la migración Sequelize; `mysql/reports.sql` contiene consultas de indicadores y `mysql/roles.sql` ejemplos de mínimos privilegios.

Supabase contiene únicamente `public.document_chunks`. `document_id` referencia lógicamente `documentos.id` en MySQL: no existe transacción ni clave foránea entre los dos sistemas.

## SQL Editor de Supabase

En un proyecto de desarrollo, revisa y ejecuta **una sola vez**, en orden:

1. `supabase/01_extensions.sql`
2. `supabase/02_tables.sql`
3. `supabase/03_indexes.sql`
4. `supabase/04_match_documents.sql`
5. `supabase/05_security.sql`

Si `vector` ya existe fuera del esquema `extensions`, el primer script se detendrá para evitar modificar la instalación; las referencias deben adaptarse a ese esquema antes de continuar. La extensión debe soportar HNSW. Los scripts se deben probar con las credenciales reales antes de su uso en producción.

Los nuevos fragmentos se guardan inactivos y pendientes. `publish_document_version` comprueba el número y la secuencia antes de activar una versión completa y desactivar la anterior en una transacción de Supabase. El llamador debe comprobar previamente la validación humana del documento y reconciliar su estado en MySQL. La función no crea por sí sola una transacción distribuida ni sustituye el proceso de ingesta.

Modelo fijado: `gemini-embedding-001` con `outputDimensionality=768`; Google admite dimensiones de salida reducidas para este modelo. `embedding_model` impide mezclar otro modelo. Cambiar modelo/dimensión requiere migrar, regenerar vectores y reconstruir índices. Índice HNSW por distancia coseno: [Supabase HNSW](https://supabase.com/docs/guides/ai/vector-indexes/hnsw-indexes); [API Gemini](https://ai.google.dev/gemini-api/docs/migrate).

## Archivos históricos

Los scripts PostgreSQL anteriores `extensions.sql`, `schema.sql`, `indexes.sql`, `permissions.sql`, `seed.sql` y `auth-permissions.sql` están conservados solo como historial local. **No los ejecutes en Supabase para la arquitectura actual**: contienen tablas administrativas, incompatibles con la separación solicitada. No se han borrado ni modificado datos remotos.

El enunciado académico original no estaba disponible al diseñar las tablas. Compara los campos con ese documento antes de afirmar cobertura total.
