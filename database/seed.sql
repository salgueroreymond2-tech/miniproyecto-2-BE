-- Datos exclusivamente ficticios, deterministas y aptos solo para desarrollo.
-- Ejecutar después de extensions.sql, schema.sql, indexes.sql y permissions.sql.

BEGIN;

INSERT INTO usuarios (id, email, password_hash, rol, activo)
VALUES
  ('00000000-0000-4000-8000-000000000001', 'rrhh.demo@nexotico.test', '$2b$12$B0qrAyI5boeS05yu36UG0e6grENxHvUrPNtzBaZWB3vYOCOi47ZmC', 'RRHH', TRUE),
  ('00000000-0000-4000-8000-000000000002', 'colaborador.demo@nexotico.test', '$2b$12$B0qrAyI5boeS05yu36UG0e6grENxHvUrPNtzBaZWB3vYOCOi47ZmC', 'COLABORADOR', TRUE)
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  password_hash = EXCLUDED.password_hash,
  rol = EXCLUDED.rol,
  activo = EXCLUDED.activo;

WITH datos AS (
  SELECT
    gs AS numero,
    ('10000000-0000-4000-8000-' || lpad(gs::text, 12, '0'))::uuid AS id,
    CASE WHEN gs = 1 THEN '00000000-0000-4000-8000-000000000002'::uuid ELSE NULL END AS usuario_id,
    CASE
      WHEN gs = 1 THEN 'Gerencia General'
      WHEN gs % 6 = 0 THEN 'Tecnología'
      WHEN gs % 6 = 1 THEN 'Producto'
      WHEN gs % 6 = 2 THEN 'Datos'
      WHEN gs % 6 = 3 THEN 'Operaciones'
      WHEN gs % 6 = 4 THEN 'Personas y Cultura'
      ELSE 'Finanzas'
    END AS departamento,
    CASE
      WHEN gs = 1 THEN 'Dirección General'
      WHEN gs % 6 = 0 THEN 'Desarrollador/a de Software'
      WHEN gs % 6 = 1 THEN 'Especialista de Producto'
      WHEN gs % 6 = 2 THEN 'Analista de Datos'
      WHEN gs % 6 = 3 THEN 'Especialista de Soporte'
      WHEN gs % 6 = 4 THEN 'Analista de Personas'
      ELSE 'Analista Financiero/a'
    END AS puesto,
    (DATE '2022-01-03' + ((gs * 23) % 1200)) AS fecha_ingreso
  FROM generate_series(1, 50) AS gs
)
INSERT INTO colaboradores (
  id, usuario_id, codigo, identificacion_ficticia, nombres, apellidos,
  email_corporativo, telefono, departamento, puesto, fecha_ingreso,
  fecha_salida, modalidad, salario_base, estado
)
SELECT
  id,
  usuario_id,
  'NTC-' || lpad(numero::text, 3, '0'),
  'FICT-' || lpad(numero::text, 4, '0'),
  'Persona' || lpad(numero::text, 2, '0'),
  'Demostracion' || lpad(numero::text, 2, '0'),
  'persona' || lpad(numero::text, 2, '0') || '@nexotico.test',
  '+506 8000-' || lpad(numero::text, 4, '0'),
  departamento,
  puesto,
  fecha_ingreso,
  CASE WHEN numero IN (48, 49, 50) THEN DATE '2026-10-01' + (numero - 48) ELSE NULL END,
  CASE WHEN numero % 3 = 0 THEN 'TELETRABAJO'::modalidad_trabajo WHEN numero % 3 = 1 THEN 'HIBRIDO'::modalidad_trabajo ELSE 'PRESENCIAL'::modalidad_trabajo END,
  750000 + (numero * 8500),
  CASE WHEN numero IN (48, 49, 50) THEN 'INACTIVO'::estado_colaborador ELSE 'ACTIVO'::estado_colaborador END
FROM datos
ON CONFLICT (id) DO UPDATE SET
  usuario_id = EXCLUDED.usuario_id,
  departamento = EXCLUDED.departamento,
  puesto = EXCLUDED.puesto,
  fecha_salida = EXCLUDED.fecha_salida,
  modalidad = EXCLUDED.modalidad,
  salario_base = EXCLUDED.salario_base,
  estado = EXCLUDED.estado;

