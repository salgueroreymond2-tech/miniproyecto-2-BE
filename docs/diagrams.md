# Diagramas del sistema

Los diagramas representan la arquitectura y flujos inspeccionados en el repositorio al 18/11/2026. Las integraciones externas se dibujan aunque su disponibilidad real estuviera bloqueada durante la última evaluación. Los agentes se implementan bajo `backend/src/services/`.

## 1. Arquitectura general

```mermaid
flowchart LR
  B[Browser React / Vite]
  AX[Axios /api]
  EX[Express 5 API]
  AUTH[JWT, roles, Zod, Helmet, CORS, rate limit]
  OR[Orquestador]
  POL[Agente políticas RAG]
  EMP[Agente datos del colaborador]
  ANA[Agente analista]
  ING[Agente ingesta determinista]
  MY[(MySQL 8 / Sequelize / mysql2)]
  E5[Transformers local: E5 384d]
  DS[DeepSeek API]
  GD[Google Drive API readonly]
  CRON[node-cron America/Costa_Rica]

  B --> AX --> EX --> AUTH
  AUTH --> OR
  OR --> POL
  OR --> EMP
  OR --> ANA
  EX --> ING
  POL --> E5
  POL --> MY
  POL --> DS
  EMP --> MY
  EMP --> DS
  ANA --> MY
  ANA --> DS
  ING --> GD
  ING --> E5
  ING --> MY
  CRON --> ING
  CRON --> ANA
```

## 2. Entidad-relación MySQL

```mermaid
erDiagram
  USUARIOS ||--o| COLABORADORES : perfil
  DEPARTAMENTOS ||--o{ PUESTOS : contiene
  DEPARTAMENTOS ||--o{ COLABORADORES : asigna
  PUESTOS ||--o{ COLABORADORES : ocupa
  COLABORADORES ||--o{ SALDOS_VACACIONES : acumula
  COLABORADORES ||--o{ SOLICITUDES : presenta
  COLABORADORES ||--o{ INCAPACIDADES : registra
  COLABORADORES ||--o{ MOVIMIENTOS_PERSONAL : tiene
  COLABORADORES ||--o{ EVALUACIONES_DESEMPENO : recibe
  COLABORADORES o|--o{ EVALUACIONES_DESEMPENO : evalua
  USUARIOS ||--o{ CONVERSACIONES : crea
  CONVERSACIONES ||--o{ CONSULTAS_CHAT : contiene
  USUARIOS ||--o{ CONSULTAS_CHAT : realiza
  COLABORADORES o|--o{ CONSULTAS_CHAT : vincula
  CONSULTAS_CHAT ||--o{ LOGS_AGENTES : audita
  USUARIOS ||--o{ INGESTION_APPROVALS : aprueba
  DOCUMENTOS ||--o{ DOCUMENT_CHUNKS_E5 : contiene

  USUARIOS {
    char36 id PK
    varchar email UK
    varchar password_hash
    enum rol
    boolean activo
  }
  DEPARTAMENTOS {
    char36 id PK
    varchar nombre UK
  }
  PUESTOS {
    char36 id PK
    char36 departamento_id FK
    varchar nombre
  }
  COLABORADORES {
    char36 id PK
    char36 usuario_id FK
    char36 departamento_id FK
    char36 puesto_id FK
    varchar codigo UK
    date fecha_ingreso
    enum estado
  }
  SALDOS_VACACIONES {
    char36 id PK
    char36 colaborador_id FK
    smallint periodo_anual
    decimal dias_disponibles
  }
  SOLICITUDES {
    char36 id PK
    char36 colaborador_id FK
    enum tipo
    enum estado
    date fecha_inicio
    date fecha_fin
  }
  INCAPACIDADES {
    char36 id PK
    char36 colaborador_id FK
    date fecha_inicio
    date fecha_fin
    enum estado
  }
  MOVIMIENTOS_PERSONAL {
    char36 id PK
    char36 colaborador_id FK
    enum tipo
    date fecha_efectiva
    json detalle
  }
  CALENDARIO_PAGOS {
    char36 id PK
    date fecha_pago UK
    enum tipo
    enum estado
  }
  EVALUACIONES_DESEMPENO {
    char36 id PK
    char36 colaborador_id FK
    char36 evaluador_id FK
    date periodo_inicio
    date periodo_fin
  }
  CONVERSACIONES {
    char36 id PK
    char36 usuario_id FK
    varchar titulo
    varchar tema
  }
  CONSULTAS_CHAT {
    char36 id PK
    char36 usuario_id FK
    char36 conversacion_id FK
    enum intencion
    enum resolucion
    json fragmentos_utilizados
    json citas_documentales
  }
  REPORTES_DIARIOS {
    char36 id PK
    date fecha UK
    json metricas
  }
  DOCUMENTOS {
    char36 id PK
    varchar drive_file_id UK
    varchar version
    enum estado
    char64 content_hash
  }
  DOCUMENT_CHUNKS_E5 {
    char36 id PK
    char36 document_id FK
    int chunk_index
    varchar embedding_model
    json embedding
    json metadata
    boolean is_active
  }
  SINCRONIZACIONES {
    char36 id PK
    varchar origen
    enum estado
    datetime inicio_en
  }
  LOGS_AGENTES {
    char36 id PK
    char36 consulta_chat_id FK
    varchar agente
    enum estado
  }
  INGESTION_APPROVALS {
    char36 id PK
    varchar drive_file_id
    char64 content_hash
    char36 approved_by FK
    json legal_sources
  }
  TRABAJOS_PROGRAMADOS {
    char36 id PK
    varchar clave_ejecucion UK
    varchar tarea
    enum estado
    json resultado
  }
```

