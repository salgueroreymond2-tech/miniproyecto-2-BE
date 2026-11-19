'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createAuthRepository } = require('../src/repositories/authRepository');
const { createSelfRepository } = require('../src/repositories/selfRepository');

test('autenticación y perfil usan filtros ORM con identidad autenticada como parámetro', async () => {
  const calls = [];
  const models = {
    Usuario: { findOne: async (options) => { calls.push({ model: 'Usuario', options }); return null; } },
    Colaborador: {
      findOne: async (options) => { calls.push({ model: 'Colaborador', options }); return null; },
      findAll: async (options) => { calls.push({ model: 'Colaborador', options }); return []; }
    },
    SaldoVacaciones: { findAll: async (options) => { calls.push({ model: 'SaldoVacaciones', options }); return []; } },
    Solicitud: { findAll: async (options) => { calls.push({ model: 'Solicitud', options }); return []; } },
    CalendarioPago: { findOne: async (options) => { calls.push({ model: 'CalendarioPago', options }); return null; } },
    Departamento: {}, Puesto: {}
  };
  const auth = createAuthRepository({ connectionFactory: () => ({}), modelsFactory: () => models });
  const self = createSelfRepository({ connectionFactory: () => ({}), modelsFactory: () => models });
  const injection = "' OR 1=1 --";
  await auth.findByEmail(injection);
  await auth.findById(injection);
  await self.getProfile(injection);
  await self.getVacations(injection);
  await self.getRequests(injection);
  await self.getNextPayday();
  await self.listEmployees();
  assert.equal(calls.length, 7);
  assert.ok(calls.every(({ options }) => typeof options === 'object' && !('query' in options)));
  assert.deepEqual(calls[0].options.where, { email: injection });
  assert.deepEqual(calls[1].options.where, { id: injection });
  assert.deepEqual(calls[2].options.where, { usuario_id: injection });
  assert.deepEqual(calls[3].options.include[0].where, { usuario_id: injection });
  assert.deepEqual(calls[4].options.include[0].where, { usuario_id: injection });
  assert.equal(calls.some(({ options }) => JSON.stringify(options).includes('SELECT ')), false);
});
