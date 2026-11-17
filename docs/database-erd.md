# Diagrama entidad-relación — NexoTico

```mermaid
erDiagram
  USUARIOS ||--o| COLABORADORES : vincula
  COLABORADORES ||--o{ SALDOS_VACACIONES : posee
  COLABORADORES ||--o{ SOLICITUDES : crea
  USUARIOS ||--o{ SOLICITUDES : resuelve
  COLABORADORES ||--o{ INCAPACIDADES : registra
  DOCUMENTOS ||--o{ INCAPACIDADES : respalda
  COLABORADORES ||--o{ MOVIMIENTOS_PERSONAL : tiene
  USUARIOS ||--o{ MOVIMIENTOS_PERSONAL : registra
  COLABORADORES ||--o{ EVALUACIONES_DESEMPENO : recibe
  COLABORADORES ||--o{ EVALUACIONES_DESEMPENO : evalua
  USUARIOS ||--o{ DOCUMENTOS : publica
  DOCUMENTOS ||--o{ FRAGMENTOS_DOCUMENTOS : divide
  USUARIOS ||--o{ CONSULTAS_CHAT : realiza
  CONSULTAS_CHAT ||--o{ LOGS_AGENTES : audita

  USUARIOS {
    uuid id PK
    citext email UK
    rol_usuario rol
    boolean activo
  }
  COLABORADORES {
    uuid id PK
    uuid usuario_id FK
    varchar codigo UK
    varchar departamento
    estado_colaborador estado
  }
  SALDOS_VACACIONES {
    uuid id PK
    uuid colaborador_id FK
    smallint periodo_anual
    numeric dias_disponibles
  }
  SOLICITUDES {
    uuid id PK
    uuid colaborador_id FK
    estado_solicitud estado
    date fecha_inicio
    date fecha_fin
  }
  INCAPACIDADES {
    uuid id PK
    uuid colaborador_id FK
    varchar referencia_ccss UK
    date fecha_inicio
    date fecha_fin
  }
  MOVIMIENTOS_PERSONAL {
    uuid id PK
    uuid colaborador_id FK
    tipo_movimiento tipo
    date fecha_efectiva
  }
  EVALUACIONES_DESEMPENO {
    uuid id PK
    uuid colaborador_id FK
    uuid evaluador_colaborador_id FK
    estado_evaluacion estado
  }
  DOCUMENTOS {
    uuid id PK
    varchar titulo
    clasificacion_documento clasificacion
    estado_documento estado
  }
  FRAGMENTOS_DOCUMENTOS {
    uuid id PK
    uuid documento_id FK
    vector embedding
    varchar embedding_model
  }
  CONSULTAS_CHAT {
    uuid id PK
    uuid usuario_id FK
    varchar agente_codigo
  }
  LOGS_AGENTES {
    bigint id PK
    uuid consulta_chat_id FK
    estado_log estado
  }
  CALENDARIO_PAGOS {
    uuid id PK
    date fecha_pago UK
    varchar tipo
  }
  SINCRONIZACIONES {
    uuid id PK
    varchar origen
    estado_sincronizacion estado
  }
  REPORTES_DIARIOS {
    bigint id PK
    date fecha
    varchar departamento
  }
```

## Nota de modelado

El documento académico con un catálogo de campos no estaba disponible en el repositorio al crear este esquema. Los campos implementados se derivan de las políticas aprobadas y del objetivo de indicadores; deben compararse con ese documento antes de una migración productiva.