El ER resume las tablas del SQL base y migraciones. `drive_ingestion_state` y `vector_cache_state` son tablas de control y no se incluyen como entidades de negocio. Las versiones antiguas de `document_chunks` no participan en la recuperación activa E5.

## 3. Flujo de autenticación

```mermaid
sequenceDiagram
  actor U as Usuario
  participant F as Frontend
  participant A as Express /auth
  participant V as Zod y rate limit
  participant R as Auth repository
  participant M as MySQL usuarios
  participant J as JWT middleware
  U->>F: email + contraseña
  F->>A: POST /api/auth/login
  A->>V: validar payload y límite
  V->>R: buscar usuario activo
  R->>M: SELECT parametrizado
  M-->>R: hash bcrypt y rol
  R-->>A: campos mínimos
  A->>A: bcrypt.compare + firmar JWT con expiración
  A-->>F: token + perfil permitido
  F->>F: guardar token en sessionStorage
  F-->>U: redirigir según rol
  F->>J: solicitud API con Bearer JWT
  J->>J: verificar firma, expiración y estado
  J-->>F: req.user confiable / 401 / 403
```

## 4. Arquitectura multiagente

```mermaid
flowchart TD
  Q[Pregunta y usuario autenticado] --> S{Regla de seguridad determinista}
  S -->|tercero o salario individual| X[Rechazar sin delegar]
  S -->|consulta permitida| C[DeepSeek: clasificación estructurada + Zod]
  C -->|ambigua / baja confianza| CL[Aclaración]
  C -->|POLITICA| P[Agente RAG políticas]
  C -->|DATO_PERSONAL| D[Agente datos propios]
  C -->|MIXTA| PM[Políticas + datos propios en paralelo]
  C -->|REPORTE| R{Rol RRHH verificado por backend}
  R -->|no| X
  R -->|sí| A[Analista: snapshot SQL persistido]
  C -->|FUERA_DE_ALCANCE| O[Orientar a Recursos Humanos]
  P --> Z[Combinar contrato y auditoría]
  D --> Z
  PM --> Z
  A --> Z
  X --> Z
  CL --> Z
  O --> Z
  Z --> DB[(consultas_chat / conversaciones MySQL)]
  Z --> OUT[Respuesta sin razonamiento interno]
```

## 5. Pipeline RAG