UPDATE colaboradores
SET supervisor_id = (SELECT id FROM colaboradores WHERE codigo = 'NTC-001')
WHERE codigo <> 'NTC-001' AND supervisor_id IS NULL;

INSERT INTO saldos_vacaciones (colaborador_id, periodo_anual, dias_generados, dias_disfrutados, dias_ajuste)
SELECT id, 2026, 15 + (substring(codigo FROM 5)::integer % 5), substring(codigo FROM 5)::integer % 7, 0
FROM colaboradores
WHERE estado = 'ACTIVO'
ON CONFLICT (colaborador_id, periodo_anual) DO UPDATE SET
  dias_generados = EXCLUDED.dias_generados,
  dias_disfrutados = EXCLUDED.dias_disfrutados,
  dias_ajuste = EXCLUDED.dias_ajuste;

INSERT INTO calendario_pagos (fecha_pago, fecha_corte_inicio, fecha_corte_fin, tipo, estado, notas)
SELECT (inicio_mes + INTERVAL '14 days')::date, inicio_mes, (inicio_mes + INTERVAL '14 days')::date, 'QUINCENA_1', 'PROGRAMADO', 'Calendario ficticio de desarrollo'
FROM generate_series(DATE '2026-01-01', DATE '2026-12-01', INTERVAL '1 month') AS meses(inicio_mes)
UNION ALL
SELECT (inicio_mes + INTERVAL '1 month - 1 day')::date, (inicio_mes + INTERVAL '15 days')::date, (inicio_mes + INTERVAL '1 month - 1 day')::date, 'QUINCENA_2', 'PROGRAMADO', 'Calendario ficticio de desarrollo'
FROM generate_series(DATE '2026-01-01', DATE '2026-12-01', INTERVAL '1 month') AS meses(inicio_mes)
ON CONFLICT (fecha_pago) DO UPDATE SET
  fecha_corte_inicio = EXCLUDED.fecha_corte_inicio,
  fecha_corte_fin = EXCLUDED.fecha_corte_fin,
  tipo = EXCLUDED.tipo,
  estado = EXCLUDED.estado;

INSERT INTO solicitudes (
  id, colaborador_id, tipo, fecha_inicio, fecha_fin, dias_solicitados, motivo,
  estado, resuelta_por_usuario_id, resuelta_en
)
SELECT
  ('30000000-0000-4000-8000-' || lpad(gs::text, 12, '0'))::uuid,
  c.id,
  CASE
    WHEN gs % 4 = 0 THEN 'VACACIONES'::tipo_solicitud
    WHEN gs % 4 = 1 THEN 'PERMISO_PERSONAL'::tipo_solicitud
    WHEN gs % 4 = 2 THEN 'PERMISO_FORMACION'::tipo_solicitud
    ELSE 'LICENCIA_SIN_GOCE'::tipo_solicitud
  END,
  DATE '2026-09-01' + (gs * 2),
  DATE '2026-09-01' + (gs * 2) + CASE WHEN gs % 4 = 0 THEN 2 ELSE 0 END,
  CASE WHEN gs % 4 = 0 THEN 3 ELSE 1 END,
  'Solicitud ficticia para demostración',
  CASE WHEN gs <= 18 THEN 'APROBADA'::estado_solicitud WHEN gs <= 24 THEN 'PENDIENTE'::estado_solicitud ELSE 'RECHAZADA'::estado_solicitud END,
  CASE WHEN gs <= 18 OR gs > 24 THEN '00000000-0000-4000-8000-000000000001'::uuid ELSE NULL END,
  CASE WHEN gs <= 18 OR gs > 24 THEN timezone('utc', TIMESTAMPTZ '2026-09-01 12:00:00+00' + (gs || ' days')::interval) ELSE NULL END
FROM generate_series(1, 30) AS gs
JOIN colaboradores c ON c.codigo = 'NTC-' || lpad(gs::text, 3, '0')
ON CONFLICT DO NOTHING;

INSERT INTO incapacidades (colaborador_id, referencia_ccss, fecha_inicio, fecha_fin, estado)
SELECT
  c.id,
  'CCSS-DEMO-2026-' || lpad(gs::text, 3, '0'),
  DATE '2026-09-03' + (gs * 8),
  DATE '2026-09-03' + (gs * 8) + (gs % 4),
  CASE WHEN gs <= 4 THEN 'CERRADA' ELSE 'REGISTRADA' END
