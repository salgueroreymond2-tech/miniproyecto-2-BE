-- Ejecutar después de permissions.sql en Supabase; requiere un rol administrador.
-- Los JWT de esta API no son JWT de Supabase Auth: el navegador usa solo la API Express.
BEGIN;
REVOKE SELECT ON TABLE public.usuarios FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.usuarios, public.colaboradores, public.saldos_vacaciones,
  public.solicitudes, public.calendario_pagos FROM nexotico_backend;
GRANT USAGE ON SCHEMA public TO nexotico_backend;
GRANT SELECT (id, email, password_hash, rol, activo) ON public.usuarios TO nexotico_backend;
GRANT SELECT (id, usuario_id, codigo, nombres, apellidos, email_corporativo, departamento,
  puesto, modalidad, estado, fecha_ingreso, fecha_salida) ON public.colaboradores TO nexotico_backend;
GRANT SELECT (colaborador_id, periodo_anual, dias_generados, dias_disfrutados, dias_ajuste,
  dias_disponibles) ON public.saldos_vacaciones TO nexotico_backend;
GRANT SELECT (id, colaborador_id, tipo, fecha_inicio, fecha_fin, dias_solicitados, estado,
  creado_en) ON public.solicitudes TO nexotico_backend;
GRANT SELECT (fecha_pago, fecha_corte_inicio, fecha_corte_fin, tipo, estado)
  ON public.calendario_pagos TO nexotico_backend;

-- Este rol es exclusivamente de servidor. El backend limita las filas por usuario
-- y verifica el rol RRHH; el rol nunca se entrega al frontend.
CREATE POLICY api_backend_usuarios ON public.usuarios FOR SELECT TO nexotico_backend USING (true);
CREATE POLICY api_backend_colaboradores ON public.colaboradores FOR SELECT TO nexotico_backend USING (true);
CREATE POLICY api_backend_saldos ON public.saldos_vacaciones FOR SELECT TO nexotico_backend USING (true);
CREATE POLICY api_backend_solicitudes ON public.solicitudes FOR SELECT TO nexotico_backend USING (true);
CREATE POLICY api_backend_pagos ON public.calendario_pagos FOR SELECT TO nexotico_backend USING (true);
COMMIT;
