'use strict';

const { initModels } = require('../src/models');

const makeRows = (categoria, terms, temaAsociado = null) => terms.map((term) => ({ palabra: term, categoria, tema_asociado: temaAsociado }));

const KEYWORD_SEEDS = [
  ...[
    ['salario', 'REMUNERACION'], ['sueldo', 'REMUNERACION'], ['gana', 'REMUNERACION'],
    ['remuneración de', 'REMUNERACION'], ['compañero', 'DATOS_PERSONALES'],
    ['compañera', 'DATOS_PERSONALES'], ['gerente', 'REMUNERACION'], ['jefe', 'DATOS_PERSONALES'],
    ['expediente de', 'DATOS_PERSONALES'], ['vacaciones de', 'VACACIONES'],
    ['evaluación de', 'DATOS_PERSONALES'], ['incapacidad de', 'DATOS_PERSONALES'],
    ['ausencias de', 'DATOS_PERSONALES'], ['datos personales de', 'DATOS_PERSONALES']
  ].map(([palabra, tema_asociado]) => ({ palabra, categoria: 'restringida', tema_asociado })),

  ...makeRows('fuera_alcance', [
    'película', 'receta', 'fútbol', 'partido', 'chiste', 'clima', 'programar', 'código python', 'música'
  ]),

  ...[
    ['me quedan', 'VACACIONES'], ['mi saldo', 'VACACIONES'], ['mis vacaciones', 'VACACIONES'],
    ['mi próximo pago', 'PAGOS'], ['mi solicitud', 'PERMISOS'], ['mi evaluación', 'DESEMPENO'],
    ['mis incapacidades', 'INCAPACIDADES'], ['mi puesto', 'DATOS_PERSONALES'],
    ['mi fecha de ingreso', 'DATOS_PERSONALES'], ['mis permisos', 'PERMISOS'],
    ['mis ausencias', 'DATOS_PERSONALES'], ['mi próxima evaluación', 'DESEMPENO']
  ].map(([palabra, tema_asociado]) => ({ palabra, categoria: 'dato_personal', tema_asociado })),

  ...[
    ['vacaciones', 'VACACIONES'], ['feriado', 'FERIADOS'], ['feriados', 'FERIADOS'],
    ['aguinaldo', 'REMUNERACION'], ['planilla', 'REMUNERACION'], ['ccss', 'INCAPACIDADES'],
    ['incapacidad', 'INCAPACIDADES'], ['ins', 'INCAPACIDADES'], ['teletrabajo', 'TELETRABAJO'],
    ['horas extra', 'JORNADA'], ['maternidad', 'PERMISOS'], ['paternidad', 'PERMISOS'],
    ['duelo', 'PERMISOS'], ['preaviso', 'SALIDA'], ['liquidación', 'SALIDA'],
    ['período de prueba', 'ONBOARDING'], ['seguro médico', 'BENEFICIOS'],
    ['asociación solidarista', 'BENEFICIOS'], ['acoso', 'CONDUCTA'], ['denuncias', 'DENUNCIAS'],
    ['privacidad', 'DATOS_PERSONALES'], ['jornada laboral', 'JORNADA'], ['permisos', 'PERMISOS'],
    ['licencias', 'PERMISOS'], ['salud ocupacional', 'INCAPACIDADES'], ['onboarding', 'ONBOARDING'],
    ['salida de colaboradores', 'SALIDA'], ['código de conducta', 'CONDUCTA'],
    ['protección de datos', 'DATOS_PERSONALES']
  ].map(([palabra, tema_asociado]) => ({ palabra, categoria: 'politica', tema_asociado })),

  ...[
    ['vacaciones', 'Vacaciones y Feriados'], ['días de vacaciones', 'Vacaciones y Feriados'],
    ['disfrute de vacaciones', 'Vacaciones y Feriados'], ['feriado', 'Vacaciones y Feriados'],
    ['feriados', 'Vacaciones y Feriados'], ['salario', 'Salarios y Aguinaldo'],
    ['sueldo', 'Salarios y Aguinaldo'], ['aguinaldo', 'Salarios y Aguinaldo'],
    ['planilla', 'Salarios y Aguinaldo'], ['pago quincenal', 'Salarios y Aguinaldo'],
    ['incapacidad', 'Incapacidades'], ['ccss', 'Incapacidades'], ['ins', 'Incapacidades'],
    ['licencia médica', 'Incapacidades'], ['teletrabajo', 'Jornada y Teletrabajo'],
    ['horas extra', 'Jornada y Teletrabajo'], ['jornada laboral', 'Jornada y Teletrabajo'],
    ['horario', 'Jornada y Teletrabajo'], ['maternidad', 'Permisos y Licencias'],
    ['paternidad', 'Permisos y Licencias'], ['duelo', 'Permisos y Licencias'],
    ['permisos', 'Permisos y Licencias'], ['licencias', 'Permisos y Licencias'],
    ['preaviso', 'Onboarding y Liquidación'], ['liquidación', 'Onboarding y Liquidación'],
    ['período de prueba', 'Onboarding y Liquidación'], ['ingreso', 'Onboarding y Liquidación'],
    ['salida', 'Onboarding y Liquidación'], ['seguro médico', 'Beneficios'],
    ['asociación solidarista', 'Beneficios'], ['beneficios', 'Beneficios'],
    ['acoso', 'Privacidad y Seguridad'], ['denuncia', 'Privacidad y Seguridad'],
    ['denuncias', 'Privacidad y Seguridad'], ['privacidad', 'Privacidad y Seguridad'],
    ['datos personales', 'Privacidad y Seguridad'], ['confidencialidad', 'Privacidad y Seguridad']
  ].map(([palabra, tema_asociado]) => ({ palabra, categoria: 'tema_dashboard', tema_asociado }))
];

async function upsertKeywords(PalabraClave, transaction) {
  for (const row of KEYWORD_SEEDS) await PalabraClave.upsert(row, { transaction });
}

module.exports = {
  KEYWORD_SEEDS,
  upsertKeywords,
  async up(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await upsertKeywords(initModels(queryInterface.sequelize).PalabraClave, transaction);
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
  async down() {
    throw new Error('La eliminación masiva de palabras_clave está deshabilitada.');
  }
};
