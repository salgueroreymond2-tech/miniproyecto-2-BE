-- Esquema relacional de NexoTico. No contiene datos reales de colaboradores.
-- Requiere ejecutar database/extensions.sql antes de este archivo.

BEGIN;

CREATE TYPE rol_usuario AS ENUM ('COLABORADOR', 'RRHH');
CREATE TYPE estado_colaborador AS ENUM ('ACTIVO', 'INACTIVO', 'SUSPENDIDO');
CREATE TYPE modalidad_trabajo AS ENUM ('PRESENCIAL', 'HIBRIDO', 'TELETRABAJO');
CREATE TYPE tipo_solicitud AS ENUM ('VACACIONES', 'PERMISO_PERSONAL', 'PERMISO_DUELO', 'PERMISO_FORMACION', 'LICENCIA_SIN_GOCE', 'OTRA');
CREATE TYPE estado_solicitud AS ENUM ('PENDIENTE', 'APROBADA', 'RECHAZADA', 'CANCELADA');
CREATE TYPE tipo_movimiento AS ENUM ('INGRESO', 'SALIDA', 'ASCENSO', 'CAMBIO_PUESTO', 'CAMBIO_DEPARTAMENTO');
CREATE TYPE estado_evaluacion AS ENUM ('BORRADOR', 'PENDIENTE', 'COMPLETADA');
CREATE TYPE clasificacion_documento AS ENUM ('INTERNO', 'RESTRINGIDO');
CREATE TYPE estado_documento AS ENUM ('BORRADOR', 'APROBADO', 'ARCHIVADO');
CREATE TYPE estado_sincronizacion AS ENUM ('PENDIENTE', 'EN_PROCESO', 'COMPLETADA', 'FALLIDA');
CREATE TYPE estado_log AS ENUM ('INICIADO', 'COMPLETADO', 'ERROR');

CREATE OR REPLACE FUNCTION establecer_actualizado_en()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.actualizado_en = timezone('utc', now());
  RETURN NEW;
END;
$$;

CREATE TABLE usuarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email CITEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  rol rol_usuario NOT NULL DEFAULT 'COLABORADOR',
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  ultimo_acceso_en TIMESTAMPTZ,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT usuarios_email_formato_valido CHECK (email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  CONSTRAINT usuarios_hash_bcrypt CHECK (password_hash ~ '^\$2[aby]\$[0-9]{2}\$[./A-Za-z0-9]{53}$')
);

CREATE TABLE colaboradores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID UNIQUE REFERENCES usuarios(id) ON DELETE SET NULL,
  codigo VARCHAR(16) NOT NULL UNIQUE,
  identificacion_ficticia VARCHAR(32) NOT NULL UNIQUE,
  nombres VARCHAR(100) NOT NULL,
  apellidos VARCHAR(100) NOT NULL,
  email_corporativo CITEXT NOT NULL UNIQUE,
  telefono VARCHAR(32),
  departamento VARCHAR(100) NOT NULL,
  puesto VARCHAR(120) NOT NULL,
  supervisor_id UUID REFERENCES colaboradores(id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,
  fecha_ingreso DATE NOT NULL,
  fecha_salida DATE,
  modalidad modalidad_trabajo NOT NULL DEFAULT 'HIBRIDO',
  salario_base NUMERIC(14, 2) NOT NULL,
  estado estado_colaborador NOT NULL DEFAULT 'ACTIVO',
  creado_en TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT colaboradores_salario_no_negativo CHECK (salario_base >= 0),
  CONSTRAINT colaboradores_fechas_coherentes CHECK (fecha_salida IS NULL OR fecha_salida >= fecha_ingreso),
  CONSTRAINT colaboradores_salida_estado_coherente CHECK (
    (estado = 'ACTIVO' AND fecha_salida IS NULL) OR estado <> 'ACTIVO'
  )
);

