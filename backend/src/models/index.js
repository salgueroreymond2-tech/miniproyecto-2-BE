'use strict';
const { DataTypes: D } = require('sequelize');
const { getConnection } = require('../config/database');

function initModels(sequelize = getConnection()) {
  if (sequelize.models.Usuario) return sequelize.models;
  const id = { type: D.CHAR(36), primaryKey: true };
  const uuid = () => ({ type: D.CHAR(36), allowNull: false });
  const text = (n) => ({ type: D.STRING(n), allowNull: false });
  const date = () => ({ type: D.DATEONLY, allowNull: false });
  const enums = (...values) => ({ type: D.ENUM(...values), allowNull: false });
  const define = (name, tableName, attributes) => sequelize.define(name, { id: { ...id }, ...attributes }, { tableName, timestamps: false, freezeTableName: true });
  const Usuario = define('Usuario', 'usuarios', { email: text(254), password_hash: text(60), rol: enums('COLABORADOR', 'RRHH'), activo: D.BOOLEAN, creado_en: D.DATE });
  const Departamento = define('Departamento', 'departamentos', { nombre: text(100) });
  const Puesto = define('Puesto', 'puestos', { departamento_id: uuid(), nombre: text(120) });
  const Colaborador = define('Colaborador', 'colaboradores', { usuario_id: uuid(), departamento_id: uuid(), puesto_id: uuid(), codigo: text(16), identificacion_ficticia: text(32), nombres: text(100), apellidos: text(100), email_corporativo: text(254), fecha_ingreso: date(), fecha_salida: D.DATEONLY, modalidad: enums('PRESENCIAL', 'HIBRIDO', 'TELETRABAJO'), salario_base: D.DECIMAL(14, 2), estado: enums('ACTIVO', 'INACTIVO', 'SUSPENDIDO') });
  const SaldoVacaciones = define('SaldoVacaciones', 'saldos_vacaciones', { colaborador_id: uuid(), periodo_anual: D.SMALLINT, dias_generados: D.DECIMAL(5, 2), dias_disfrutados: D.DECIMAL(5, 2), dias_ajuste: D.DECIMAL(5, 2), dias_disponibles: D.DECIMAL(5, 2) });
  const Solicitud = define('Solicitud', 'solicitudes', { colaborador_id: uuid(), tipo: enums('VACACIONES', 'PERMISO_PERSONAL', 'PERMISO_DUELO', 'PERMISO_FORMACION', 'LICENCIA_SIN_GOCE', 'OTRA'), fecha_inicio: date(), fecha_fin: date(), dias_solicitados: D.DECIMAL(5, 2), estado: enums('PENDIENTE', 'APROBADA', 'RECHAZADA', 'CANCELADA'), creado_en: D.DATE });
  const Incapacidad = define('Incapacidad', 'incapacidades', { colaborador_id: uuid(), referencia_ccss: text(80), fecha_inicio: date(), fecha_fin: date(), estado: enums('REGISTRADA', 'EN_REVISION', 'CERRADA') });
  const MovimientoPersonal = define('MovimientoPersonal', 'movimientos_personal', { colaborador_id: uuid(), tipo: enums('INGRESO', 'SALIDA', 'ASCENSO', 'CAMBIO_PUESTO', 'CAMBIO_DEPARTAMENTO'), fecha_efectiva: date(), detalle: D.JSON });
  const CalendarioPago = define('CalendarioPago', 'calendario_pagos', { fecha_pago: date(), fecha_corte_inicio: date(), fecha_corte_fin: date(), tipo: enums('QUINCENA_1', 'QUINCENA_2', 'AGUINALDO', 'EXTRAORDINARIO'), estado: enums('PROGRAMADO', 'PROCESADO', 'CANCELADO') });
  const EvaluacionDesempeno = define('EvaluacionDesempeno', 'evaluaciones_desempeno', { colaborador_id: uuid(), evaluador_id: D.CHAR(36), periodo_inicio: date(), periodo_fin: date(), estado: enums('BORRADOR', 'PENDIENTE', 'COMPLETADA'), resultado: D.STRING(80), resumen: D.TEXT });
  const ConsultaChat = define('ConsultaChat', 'consultas_chat', {
    usuario_id: uuid(), pregunta: D.TEXT, respuesta: D.TEXT, agente: D.STRING(80), creado_en: D.DATE,
    resolucion: D.ENUM('RESPONDIDA', 'SIN_EVIDENCIA', 'ERROR'), latencia_ms: D.INTEGER.UNSIGNED,
    fragmentos_utilizados: D.JSON, documentos_citados: D.JSON
  });
  const ReporteDiario = define('ReporteDiario', 'reportes_diarios', { fecha: date(), metricas: D.JSON, creado_en: D.DATE });
  const Documento = define('Documento', 'documentos', { drive_file_id: text(255), titulo: text(250), version: text(32), estado: enums('PENDIENTE', 'VALIDADO', 'ELIMINADO'), content_hash: D.CHAR(64), actualizado_en: D.DATE });
  const DocumentChunk = define('DocumentChunk', 'document_chunks_e5', { document_id: uuid(), drive_file_id: text(255), title: text(250), content: D.TEXT, section: D.STRING(250), page_number: D.INTEGER, chunk_index: D.INTEGER, version: text(32), source_url: D.TEXT, category: enums('POLITICA', 'PROCEDIMIENTO', 'DOCUMENTO_PUBLICO'), effective_date: D.DATEONLY, content_hash: D.CHAR(64), embedding_model: text(80), embedding: D.JSON, metadata: D.JSON, validation_status: enums('PENDIENTE', 'VALIDADO', 'ELIMINADO'), is_active: D.BOOLEAN, created_at: D.DATE, updated_at: D.DATE });
  const Sincronizacion = define('Sincronizacion', 'sincronizaciones', { origen: text(80), estado: enums('PENDIENTE', 'EN_PROCESO', 'COMPLETADA', 'FALLIDA'), inicio_en: D.DATE, finalizo_en: D.DATE, documentos_leidos: D.INTEGER, documentos_actualizados: D.INTEGER });
  const LogAgente = define('LogAgente', 'logs_agentes', { consulta_chat_id: D.CHAR(36), agente: text(80), operacion: text(120), estado: enums('INICIADO', 'COMPLETADO', 'ERROR'), creado_en: D.DATE });
  const IngestionApproval = define('IngestionApproval', 'ingestion_approvals', {
    drive_file_id: text(255), content_hash: text(64), approved_by: uuid(), approved_at: D.DATE,
    category: D.ENUM('POLITICA', 'PROCEDIMIENTO', 'DOCUMENTO_PUBLICO'), effective_date: D.DATEONLY,
    legal_sources: D.JSON, data_reviewed: D.BOOLEAN, normative_reviewed: D.BOOLEAN
  });
  const DriveIngestionState = sequelize.define('DriveIngestionState', { folder_id: { type: D.STRING(255), primaryKey: true }, bootstrap_token: D.TEXT, cursor_token: D.TEXT, pilot_done: D.BOOLEAN, initial_sync_done: D.BOOLEAN, updated_at: D.DATE }, { tableName: 'drive_ingestion_state', timestamps: false, freezeTableName: true });
  const VectorCacheState = sequelize.define('VectorCacheState', { id: { type: D.TINYINT, primaryKey: true }, revision: D.BIGINT.UNSIGNED }, { tableName: 'vector_cache_state', timestamps: false, freezeTableName: true });

  Usuario.hasOne(Colaborador, { foreignKey: 'usuario_id' }); Colaborador.belongsTo(Usuario, { foreignKey: 'usuario_id' });
  Departamento.hasMany(Puesto, { foreignKey: 'departamento_id' }); Puesto.belongsTo(Departamento, { foreignKey: 'departamento_id' });
  Departamento.hasMany(Colaborador, { foreignKey: 'departamento_id' }); Colaborador.belongsTo(Departamento, { foreignKey: 'departamento_id' });
  Puesto.hasMany(Colaborador, { foreignKey: 'puesto_id' }); Colaborador.belongsTo(Puesto, { foreignKey: 'puesto_id' });
  for (const model of [SaldoVacaciones, Solicitud, Incapacidad, MovimientoPersonal, EvaluacionDesempeno]) {
    Colaborador.hasMany(model, { foreignKey: 'colaborador_id' }); model.belongsTo(Colaborador, { foreignKey: 'colaborador_id' });
  }
  Colaborador.hasMany(EvaluacionDesempeno, { foreignKey: 'evaluador_id', as: 'EvaluacionesRealizadas' });
  EvaluacionDesempeno.belongsTo(Colaborador, { foreignKey: 'evaluador_id', as: 'Evaluador' });
  Usuario.hasMany(ConsultaChat, { foreignKey: 'usuario_id' }); ConsultaChat.belongsTo(Usuario, { foreignKey: 'usuario_id' });
  ConsultaChat.hasMany(LogAgente, { foreignKey: 'consulta_chat_id' }); LogAgente.belongsTo(ConsultaChat, { foreignKey: 'consulta_chat_id' });
  Documento.hasMany(DocumentChunk, { foreignKey: 'document_id' }); DocumentChunk.belongsTo(Documento, { foreignKey: 'document_id' });
  Usuario.hasMany(IngestionApproval, { foreignKey: 'approved_by' }); IngestionApproval.belongsTo(Usuario, { foreignKey: 'approved_by' });
  return sequelize.models;
}
module.exports = { initModels };
