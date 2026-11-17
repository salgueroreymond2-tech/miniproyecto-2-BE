SELECT d.nombre AS departamento, COUNT(*) AS colaboradores_activos
FROM colaboradores c JOIN departamentos d ON d.id = c.departamento_id
WHERE c.estado = 'ACTIVO' GROUP BY d.id, d.nombre;

SELECT tipo, COUNT(*) AS total FROM movimientos_personal
WHERE fecha_efectiva >= :desde AND fecha_efectiva <= :hasta GROUP BY tipo;

SELECT estado, COUNT(*) AS total FROM solicitudes GROUP BY estado;
