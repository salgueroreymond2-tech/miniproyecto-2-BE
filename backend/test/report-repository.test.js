'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createReportRepository } = require('../src/repositories/reportRepository');

test('calcula métricas desde modelos Sequelize y mantiene la forma consumida por analyst.agent', async () => {
  const calls = [];
  const records = {
    Colaborador: [
      { id: 'c1', codigo: 'NX001', nombres: 'Ana', apellidos: 'Solano', estado: 'ACTIVO', fecha_ingreso: '2025-01-01', fecha_salida: null, Departamento: { nombre: 'Tecnologia' } },
      { id: 'c2', codigo: 'NX002', nombres: 'Luis', apellidos: 'Mora', estado: 'ACTIVO', fecha_ingreso: '2025-01-01', fecha_salida: null, Departamento: { nombre: 'Finanzas' } }
    ],
    Solicitud: [
      { id: 'r1', colaborador_id: 'c1', tipo: 'VACACIONES', fecha_inicio: '2026-11-18', fecha_fin: '2026-11-20', dias_solicitados: 3, estado: 'APROBADA', creado_en: '2026-11-01 10:00:00' },
      { id: 'r2', colaborador_id: 'c2', tipo: 'PERMISO_PERSONAL', fecha_inicio: '2026-11-22', fecha_fin: '2026-11-22', dias_solicitados: 1, estado: 'PENDIENTE', creado_en: '2026-11-15 10:00:00' }
    ],
    Incapacidad: [{ colaborador_id: 'c1', fecha_inicio: '2026-11-18', fecha_fin: '2026-11-20', estado: 'REGISTRADA' }],
    MovimientoPersonal: [
      { colaborador_id: 'c1', tipo: 'INGRESO', fecha_efectiva: '2026-11-01' },
      { colaborador_id: 'c2', tipo: 'SALIDA', fecha_efectiva: '2026-11-02' }
    ],
    SaldoVacaciones: [{ colaborador_id: 'c1', dias_disponibles: 21 }],
    ConsultaChat: [
      { resolucion: 'RESPONDIDA', escalamiento_realizado: 0, latencia_ms: 100, tema: 'Vacaciones', pregunta: '¿Cuántos días?', intencion: 'POLITICA', creado_en: '2026-11-18 12:00:00' },
      { resolucion: 'SIN_EVIDENCIA', escalamiento_realizado: 1, latencia_ms: 200, tema: 'Vacaciones', pregunta: '¿Mascotas?', intencion: 'POLITICA', creado_en: '2026-11-18 13:00:00' }
    ]
  };
  const models = Object.fromEntries(Object.entries(records).map(([name, rows]) => [name, { findAll: async (options) => { calls.push({ model: name, options }); return rows; } }]));
  const repository = createReportRepository({ readConnectionFactory: () => ({}), modelsFactory: () => models });
  const result = await repository.collectMetrics({ reportDate: '2026-11-19', monthStart: '2026-11-01', yearStart: '2026-01-01', dayStartUtc: '2026-11-18 06:00:00', dayEndUtc: '2026-11-19 06:00:00' });

  assert.equal(result.active[0].total, 2);
  assert.deepEqual(result.absences, [{ tipo: 'INCAPACIDAD', departamento: 'Tecnologia', colaboradores: 1 }]);
  assert.equal(result.pendingCount[0].total, 1);
  assert.equal(result.pendingOlder[0].total, 1);
  assert.equal(result.activeIncapacities[0].total, 1);
  assert.equal(result.activeIncapacities[0].colaboradores, 1);
  assert.equal(result.incapacityDays[0].total, 2);
  assert.deepEqual(result.movements, [{ ingresos: 1, salidas: 1 }]);
  assert.deepEqual(result.turnover, [{ dotacionInicial: 2, dotacionActual: 2, salidasAcumuladas: 1 }]);
  assert.equal(result.vacations[0].dias_disponibles, 21);
  assert.deepEqual(result.chat, [{ total: 2, resueltasSinEscalamiento: 1, latenciaPromedio: 150 }]);
  assert.deepEqual(result.topics, [{ tema: 'Vacaciones', total: 2 }]);
  assert.equal(result.unanswered[0].pregunta, '¿Mascotas?');
  assert.equal(result.trend.length, 30);
  assert.deepEqual(result.trend.find((row) => row.fecha === '2026-11-19'), { fecha: '2026-11-19', colaboradores: 1 });
  assert.deepEqual(result.statuses, [{ estado: 'PENDIENTE', total: 1 }, { estado: 'APROBADA', total: 1 }]);
  assert.equal(calls.length, 6);
  assert.ok(calls.every((call) => typeof call.options === 'object' && !('query' in call.options)));
  const incapacityWhere = calls.find((call) => call.model === 'Incapacidad').options.where;
  assert.equal(Object.getOwnPropertySymbols(incapacityWhere.fecha_inicio).length, 1);
});

test('guarda una sola fotografía por fecha y conserva la primera escritura concurrente', async () => {
  const rows = new Map();
  let creates = 0;
  const transaction = { LOCK: { UPDATE: 'UPDATE' } };
  const connection = { transaction: async (operation) => operation(transaction) };
  const ReporteDiario = {
    findOne: async ({ where }) => rows.get(where.fecha) || null,
    create: async (record) => { creates += 1; rows.set(record.fecha, { ...record }); }
  };
  const repository = createReportRepository({ writeConnectionFactory: () => connection, modelsFactory: () => ({ ReporteDiario }), now: () => new Date('2026-11-19T12:00:00Z') });
  const stored = await repository.saveReport({ reportDate: '2026-11-19', metric: 1 });
  assert.equal(stored.metric, 1);
  const second = await repository.saveReport({ reportDate: '2026-11-19', metric: 2 });
  assert.equal(second.metric, 1);
  assert.equal(second.updated, true);
  assert.equal(creates, 1);
});