CREATE TABLE saldos_vacaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id UUID NOT NULL REFERENCES colaboradores(id) ON DELETE RESTRICT,
  periodo_anual SMALLINT NOT NULL,
  dias_generados NUMERIC(5, 2) NOT NULL DEFAULT 0,
  dias_disfrutados NUMERIC(5, 2) NOT NULL DEFAULT 0,
  dias_ajuste NUMERIC(5, 2) NOT NULL DEFAULT 0,
  dias_disponibles NUMERIC(5, 2) GENERATED ALWAYS AS (dias_generados + dias_ajuste - dias_disfrutados) STORED,
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT saldos_vacaciones_periodo_valido CHECK (periodo_anual BETWEEN 2000 AND 2100),
  CONSTRAINT saldos_vacaciones_valores_no_negativos CHECK (dias_generados >= 0 AND dias_disfrutados >= 0),
  CONSTRAINT saldos_vacaciones_saldo_no_negativo CHECK (dias_generados + dias_ajuste - dias_disfrutados >= 0),
  CONSTRAINT saldos_vacaciones_colaborador_periodo_unico UNIQUE (colaborador_id, periodo_anual)
);

CREATE TABLE documentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo VARCHAR(250) NOT NULL,
  tipo VARCHAR(80) NOT NULL,
  version VARCHAR(32) NOT NULL,
  fuente_url TEXT,
  contenido TEXT NOT NULL,
  hash_contenido CHAR(64) NOT NULL UNIQUE,
  clasificacion clasificacion_documento NOT NULL DEFAULT 'INTERNO',
  estado estado_documento NOT NULL DEFAULT 'BORRADOR',
  creado_por_usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  publicado_en TIMESTAMPTZ,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT documentos_titulo_no_vacio CHECK (length(btrim(titulo)) > 0),
  CONSTRAINT documentos_contenido_no_vacio CHECK (length(btrim(contenido)) > 0)
);

CREATE TABLE fragmentos_documentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  documento_id UUID NOT NULL REFERENCES documentos(id) ON DELETE CASCADE,
  numero_fragmento INTEGER NOT NULL,
  contenido TEXT NOT NULL,
  tokens_estimados INTEGER NOT NULL DEFAULT 0,
  embedding vector(768),
  embedding_model VARCHAR(80) NOT NULL DEFAULT 'gemini-embedding-001',
  embedding_dimension SMALLINT NOT NULL DEFAULT 768,
  metadatos JSONB NOT NULL DEFAULT '{}'::jsonb,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT fragmentos_documentos_numero_positivo CHECK (numero_fragmento >= 0),
  CONSTRAINT fragmentos_documentos_tokens_no_negativos CHECK (tokens_estimados >= 0),
  -- Una migración explícita es obligatoria para cambiar modelo o dimensión y reindexar el corpus.
  CONSTRAINT fragmentos_documentos_modelo_unico CHECK (
    embedding_model = 'gemini-embedding-001' AND embedding_dimension = 768
  ),
  CONSTRAINT fragmentos_documentos_dimension_vector CHECK (
    embedding IS NULL OR vector_dims(embedding) = embedding_dimension
  ),
  CONSTRAINT fragmentos_documentos_documento_numero_unico UNIQUE (documento_id, numero_fragmento)
);

CREATE TABLE solicitudes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id UUID NOT NULL REFERENCES colaboradores(id) ON DELETE RESTRICT,
  tipo tipo_solicitud NOT NULL,
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE NOT NULL,
  dias_solicitados NUMERIC(5, 2) NOT NULL,
  motivo TEXT,
  estado estado_solicitud NOT NULL DEFAULT 'PENDIENTE',
  resuelta_por_usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  resuelta_en TIMESTAMPTZ,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT solicitudes_rango_valido CHECK (fecha_fin >= fecha_inicio),
  CONSTRAINT solicitudes_dias_positivos CHECK (dias_solicitados > 0),
  CONSTRAINT solicitudes_resolucion_coherente CHECK (
    (estado = 'PENDIENTE' AND resuelta_en IS NULL AND resuelta_por_usuario_id IS NULL)
    OR (estado <> 'PENDIENTE' AND resuelta_en IS NOT NULL)
  )
);

