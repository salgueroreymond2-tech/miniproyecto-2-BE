-- Seguridad para Supabase. Ejecutar después de schema.sql e indexes.sql.
-- El frontend nunca recibe DATABASE_URL, contraseña de base de datos ni service_role key.

REVOKE ALL ON SCHEMA public FROM anon;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON usuarios, colaboradores, saldos_vacaciones, solicitudes, incapacidades,
  movimientos_personal, calendario_pagos, evaluaciones_desempeno, documentos,
  fragmentos_documentos, consultas_chat, sincronizaciones, logs_agentes, reportes_diarios TO authenticated;
GRANT INSERT ON solicitudes TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- La cuenta de backend se crea y rota fuera de este repositorio. Este rol sin LOGIN
-- documenta el conjunto mínimo de privilegios que debe concedérsele.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nexotico_backend') THEN
    CREATE ROLE nexotico_backend NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
  END IF;
END;
$$;
GRANT USAGE ON SCHEMA public TO nexotico_backend;
GRANT SELECT, INSERT, UPDATE ON usuarios, colaboradores, saldos_vacaciones, solicitudes,
  incapacidades, movimientos_personal, calendario_pagos, evaluaciones_desempeno,
  documentos, fragmentos_documentos, consultas_chat, sincronizaciones, logs_agentes,
  reportes_diarios TO nexotico_backend;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO nexotico_backend;

CREATE OR REPLACE FUNCTION es_rrhh()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.usuarios
    WHERE id = auth.uid() AND rol = 'RRHH' AND activo = TRUE
  );
$$;

REVOKE ALL ON FUNCTION es_rrhh() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION es_rrhh() TO authenticated;

ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE colaboradores ENABLE ROW LEVEL SECURITY;
ALTER TABLE saldos_vacaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE solicitudes ENABLE ROW LEVEL SECURITY;
ALTER TABLE incapacidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimientos_personal ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendario_pagos ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluaciones_desempeno ENABLE ROW LEVEL SECURITY;
ALTER TABLE documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE fragmentos_documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE consultas_chat ENABLE ROW LEVEL SECURITY;
ALTER TABLE sincronizaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE logs_agentes ENABLE ROW LEVEL SECURITY;
ALTER TABLE reportes_diarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY usuarios_lectura_propia_o_rrhh ON usuarios
FOR SELECT TO authenticated
USING (id = auth.uid() OR es_rrhh());

CREATE POLICY colaboradores_lectura_propia_o_rrhh ON colaboradores
FOR SELECT TO authenticated
USING (usuario_id = auth.uid() OR es_rrhh());

CREATE POLICY saldos_vacaciones_lectura_propia_o_rrhh ON saldos_vacaciones
FOR SELECT TO authenticated
USING (
  es_rrhh() OR EXISTS (
    SELECT 1 FROM colaboradores c
    WHERE c.id = saldos_vacaciones.colaborador_id AND c.usuario_id = auth.uid()
  )
);

CREATE POLICY solicitudes_lectura_propia_o_rrhh ON solicitudes
FOR SELECT TO authenticated
USING (
  es_rrhh() OR EXISTS (
    SELECT 1 FROM colaboradores c
    WHERE c.id = solicitudes.colaborador_id AND c.usuario_id = auth.uid()
  )
);

CREATE POLICY solicitudes_creacion_propia ON solicitudes
FOR INSERT TO authenticated
WITH CHECK (
  estado = 'PENDIENTE' AND resuelta_en IS NULL AND resuelta_por_usuario_id IS NULL
  AND EXISTS (
    SELECT 1 FROM colaboradores c
    WHERE c.id = solicitudes.colaborador_id AND c.usuario_id = auth.uid()
  )
);

CREATE POLICY incapacidades_lectura_propia_o_rrhh ON incapacidades
FOR SELECT TO authenticated
USING (
  es_rrhh() OR EXISTS (
    SELECT 1 FROM colaboradores c
    WHERE c.id = incapacidades.colaborador_id AND c.usuario_id = auth.uid()
  )
);

CREATE POLICY movimientos_lectura_propia_o_rrhh ON movimientos_personal
FOR SELECT TO authenticated
USING (
  es_rrhh() OR EXISTS (
    SELECT 1 FROM colaboradores c
    WHERE c.id = movimientos_personal.colaborador_id AND c.usuario_id = auth.uid()
  )
);

CREATE POLICY calendario_pagos_lectura_autenticada ON calendario_pagos
FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY evaluaciones_lectura_propia_o_rrhh ON evaluaciones_desempeno
FOR SELECT TO authenticated
USING (
  es_rrhh() OR EXISTS (
    SELECT 1 FROM colaboradores c
    WHERE c.id = evaluaciones_desempeno.colaborador_id AND c.usuario_id = auth.uid()
  )
);

CREATE POLICY documentos_lectura_controlada ON documentos
FOR SELECT TO authenticated
USING (es_rrhh() OR (estado = 'APROBADO' AND clasificacion = 'INTERNO'));

CREATE POLICY fragmentos_lectura_controlada ON fragmentos_documentos
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM documentos d
    WHERE d.id = fragmentos_documentos.documento_id
      AND (es_rrhh() OR (d.estado = 'APROBADO' AND d.clasificacion = 'INTERNO'))
  )
);

CREATE POLICY consultas_chat_lectura_propia_o_rrhh ON consultas_chat
FOR SELECT TO authenticated USING (usuario_id = auth.uid() OR es_rrhh());

CREATE POLICY sincronizaciones_solo_rrhh ON sincronizaciones
FOR SELECT TO authenticated USING (es_rrhh());
CREATE POLICY logs_agentes_solo_rrhh ON logs_agentes
FOR SELECT TO authenticated USING (es_rrhh());
CREATE POLICY reportes_diarios_solo_rrhh ON reportes_diarios
FOR SELECT TO authenticated USING (es_rrhh());

