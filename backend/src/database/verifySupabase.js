'use strict';
require('dotenv').config();
const { checkConnection } = require('../services/vector-store.service');
checkConnection().then(() => console.log('Conexión con document_chunks correcta.')).catch((error) => { console.error('No se pudo verificar Supabase:', error.code || error.message); process.exitCode = 1; });
