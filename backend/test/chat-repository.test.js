'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { Op } = require('sequelize');
const { createChatRepository } = require('../src/repositories/chatRepository');
const HttpError = require('../src/utils/httpError');
const migration = require('../migrations/20261118000100-add-orchestrator-conversations');

const USER_ONE = '00000000-0000-4000-8000-000000000001';
const USER_TWO = '00000000-0000-4000-8000-000000000002';
const CONVERSATION_ONE = '10000000-0000-4000-8000-000000000001';
const REQUEST_KEY = '20000000-0000-4000-8000-000000000001';

function matches(record, where = {}) {
  return Object.entries(where).every(([key, expected]) => {
    if (expected && typeof expected === 'object') {
      if (Object.hasOwn(expected, Op.ne)) return record[key] !== expected[Op.ne];
      if (Object.hasOwn(expected, Op.in)) return expected[Op.in].includes(record[key]);
    }
    return record[key] === expected;
  });
}

function selected(record, attributes) {
  if (!record || !attributes) return record;
  return Object.fromEntries(attributes.map((name) => [name, record[name]]));
}

function createMemoryRepository() {
  const conversations = [];
  const messages = [];
  const sequelize = { transaction: async (callback) => callback({ LOCK: { UPDATE: 'UPDATE' } }) };
  const makeModel = (rows) => ({
    create: async (record) => { rows.push({ ...record }); return rows.at(-1); },
    findOne: async (options) => selected(rows.find((row) => matches(row, options.where)) || null, options.attributes),
    findAll: async (options) => {
      let result = rows.filter((row) => matches(row, options.where));
      if (options.order?.length) {
        const [field, direction] = options.order[0];
        result = result.sort((a, b) => String(a[field] ?? '').localeCompare(String(b[field] ?? '')) * (direction === 'DESC' ? -1 : 1));
      }
      return result.slice(0, options.limit).map((row) => selected(row, options.attributes));
    },
    update: async (values, options) => {
      const selectedRows = rows.filter((row) => matches(row, options.where));
      selectedRows.forEach((row) => Object.assign(row, values));
      return [selectedRows.length];
    }
  });
  const models = {
    Conversacion: makeModel(conversations),
    ConsultaChat: makeModel(messages),
    Colaborador: { findOne: async ({ where }) => ({ id: where.usuario_id === USER_ONE ? '40000000-0000-4000-8000-000000000001' : '40000000-0000-4000-8000-000000000002' }) }
  };
  return {
    repository: createChatRepository({
      writeConnectionFactory: () => sequelize,
      readConnectionFactory: () => sequelize,
      modelsFactory: () => models,
      now: () => new Date('2026-11-18T12:00:00.000Z')
    }),
    conversations,
    messages
  };
}

test('idempotencia reserva una consulta una sola vez y permite repetirla sin otra escritura', async () => {
  const { repository, conversations, messages } = createMemoryRepository();
  const input = { userId: USER_ONE, requestId: REQUEST_KEY, question: '¿Cuántos días de vacaciones tengo?' };
  const reserved = await repository.reserveMessage(input);
  assert.equal(reserved.status, 'RESERVED');
  assert.equal(conversations.length, 1);
  assert.equal(messages.length, 1);
  assert.equal(messages[0].colaborador_id, '40000000-0000-4000-8000-000000000001');

  await repository.completeMessage({
    userId: USER_ONE,
    messageId: reserved.messageId,
    response: 'Tienes 12 días.',
    intent: 'DATO_PERSONAL',
    topic: 'VACACIONES',
    agentsUsed: ['DATOS_COLABORADOR'],
    fragmentsUsed: [],
    citations: [],
    documentsCited: [],
    resolution: 'RESPONDIDA',
    escalated: false,
    escalationSuggested: false,
    latencyMs: 120
  });

  const duplicate = await repository.reserveMessage(input);
  assert.equal(duplicate.status, 'COMPLETED');
  assert.equal(duplicate.response.answer, 'Tienes 12 días.');
  assert.equal(duplicate.response.messageId, reserved.messageId);
  assert.equal(duplicate.response.intent, 'DATO_PERSONAL');
  assert.equal(conversations.length, 1);
  assert.equal(messages.length, 1);
  await assert.rejects(repository.reserveMessage({ ...input, question: 'otra pregunta' }), (error) => error.status === 409);
});

test('un reintento de una consulta fallida reutiliza el mismo registro idempotente', async () => {
  const { repository, conversations, messages } = createMemoryRepository();
  const input = { userId: USER_ONE, requestId: REQUEST_KEY, question: 'Consulta temporalmente fallida' };
  const firstAttempt = await repository.reserveMessage(input);
  await repository.failMessage({ userId: USER_ONE, messageId: firstAttempt.messageId, latencyMs: 5 });

  const retry = await repository.reserveMessage(input);
  assert.equal(retry.status, 'RESERVED');
  assert.equal(retry.retry, true);
  assert.equal(retry.messageId, firstAttempt.messageId);
  assert.equal(messages.length, 1);
  assert.equal(conversations.length, 1);
  assert.equal(messages[0].respuesta, null);
  assert.equal(messages[0].resolucion, null);
});