FROM generate_series(1, 8) AS gs
JOIN colaboradores c ON c.codigo = 'NTC-' || lpad((gs + 5)::text, 3, '0')
ON CONFLICT (referencia_ccss) DO UPDATE SET
  fecha_inicio = EXCLUDED.fecha_inicio,
  fecha_fin = EXCLUDED.fecha_fin,
  estado = EXCLUDED.estado;

INSERT INTO movimientos_personal (
  id, colaborador_id, tipo, fecha_efectiva, puesto_anterior, puesto_nuevo,
  departamento_anterior, departamento_nuevo, detalle, registrado_por_usuario_id
)
SELECT ('40000000-0000-4000-8000-' || lpad(substring(codigo FROM 5), 12, '0'))::uuid, id, 'INGRESO', fecha_ingreso, NULL, puesto, NULL, departamento,
  jsonb_build_object('origen', 'seed', 'ficticio', TRUE), '00000000-0000-4000-8000-000000000001'::uuid
FROM colaboradores
ON CONFLICT DO NOTHING;

INSERT INTO movimientos_personal (
  id, colaborador_id, tipo, fecha_efectiva, puesto_anterior, puesto_nuevo,
  departamento_anterior, departamento_nuevo, detalle, registrado_por_usuario_id
)
SELECT
  ('41000000-0000-4000-8000-' || lpad(gs::text, 12, '0'))::uuid,
  c.id,
  CASE WHEN gs % 2 = 0 THEN 'ASCENSO'::tipo_movimiento ELSE 'CAMBIO_DEPARTAMENTO'::tipo_movimiento END,
  DATE '2026-09-01' + ((gs * 5) % 76),
  c.puesto,
  CASE WHEN gs % 2 = 0 THEN c.puesto || ' Senior' ELSE c.puesto END,
  c.departamento,
  CASE WHEN gs % 2 = 0 THEN c.departamento ELSE 'Datos' END,
  jsonb_build_object('origen', 'seed', 'periodo', 'septiembre-noviembre-2026'),
  '00000000-0000-4000-8000-000000000001'::uuid
FROM generate_series(1, 18) AS gs
JOIN colaboradores c ON c.codigo = 'NTC-' || lpad(gs::text, 3, '0')
ON CONFLICT DO NOTHING;

INSERT INTO movimientos_personal (
  id, colaborador_id, tipo, fecha_efectiva, puesto_anterior, puesto_nuevo,
  departamento_anterior, departamento_nuevo, detalle, registrado_por_usuario_id
)
SELECT ('42000000-0000-4000-8000-' || lpad(substring(codigo FROM 5), 12, '0'))::uuid, id, 'SALIDA', fecha_salida, puesto, NULL, departamento, NULL,
  jsonb_build_object('origen', 'seed', 'ficticio', TRUE), '00000000-0000-4000-8000-000000000001'::uuid
FROM colaboradores
WHERE estado = 'INACTIVO'
ON CONFLICT DO NOTHING;

INSERT INTO evaluaciones_desempeno (
  colaborador_id, evaluador_colaborador_id, periodo_inicio, periodo_fin,
  estado, calificacion, resumen, objetivos
)
SELECT
  c.id,
  (SELECT id FROM colaboradores WHERE codigo = 'NTC-001'),
  DATE '2026-07-01', DATE '2026-09-30',
  CASE WHEN gs <= 30 THEN 'COMPLETADA'::estado_evaluacion ELSE 'PENDIENTE'::estado_evaluacion END,
  CASE WHEN gs <= 30 THEN 3 + ((gs % 3)::numeric / 2) ELSE NULL END,
  CASE WHEN gs <= 30 THEN 'Evaluación ficticia para indicadores de demostración' ELSE NULL END,
  jsonb_build_array(jsonb_build_object('objetivo', 'Calidad de servicio', 'estado', CASE WHEN gs <= 30 THEN 'cumplido' ELSE 'pendiente' END))
FROM generate_series(2, 42) AS gs
JOIN colaboradores c ON c.codigo = 'NTC-' || lpad(gs::text, 3, '0')
WHERE c.estado = 'ACTIVO'
ON CONFLICT (colaborador_id, periodo_inicio, periodo_fin) DO UPDATE SET
  estado = EXCLUDED.estado,
  calificacion = EXCLUDED.calificacion,
  resumen = EXCLUDED.resumen,
  objetivos = EXCLUDED.objetivos;

