'use strict';
const bcrypt = require('bcrypt');
require('dotenv').config();
const id = (type, n) => `${type}0000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

module.exports = {
  async up(qi) {
    const password = process.env.DEMO_PASSWORD;
    if (!password || password.length < 12 || Buffer.byteLength(password) > 72) throw new Error('Configure DEMO_PASSWORD con al menos 12 caracteres y máximo 72 bytes.');
    const transaction = await qi.sequelize.transaction();
    try {
      const options = { transaction };
      const departments = ['Tecnología', 'Producto', 'Datos', 'Operaciones', 'Personas y Cultura', 'Finanzas'].map((nombre, i) => ({ id: id('1', i + 1), nombre }));
      const positions = departments.flatMap((department, i) => [1, 2].map((n) => ({ id: id('2', i * 2 + n), departamento_id: department.id, nombre: `${department.nombre} ${n === 1 ? 'Analista' : 'Especialista'}` })));
      const hashes = await Promise.all(Array.from({ length: 50 }, () => bcrypt.hash(password, 10)));
      const users = hashes.map((hash, i) => ({ id: id('3', i + 1), email: `persona${String(i + 1).padStart(2, '0')}@nexotico.test`, password_hash: hash, rol: i < 2 ? 'RRHH' : 'COLABORADOR', activo: i < 47 }));
      const employees = users.map((user, i) => ({ id: id('4', i + 1), usuario_id: user.id, departamento_id: departments[i % 6].id, puesto_id: positions[(i % 6) * 2 + (Math.floor(i / 6) % 2)].id, codigo: `NTC-${String(i + 1).padStart(3, '0')}`, identificacion_ficticia: `FICT-${String(i + 1).padStart(4, '0')}`, nombres: `Persona${i + 1}`, apellidos: `Ficticia${i + 1}`, email_corporativo: user.email, fecha_ingreso: i >= 44 ? `2026-${String(9 + (i % 3)).padStart(2, '0')}-01` : '2024-01-15', fecha_salida: i >= 47 ? '2026-11-16' : null, modalidad: ['HIBRIDO', 'PRESENCIAL', 'TELETRABAJO'][i % 3], salario_base: 750000 + i * 5000, estado: i >= 47 ? 'INACTIVO' : 'ACTIVO' }));
      await qi.bulkInsert('departamentos', departments, options); await qi.bulkInsert('puestos', positions, options);
      await qi.bulkInsert('usuarios', users, options); await qi.bulkInsert('colaboradores', employees, options);
      await qi.bulkInsert('saldos_vacaciones', employees.map((e, i) => ({ id: id('5', i + 1), colaborador_id: e.id, periodo_anual: 2026, dias_generados: i < 44 ? 12 : 0, dias_disfrutados: i < 44 ? i % 4 : 0, dias_ajuste: 0 })), options);
      await qi.bulkInsert('solicitudes', employees.slice(0, 30).map((e, i) => ({ id: id('6', i + 1), colaborador_id: e.id, tipo: i % 2 ? 'PERMISO_PERSONAL' : 'VACACIONES', fecha_inicio: '2026-09-15', fecha_fin: '2026-09-15', dias_solicitados: 1, estado: ['PENDIENTE', 'APROBADA', 'RECHAZADA'][i % 3] })), options);
      await qi.bulkInsert('incapacidades', employees.slice(0, 6).map((e, i) => ({ id: id('7', i + 1), colaborador_id: e.id, referencia_ccss: `CCSS-FICT-${i + 1}`, fecha_inicio: i === 0 ? '2026-11-15' : '2026-09-01', fecha_fin: i === 0 ? '2026-11-19' : '2026-09-03', estado: i === 0 ? 'REGISTRADA' : 'CERRADA' })), options);
      const movements = employees.map((e, i) => ({ id: id('8', i + 1), colaborador_id: e.id, tipo: 'INGRESO', fecha_efectiva: e.fecha_ingreso, detalle: JSON.stringify({ ficticio: true }) }));
      for (let i = 0; i < 9; i += 1) movements.push({ id: id('9', i + 1), colaborador_id: employees[i].id, tipo: 'ASCENSO', fecha_efectiva: `2026-${String(9 + i % 3).padStart(2, '0')}-10`, detalle: JSON.stringify({ ficticio: true }) });
      employees.slice(47).forEach((e, i) => movements.push({ id: id('a', i + 1), colaborador_id: e.id, tipo: 'SALIDA', fecha_efectiva: e.fecha_salida, detalle: JSON.stringify({ ficticio: true }) }));
      await qi.bulkInsert('movimientos_personal', movements, options);
      const payments = [];
      for (let month = 1; month <= 12; month += 1) {
        const mm = String(month).padStart(2, '0');
        const last = new Date(Date.UTC(2026, month, 0));
        while ([0, 6].includes(last.getUTCDay())) last.setUTCDate(last.getUTCDate() - 1);
        const mid = new Date(Date.UTC(2026, month - 1, 15));
        while ([0, 6].includes(mid.getUTCDay())) mid.setUTCDate(mid.getUTCDate() - 1);
        payments.push({ id: id('b', month * 2 - 1), fecha_pago: mid.toISOString().slice(0, 10), fecha_corte_inicio: `2026-${mm}-01`, fecha_corte_fin: `2026-${mm}-15`, tipo: 'QUINCENA_1', estado: 'PROGRAMADO' });
        payments.push({ id: id('b', month * 2), fecha_pago: last.toISOString().slice(0, 10), fecha_corte_inicio: `2026-${mm}-16`, fecha_corte_fin: `2026-${mm}-${String(new Date(Date.UTC(2026, month, 0)).getUTCDate())}`, tipo: 'QUINCENA_2', estado: 'PROGRAMADO' });
      }
      await qi.bulkInsert('calendario_pagos', payments, options);
      await qi.bulkInsert('evaluaciones_desempeno', employees.slice(0, 40).map((e, i) => ({ id: id('c', i + 1), colaborador_id: e.id, evaluador_id: employees[0].id, periodo_inicio: '2026-03-01', periodo_fin: '2026-09-30', estado: 'COMPLETADA', resultado: 'cumple expectativas', resumen: 'Evaluación ficticia' })), options);
      await qi.bulkInsert('consultas_chat', users.slice(0, 20).map((u, i) => ({ id: id('d', i + 1), usuario_id: u.id, pregunta: '¿Cómo solicito vacaciones?', respuesta: 'Consulte la política de vacaciones.', agente: 'POLITICAS' })), options);
      await qi.bulkInsert('reportes_diarios', [{ id: id('e', 1), fecha: '2026-11-17', metricas: JSON.stringify({ activos: 47, inactivos: 3, pendientes: 10 }) }], options);
      await transaction.commit();
    } catch (error) { await transaction.rollback(); throw error; }
  },
  async down() { throw new Error('La eliminación masiva de datos está deshabilitada.'); }
};
