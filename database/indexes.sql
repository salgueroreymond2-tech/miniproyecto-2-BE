-- Índices adicionales: las claves primarias y UNIQUE ya crean sus propios índices.
CREATE INDEX idx_colaboradores_estado_departamento ON colaboradores (estado, departamento);
CREATE INDEX idx_colaboradores_supervisor ON colaboradores (supervisor_id) WHERE supervisor_id IS NOT NULL;
CREATE INDEX idx_saldos_vacaciones_colaborador_periodo ON saldos_vacaciones (colaborador_id, periodo_anual DESC);
CREATE INDEX idx_solicitudes_colaborador_estado_fecha ON solicitudes (colaborador_id, estado, fecha_inicio DESC);
CREATE INDEX idx_solicitudes_pendientes ON solicitudes (creado_en) WHERE estado = 'PENDIENTE';
CREATE INDEX idx_incapacidades_colaborador_fecha ON incapacidades (colaborador_id, fecha_inicio DESC);
CREATE INDEX idx_movimientos_colaborador_fecha ON movimientos_personal (colaborador_id, fecha_efectiva DESC);
CREATE INDEX idx_movimientos_tipo_fecha ON movimientos_personal (tipo, fecha_efectiva DESC);
CREATE INDEX idx_calendario_pagos_fecha ON calendario_pagos (fecha_pago);
CREATE INDEX idx_evaluaciones_colaborador_periodo ON evaluaciones_desempeno (colaborador_id, periodo_fin DESC);
CREATE INDEX idx_consultas_chat_usuario_fecha ON consultas_chat (usuario_id, creado_en DESC);
CREATE INDEX idx_reportes_diarios_fecha_departamento ON reportes_diarios (fecha DESC, departamento);
CREATE INDEX idx_sincronizaciones_origen_fecha ON sincronizaciones (origen, creado_en DESC);
CREATE INDEX idx_logs_agentes_consulta_fecha ON logs_agentes (consulta_chat_id, creado_en DESC);

CREATE INDEX idx_documentos_busqueda ON documentos
USING gin (to_tsvector('spanish', coalesce(titulo, '') || ' ' || coalesce(contenido, '')));
CREATE INDEX idx_fragmentos_documentos_metadatos ON fragmentos_documentos USING gin (metadatos);
-- El índice vectorial usa similitud coseno y solo contiene fragmentos ya vectorizados.
CREATE INDEX idx_fragmentos_documentos_embedding ON fragmentos_documentos
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)
WHERE embedding IS NOT NULL;