```mermaid
sequenceDiagram
  actor U as Colaborador
  participant O as Orquestador
  participant E as E5 local
  participant S as Vector store MySQL
  participant D as DeepSeek
  participant P as Policies agent
  U->>O: consulta de política
  O->>O: control de acceso e intención
  O->>P: delegar POLITICA
  P->>E: consulta con prefijo query:
  E-->>P: vector normalizado de 384 dimensiones
  P->>S: leer fragmentos activos y validados
  S->>S: similitud coseno, threshold, top 5
  S-->>P: fragmentos y metadatos
  alt sin evidencia suficiente
    P-->>O: abstención y contacto RRHH
  else hay evidencia
    P->>D: pregunta + fragmentos acotados, JSON
    D-->>P: afirmaciones y IDs de fragmentos
    P->>P: Zod + pertenencia literal + citas MySQL
    alt respuesta verificable
      P-->>O: respuesta citada
    else no verificable
      P-->>O: abstención
    end
  end
  O->>S: persistir auditoría en MySQL
  O-->>U: answer + citas + resolución
```

## 6. Ingesta de Google Drive

```mermaid
flowchart TD
  START[RRHH solicita candidatos o sincronización] --> AUTH[JWT + rol RRHH]
  AUTH --> DRIVE[Drive API con scope drive.readonly]
  DRIVE --> LIST[Listar carpeta o consultar changes.list]
  LIST --> EXTRACT[PDF / DOCX / XLSX / TXT / Google Docs / Sheets]
  EXTRACT --> CHECK[Normalizar, secciones, hash y filtro PII]
  CHECK -->|sospecha PII| EXCL[Excluir y registrar estado]
  CHECK --> CAND[Guardar candidato en MySQL]
  CAND --> HUMAN[RRHH revisa contenido, norma y datos personales]
  HUMAN -->|No aprobado| WAIT[No crear chunks activos]
  HUMAN -->|Aprobación hash exacto| PILOT[Procesar un documento piloto]
  PILOT --> CHUNK[350-450 tokens objetivo, overlap 50-80, límite 512]
  CHUNK --> E5[passage: + E5 local 384d]
  E5 --> TX[Transacción MySQL: documento + chunks + estado]
  TX --> PUBLISH[Publicación versionada e invalidación de caché]
  LIST --> DELETE[Detectar archivo removido mediante reconciliación]
  DELETE --> TX
  PUBLISH --> STATUS[Registrar sincronización]
```

## 7. Generación del reporte diario

```mermaid
sequenceDiagram
  participant C as node-cron
  participant J as Scheduler
  participant I as Ingestion agent
  participant A as Analyst agent
  participant R as Report repository
  participant DB as MySQL
  participant DS as DeepSeek
  Note over C,J: America/Costa_Rica, proceso Node activo
  C->>J: 06:00
  J->>J: reclamar clave única drive-sync:fecha
  J->>I: sincronizar Drive
  I->>DB: registrar estado
  C->>J: 07:00
  J->>J: reclamar clave única daily-report:fecha
  J->>A: generar solo si no existe snapshot
  A->>R: métricas con SQL agregada parametrizada
  R->>DB: lectura de datos
  DB-->>R: filas agregadas
  R-->>A: métricas
  A->>DS: cifras y frases permitidas (solo resumen)
  DS-->>A: referencias a frases
  A->>A: validar; usar fallback SQL si falla
  A->>DB: insertar reportes_diarios por fecha única
  J->>DB: completar trabajos_programados
  Note over J,DB: Al iniciar, recupera tareas faltantes sin duplicar
```

## Referencias de implementación

- Composición de Express: `backend/src/app.js`; arranque y scheduler: `backend/src/server.js`.
- Esquema: `database/mysql/schema.sql` y `backend/migrations/`.
- Recuperación: `backend/src/services/vector-store.service.js` y `policies.agent.js`.
- Clasificación y ruta: `backend/src/services/orchestrator.agent.js`.
- Ingesta y cron: `backend/src/services/ingestion.agent.js`, `backend/src/jobs/scheduler.js`.
- Métricas y snapshots: `backend/src/services/analyst.agent.js`, `backend/src/repositories/reportRepository.js`.