CREATE TABLE incapacidades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id UUID NOT NULL REFERENCES colaboradores(id) ON DELETE RESTRICT,
  documento_id UUID REFERENCES documentos(id) ON DELETE SET NULL,
  referencia_ccss VARCHAR(80) NOT NULL UNIQUE,
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE NOT NULL,
  dias_incapacidad INTEGER GENERATED ALWAYS AS ((fecha_fin - fecha_inicio) + 1) STORED,
  estado VARCHAR(24) NOT NULL DEFAULT 'REGISTRADA',
  creado_en TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT incapacidades_rango_valido CHECK (fecha_fin >= fecha_inicio),
  CONSTRAINT incapacidades_estado_valido CHECK (estado IN ('REGISTRADA', 'EN_REVISION', 'CERRADA'))
);

CREATE TABLE movimientos_personal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id UUID NOT NULL REFERENCES colaboradores(id) ON DELETE RESTRICT,
  tipo tipo_movimiento NOT NULL,
  fecha_efectiva DATE NOT NULL,
  puesto_anterior VARCHAR(120),
  puesto_nuevo VARCHAR(120),
  departamento_anterior VARCHAR(100),
  departamento_nuevo VARCHAR(100),
  detalle JSONB NOT NULL DEFAULT '{}'::jsonb,
  registrado_por_usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT movimientos_personal_cambio_significativo CHECK (
    tipo IN ('INGRESO', 'SALIDA') OR puesto_anterior IS DISTINCT FROM puesto_nuevo OR departamento_anterior IS DISTINCT FROM departamento_nuevo
  )
);

CREATE TABLE calendario_pagos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha_pago DATE NOT NULL UNIQUE,
  fecha_corte_inicio DATE NOT NULL,
  fecha_corte_fin DATE NOT NULL,
  tipo VARCHAR(32) NOT NULL,
  estado VARCHAR(24) NOT NULL DEFAULT 'PROGRAMADO',
  notas TEXT,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT calendario_pagos_rango_valido CHECK (fecha_corte_fin >= fecha_corte_inicio),
  CONSTRAINT calendario_pagos_tipo_valido CHECK (tipo IN ('QUINCENA_1', 'QUINCENA_2', 'AGUINALDO', 'EXTRAORDINARIO')),
  CONSTRAINT calendario_pagos_estado_valido CHECK (estado IN ('PROGRAMADO', 'PROCESADO', 'CANCELADO'))
);

CREATE TABLE evaluaciones_desempeno (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id UUID NOT NULL REFERENCES colaboradores(id) ON DELETE RESTRICT,
  evaluador_colaborador_id UUID REFERENCES colaboradores(id) ON DELETE SET NULL,
  periodo_inicio DATE NOT NULL,
  periodo_fin DATE NOT NULL,
  estado estado_evaluacion NOT NULL DEFAULT 'BORRADOR',
  calificacion NUMERIC(3, 2),
  resumen TEXT,
  objetivos JSONB NOT NULL DEFAULT '[]'::jsonb,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT evaluaciones_rango_valido CHECK (periodo_fin >= periodo_inicio),
  CONSTRAINT evaluaciones_calificacion_valida CHECK (calificacion IS NULL OR calificacion BETWEEN 1 AND 5),
  CONSTRAINT evaluaciones_colaborador_periodo_unico UNIQUE (colaborador_id, periodo_inicio, periodo_fin)
);

CREATE TABLE consultas_chat (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  sesion_id UUID NOT NULL DEFAULT gen_random_uuid(),
  agente_codigo VARCHAR(80) NOT NULL,
  pregunta TEXT NOT NULL,
  respuesta TEXT,
  documentos_recuperados JSONB NOT NULL DEFAULT '[]'::jsonb,
  calificacion_respuesta SMALLINT,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT consultas_chat_pregunta_no_vacia CHECK (length(btrim(pregunta)) > 0),
  CONSTRAINT consultas_chat_calificacion_valida CHECK (calificacion_respuesta IS NULL OR calificacion_respuesta BETWEEN 1 AND 5)
);

