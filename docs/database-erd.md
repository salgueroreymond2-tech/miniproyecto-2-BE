# Arquitectura de almacenamiento y relaciones

```mermaid
flowchart LR
  UI[React] --> API[Express - JWT y roles]
  API --> MYSQL[(MySQL: datos administrativos y documentos RAG)]
  DRIVE[Google Drive: contrato futuro] -.-> API
  API --> DEEPSEEK[DeepSeek: generación]
  API --> E5[E5 local: embeddings de 384 dimensiones]
```

```mermaid
erDiagram
  USUARIOS ||--|| COLABORADORES : tiene
  DEPARTAMENTOS ||--o{ PUESTOS : contiene
  DEPARTAMENTOS ||--o{ COLABORADORES : agrupa
  PUESTOS ||--o{ COLABORADORES : asigna
  COLABORADORES ||--o{ SALDOS_VACACIONES : posee
  COLABORADORES ||--o{ SOLICITUDES : presenta
  COLABORADORES ||--o{ INCAPACIDADES : registra
  COLABORADORES ||--o{ MOVIMIENTOS_PERSONAL : tiene
  COLABORADORES ||--o{ EVALUACIONES_DESEMPENO : recibe
  USUARIOS ||--o{ CONSULTAS_CHAT : realiza
  USUARIOS ||--o{ CONVERSACIONES : inicia
  CONVERSACIONES ||--o{ CONSULTAS_CHAT : contiene
  COLABORADORES o|--o{ CONSULTAS_CHAT : identifica
  CONSULTAS_CHAT ||--o{ LOGS_AGENTES : registra
  DOCUMENTOS ||--o{ DOCUMENT_CHUNKS_E5 : contiene
```

La relación `documentos` → `document_chunks_e5` se implementa mediante una clave foránea en MySQL. La tabla anterior se conserva separada y no participa en las búsquedas actuales.

Cada conversación pertenece a un usuario. Las consultas de historial filtran por el usuario autenticado, y una clave de idempotencia única por usuario evita duplicar el registro cuando se reintenta la misma petición. `colaborador_id` es nullable para conservar consultas históricas creadas antes de la asociación al perfil.
