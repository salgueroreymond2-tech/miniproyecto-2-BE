'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { Op } = require('sequelize');

require('dotenv').config();
const enabled = process.env.MYSQL_EMPLOYEE_INTEGRATION === '1';

test('herramientas de datos personales coinciden con SELECTs de MySQL y aíslan dos colaboradores', {
  skip: !enabled,
  timeout: 30000
}, async (t) => {
  const db = require('../src/config/database');
  const { initModels } = require('../src/models');
  const repository = require('../src/repositories/employeeDataRepository');
  let connection;
  try {
    connection = db.getReadConnection();
    await connection.authenticate();
    const models = initModels(connection);
    const [first, second] = await models.Colaborador.findAll({
      attributes: ['id', 'usuario_id'],
      order: [['usuario_id', 'ASC']],
      limit: 2
    });
    assert.ok(first?.usuario_id && second?.usuario_id);
    assert.notEqual(first.usuario_id, second.usuario_id);

    const vacationRows = await models.SaldoVacaciones.findAll({
      where: { colaborador_id: first.id },
      attributes: ['periodo_anual', 'dias_generados', 'dias_ajuste', 'dias_disfrutados', 'dias_disponibles'],
      order: [['periodo_anual', 'DESC']]
    });
    const result = await repository.getVacationBalance(first.usuario_id);
    assert.deepEqual(result, vacationRows.map((row) => ({
      periodo_anual: row.periodo_anual,
      dias_generados: row.dias_generados,
      dias_ajuste: row.dias_ajuste,
      dias_disfrutados: row.dias_disfrutados,
      dias_disponibles: row.dias_disponibles
    })));

    const today = repository.costaRicaToday();
    const expectedPayment = await models.CalendarioPago.findOne({
      where: { estado: 'PROGRAMADO', fecha_pago: { [Op.gte]: today } },
      attributes: ['fecha_pago', 'fecha_corte_inicio', 'fecha_corte_fin', 'tipo'],
      order: [['fecha_pago', 'ASC']]
    });
    const actualPayment = await repository.getNextPayment(first.usuario_id);
    assert.deepEqual(actualPayment, expectedPayment ? {
      fecha_pago: expectedPayment.fecha_pago,
      fecha_corte_inicio: expectedPayment.fecha_corte_inicio,
      fecha_corte_fin: expectedPayment.fecha_corte_fin,
      tipo: expectedPayment.tipo
    } : null);

    const request = await models.Solicitud.findOne({
      where: { colaborador_id: first.id },
      attributes: ['id']
    });
    if (request) {
      assert.ok(await repository.getRequestStatus(first.usuario_id, request.id));
      assert.equal(await repository.getRequestStatus(second.usuario_id, request.id), null);
    }

    const expectedRequests = await models.Solicitud.findAll({
      where: { colaborador_id: first.id },
      attributes: ['id', 'tipo', 'fecha_inicio', 'fecha_fin', 'dias_solicitados', 'estado', 'creado_en'],
      order: [['creado_en', 'DESC']],
      limit: 100
    });
    const actualRequests = await repository.getEmployeeRequests(first.usuario_id);
    assert.deepEqual(actualRequests, expectedRequests.map((row) => ({
      id: row.id,
      tipo: row.tipo,
      fecha_inicio: row.fecha_inicio,
      fecha_fin: row.fecha_fin,
      dias_solicitados: row.dias_solicitados,
      estado: row.estado,
      creado_en: row.creado_en
    })));
    assert.deepEqual(await repository.getEmployeeRequests(second.usuario_id), await models.Solicitud.findAll({
      where: { colaborador_id: second.id },
      attributes: ['id', 'tipo', 'fecha_inicio', 'fecha_fin', 'dias_solicitados', 'estado', 'creado_en'],
      order: [['creado_en', 'DESC']],
      limit: 100
    }).then((rows) => rows.map((row) => ({
      id: row.id,
      tipo: row.tipo,
      fecha_inicio: row.fecha_inicio,
      fecha_fin: row.fecha_fin,
      dias_solicitados: row.dias_solicitados,
      estado: row.estado,
      creado_en: row.creado_en
    }))));

    const directIncapacities = await models.Incapacidad.findAll({
      where: { colaborador_id: first.id },
      attributes: ['fecha_inicio', 'fecha_fin', 'estado'],
      order: [['fecha_inicio', 'DESC']],
      limit: 100
    });
    const directLeaves = await models.Solicitud.findAll({
      where: {
        colaborador_id: first.id,
        estado: 'APROBADA',
        tipo: { [Op.in]: ['VACACIONES', 'PERMISO_PERSONAL', 'PERMISO_DUELO', 'PERMISO_FORMACION', 'LICENCIA_SIN_GOCE'] }
      },
      attributes: ['tipo', 'fecha_inicio', 'fecha_fin', 'estado'],
      order: [['fecha_inicio', 'DESC']],
      limit: 100
    });
    const actualAbsences = await repository.getEmployeeAbsences(first.usuario_id);
    const expectedAbsences = [
      ...directIncapacities.map((row) => ({ tipo: 'INCAPACIDAD', fecha_inicio: row.fecha_inicio, fecha_fin: row.fecha_fin, estado: row.estado })),
      ...directLeaves.map((row) => ({ tipo: row.tipo, fecha_inicio: row.fecha_inicio, fecha_fin: row.fecha_fin, estado: row.estado }))
    ].sort((a, b) => String(b.fecha_inicio).localeCompare(String(a.fecha_inicio)));
    assert.deepEqual(actualAbsences, expectedAbsences);

    const anyEvaluation = await models.EvaluacionDesempeno.findOne({ attributes: ['colaborador_id'] });
    const employeeWithEvaluation = anyEvaluation
      ? await models.Colaborador.findOne({ where: { id: anyEvaluation.colaborador_id }, attributes: ['id', 'usuario_id'] })
      : null;
    if (employeeWithEvaluation) {
      const direct = await models.EvaluacionDesempeno.findOne({
        where: {
          colaborador_id: employeeWithEvaluation.id,
          estado: { [Op.in]: ['BORRADOR', 'PENDIENTE'] },
          periodo_inicio: { [Op.gte]: today }
        },
        attributes: ['periodo_inicio', 'periodo_fin', 'estado'],
        order: [['periodo_inicio', 'ASC']]
      });
      const actual = await repository.getNextPerformanceEvaluation(employeeWithEvaluation.usuario_id);
      assert.deepEqual(actual, direct ? {
        periodo_inicio: direct.periodo_inicio,
        periodo_fin: direct.periodo_fin,
        estado: direct.estado
      } : null);
    }
  } catch (error) {
    if (error.code === 'DATABASE_NOT_CONFIGURED') {
      t.skip('Configura DB_READ_USER y DB_READ_PASSWORD con permisos SELECT para MySQL.');
      return;
    }
    throw error;
  } finally {
    await db.closePool();
  }
});