CREATE TABLE sincronizaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  origen VARCHAR(80) NOT NULL,
  estado estado_sincronizacion NOT NULL DEFAULT 'PENDIENTE',
  cursor_origen TEXT,
  documentos_leidos INTEGER NOT NULL DEFAULT 0,
  documentos_actualizados INTEGER NOT NULL DEFAULT 0,
  mensaje_error TEXT,
  inicio_en TIMESTAMPTZ,
  finalizo_en TIMESTAMPTZ,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT sincronizaciones_contadores_validos CHECK (documentos_leidos >= 0 AND documentos_actualizados >= 0),
  CONSTRAINT sincronizaciones_fechas_validas CHECK (finalizo_en IS NULL OR inicio_en IS NULL OR finalizo_en >= inicio_en)
);

CREATE TABLE logs_agentes (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  consulta_chat_id UUID REFERENCES consultas_chat(id) ON DELETE SET NULL,
  agente_codigo VARCHAR(80) NOT NULL,
  operacion VARCHAR(120) NOT NULL,
  estado estado_log NOT NULL,
  duracion_ms INTEGER,
  detalle JSONB NOT NULL DEFAULT '{}'::jsonb,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT logs_agentes_duracion_valida CHECK (duracion_ms IS NULL OR duracion_ms >= 0)
);

CREATE TABLE reportes_diarios (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  fecha DATE NOT NULL,
  departamento VARCHAR(100),
  total_colaboradores INTEGER NOT NULL,
  colaboradores_activos INTEGER NOT NULL,
  solicitudes_pendientes INTEGER NOT NULL DEFAULT 0,
  incapacidades_activas INTEGER NOT NULL DEFAULT 0,
  dias_vacaciones_disponibles NUMERIC(10, 2) NOT NULL DEFAULT 0,
  metricas JSONB NOT NULL DEFAULT '{}'::jsonb,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT reportes_diarios_totales_validos CHECK (
    total_colaboradores >= 0 AND colaboradores_activos BETWEEN 0 AND total_colaboradores
    AND solicitudes_pendientes >= 0 AND incapacidades_activas >= 0 AND dias_vacaciones_disponibles >= 0
  ),
  CONSTRAINT reportes_diarios_fecha_departamento_unico UNIQUE NULLS NOT DISTINCT (fecha, departamento)
);

CREATE TRIGGER usuarios_actualizar_marca
BEFORE UPDATE ON usuarios FOR EACH ROW EXECUTE FUNCTION establecer_actualizado_en();
CREATE TRIGGER colaboradores_actualizar_marca
BEFORE UPDATE ON colaboradores FOR EACH ROW EXECUTE FUNCTION establecer_actualizado_en();
CREATE TRIGGER saldos_vacaciones_actualizar_marca
BEFORE UPDATE ON saldos_vacaciones FOR EACH ROW EXECUTE FUNCTION establecer_actualizado_en();
CREATE TRIGGER documentos_actualizar_marca
BEFORE UPDATE ON documentos FOR EACH ROW EXECUTE FUNCTION establecer_actualizado_en();
CREATE TRIGGER solicitudes_actualizar_marca
BEFORE UPDATE ON solicitudes FOR EACH ROW EXECUTE FUNCTION establecer_actualizado_en();
CREATE TRIGGER incapacidades_actualizar_marca
BEFORE UPDATE ON incapacidades FOR EACH ROW EXECUTE FUNCTION establecer_actualizado_en();
CREATE TRIGGER evaluaciones_actualizar_marca
BEFORE UPDATE ON evaluaciones_desempeno FOR EACH ROW EXECUTE FUNCTION establecer_actualizado_en();

COMMIT;
