-- Ejecutar manualmente como administrador tras revisar las necesidades del despliegue.
-- No se crean cuentas ni contraseñas: el administrador asigna estos roles a cuentas dedicadas.
CREATE ROLE IF NOT EXISTS portal_rrhh_api, portal_rrhh_lectura;
GRANT SELECT ON portal_rrhh.usuarios TO portal_rrhh_api;
GRANT SELECT ON portal_rrhh.colaboradores TO portal_rrhh_api;
GRANT SELECT ON portal_rrhh.departamentos TO portal_rrhh_api;
GRANT SELECT ON portal_rrhh.puestos TO portal_rrhh_api;
GRANT SELECT ON portal_rrhh.saldos_vacaciones TO portal_rrhh_api;
GRANT SELECT ON portal_rrhh.solicitudes TO portal_rrhh_api;
GRANT SELECT ON portal_rrhh.calendario_pagos TO portal_rrhh_api;
GRANT SELECT (id, usuario_id, codigo, nombres, apellidos, departamento_id, puesto_id, modalidad, estado, fecha_ingreso) ON portal_rrhh.colaboradores TO portal_rrhh_lectura;
GRANT SELECT ON portal_rrhh.departamentos TO portal_rrhh_lectura;
GRANT SELECT ON portal_rrhh.puestos TO portal_rrhh_lectura;
GRANT SELECT ON portal_rrhh.saldos_vacaciones TO portal_rrhh_lectura;
GRANT SELECT ON portal_rrhh.solicitudes TO portal_rrhh_lectura;
GRANT SELECT ON portal_rrhh.calendario_pagos TO portal_rrhh_lectura;