test('historial y conversaciones filtran por usuario autenticado y no admiten lectura cruzada', async () => {
  const { repository } = createMemoryRepository();
  const first = await repository.reserveMessage({ userId: USER_ONE, requestId: REQUEST_KEY, question: 'Consulta uno' });
  const second = await repository.reserveMessage({ userId: USER_TWO, requestId: REQUEST_KEY, question: 'Consulta dos' });
  assert.notEqual(first.conversationId, second.conversationId);
  await repository.completeMessage({
    userId: USER_ONE, messageId: first.messageId, response: 'Respuesta uno', intent: 'POLITICA', topic: 'VACACIONES',
    agentsUsed: ['POLITICAS'], fragmentsUsed: [{ id: 'fragmento-1' }],
    citations: [{ reference: 1, section: 'Vacaciones' }], documentsCited: [{ title: 'Política' }],
    resolution: 'RESPONDIDA', escalated: false, escalationSuggested: false, latencyMs: 20
  });
  await repository.completeMessage({
    userId: USER_TWO, messageId: second.messageId, response: 'Respuesta dos', intent: 'DATO_PERSONAL', topic: 'PAGOS',
    agentsUsed: ['DATOS_COLABORADOR'], fragmentsUsed: [], citations: [],
    resolution: 'RESPONDIDA', escalated: false, escalationSuggested: false, latencyMs: 30
  });

  assert.equal((await repository.getHistory(USER_ONE)).length, 1);
  assert.equal((await repository.getHistory(USER_ONE))[0].answer, 'Respuesta uno');
  assert.deepEqual((await repository.getHistory(USER_ONE))[0].citations, [{ reference: 1, section: 'Vacaciones' }]);
  assert.deepEqual((await repository.getHistory(USER_ONE))[0].documentsCited, [{ title: 'Política' }]);
  assert.equal((await repository.getHistory(USER_TWO))[0].answer, 'Respuesta dos');
  assert.equal((await repository.listConversations(USER_ONE)).length, 1);
  assert.equal((await repository.listConversations(USER_TWO)).length, 1);
  assert.equal((await repository.getConversation(USER_ONE, first.conversationId)).messages.length, 1);
  await assert.rejects(repository.getConversation(USER_TWO, first.conversationId), (error) => error instanceof HttpError && error.status === 404);
  await assert.rejects(repository.getHistory(USER_TWO, { conversationId: first.conversationId }), (error) => error.status === 404);
  assert.deepEqual(await repository.getConversationContext(USER_ONE, first.conversationId), [{ intent: 'POLITICA', topic: 'VACACIONES' }]);
  assert.deepEqual(await repository.getConversationContext(USER_TWO, first.conversationId), []);
});

test('migración agrega memoria e índices sin borrar datos y puede reintentarse', async () => {
  const tables = new Set(['usuarios', 'colaboradores', 'consultas_chat']);
  const chatColumns = new Set(['id', 'usuario_id', 'pregunta', 'respuesta']);
  const conversationColumns = new Set();
  const constraints = new Set();
  const indexes = new Map();
  let creates = 0;
  const qi = {
    showAllTables: async () => [...tables],
    createTable: async (name) => { tables.add(name); creates += 1; },
    describeTable: async (name) => Object.fromEntries([...(name === 'consultas_chat' ? chatColumns : conversationColumns)].map((column) => [column, {}])),
    addColumn: async (table, name) => (table === 'consultas_chat' ? chatColumns : conversationColumns).add(name),
    sequelize: {
      query: async (_sql, { replacements }) => constraints.has(replacements.constraintName) ? [{ CONSTRAINT_NAME: replacements.constraintName }] : []
    },
    addConstraint: async (_table, definition) => constraints.add(definition.name),
    showIndex: async (table) => indexes.get(table) || [],
    addIndex: async (table, _fields, options) => {
      const current = indexes.get(table) || [];
      current.push({ name: options.name });
      indexes.set(table, current);
    }
  };
  await migration.up(qi);
  await migration.up(qi);
  assert.equal(creates, 1);
  assert.ok(chatColumns.has('conversacion_id'));
  assert.ok(chatColumns.has('intencion'));
  assert.ok(chatColumns.has('citas_documentales'));
  assert.ok(chatColumns.has('escalamiento_sugerido'));
  assert.ok(tables.has('conversaciones'));
  assert.equal(constraints.size, 3);
  assert.equal(indexes.get('consultas_chat').length, 2);
  assert.equal(indexes.get('conversaciones').length, 1);
  await assert.rejects(migration.down(), /eliminación de conversaciones/i);
});
