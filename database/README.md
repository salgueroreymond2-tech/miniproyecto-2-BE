# Base de datos PostgreSQL de NexoTico

## Orden de ejecución

En el SQL Editor de un proyecto Supabase, ejecute los archivos en este orden:

1. `extensions.sql`
2. `schema.sql`
3. `indexes.sql`
4. `permissions.sql`
5. `seed.sql` (solo desarrollo y demostración)

Los scripts se destinan a una base nueva. Para entornos ya creados deben convertirse en migraciones revisadas; no ejecute `schema.sql` sobre datos existentes.

## Enlace seguro desde backend

Use exclusivamente una variable de servidor, nunca una variable publicada al navegador:

```env
DATABASE_URL=postgresql://usuario:contrasena@host:5432/postgres?sslmode=require
DATABASE_POOL_MAX=10
DATABASE_IDLE_TIMEOUT_MS=30000
```

`backend/src/config/database.js` crea el pool de `pg`; `backend/src/repositories/colaboradoresRepository.js` muestra consultas parametrizadas. El backend no inicia una conexión hasta que recibe una consulta, de modo que el proyecto puede ejecutarse sin credenciales externas. Si se usa Supabase Auth, `usuarios.id` debe coincidir con `auth.uid()` para que las políticas RLS se apliquen a la identidad correcta.

No exponga `DATABASE_URL`, contraseña de base de datos ni una service-role key a Vite, React ni archivos con prefijo `VITE_`.

## Supuesto de campos

El documento académico que define un catálogo exacto de campos no estaba en el repositorio. El esquema implementa campos operativos derivados de las políticas de NexoTico (identidad ficticia, puesto, departamento, fechas, estados, saldos, solicitudes, movimientos y métricas). Antes de usarlo en producción o evaluación final, compare cada tabla con ese documento y cree una migración para cualquier campo adicional, sin alterar los datos históricos de forma destructiva.

## Embeddings

`fragmentos_documentos.embedding` es `vector(768)` y la restricción de tabla fija `gemini-embedding-001` con dimensión 768. Un cambio de modelo o dimensión requiere migración, re-embebido completo e índice nuevo; nunca inserte embeddings distintos en el mismo corpus.

## Datos de demostración

`seed.sql` carga únicamente identidades y hechos ficticios deterministas. Las dos cuentas de demostración contienen hashes bcrypt, no contraseñas en texto plano. Antes de habilitar autenticación real, provisione o rote esas credenciales desde un canal secreto.