WITH politicas(titulo, tipo, version) AS (
  VALUES
    ('Vacaciones y feriados', 'POLITICA_RRHH', '1.0'),
    ('Permisos y licencias', 'POLITICA_RRHH', '1.0'),
    ('Incapacidades', 'POLITICA_RRHH', '1.0'),
    ('Jornada laboral y teletrabajo', 'POLITICA_RRHH', '1.0'),
    ('Remuneración y calendario de pagos', 'POLITICA_RRHH', '1.0'),
    ('Beneficios corporativos', 'POLITICA_RRHH', '1.0'),
    ('Onboarding y salida de colaboradores', 'POLITICA_RRHH', '1.0'),
    ('Evaluación del desempeño', 'POLITICA_RRHH', '1.0'),
    ('Código de conducta y denuncias', 'POLITICA_RRHH', '1.0'),
    ('Protección de datos personales', 'POLITICA_RRHH', '1.0')
)
INSERT INTO documentos (titulo, tipo, version, contenido, hash_contenido, clasificacion, estado, creado_por_usuario_id, publicado_en)
SELECT titulo, tipo, version, 'Contenido ficticio indexable de ' || titulo,
  encode(digest(titulo || version, 'sha256'), 'hex'), 'INTERNO', 'APROBADO',
  '00000000-0000-4000-8000-000000000001'::uuid, TIMESTAMPTZ '2026-11-17 12:00:00+00'
FROM politicas
ON CONFLICT (hash_contenido) DO NOTHING;

INSERT INTO fragmentos_documentos (documento_id, numero_fragmento, contenido, tokens_estimados, embedding, embedding_model, embedding_dimension, metadatos)
SELECT id, 0, 'Fragmento inicial ficticio para recuperación: ' || titulo, 8, NULL,
  'gemini-embedding-001', 768, jsonb_build_object('origen', 'seed', 'vectorizado', FALSE)
FROM documentos
ON CONFLICT (documento_id, numero_fragmento) DO NOTHING;

INSERT INTO sincronizaciones (id, origen, estado, documentos_leidos, documentos_actualizados, inicio_en, finalizo_en)
VALUES ('60000000-0000-4000-8000-000000000001', 'GOOGLE_DRIVE', 'COMPLETADA', 10, 10, TIMESTAMPTZ '2026-11-16 08:00:00+00', TIMESTAMPTZ '2026-11-16 08:01:00+00')
ON CONFLICT (id) DO UPDATE SET
  estado = EXCLUDED.estado,
  documentos_leidos = EXCLUDED.documentos_leidos,
  documentos_actualizados = EXCLUDED.documentos_actualizados,
  inicio_en = EXCLUDED.inicio_en,
  finalizo_en = EXCLUDED.finalizo_en;

INSERT INTO reportes_diarios (
  fecha, departamento, total_colaboradores, colaboradores_activos,
  solicitudes_pendientes, incapacidades_activas, dias_vacaciones_disponibles, metricas
)
SELECT
  fecha::date,
  NULL,
  50,
  CASE WHEN fecha::date >= DATE '2026-10-03' THEN 47 ELSE 50 END,
  6,
  CASE WHEN fecha::date BETWEEN DATE '2026-10-13' AND DATE '2026-11-04' THEN 1 ELSE 0 END,
  610,
  jsonb_build_object('rotacion_mes', 0.0, 'ausentismo_demo', 0.02, 'fuente', 'seed_ficticio')
FROM generate_series(DATE '2026-09-01', DATE '2026-11-16', INTERVAL '1 day') AS fechas(fecha)
ON CONFLICT (fecha, departamento) DO UPDATE SET
  total_colaboradores = EXCLUDED.total_colaboradores,
  colaboradores_activos = EXCLUDED.colaboradores_activos,
  solicitudes_pendientes = EXCLUDED.solicitudes_pendientes,
  incapacidades_activas = EXCLUDED.incapacidades_activas,
  dias_vacaciones_disponibles = EXCLUDED.dias_vacaciones_disponibles,
  metricas = EXCLUDED.metricas;

COMMIT;
