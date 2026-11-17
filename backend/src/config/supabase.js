'use strict';
const { createClient } = require('@supabase/supabase-js');
let client;
function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw Object.assign(new Error('Credenciales Supabase no configuradas.'), { code: 'SUPABASE_NOT_CONFIGURED' });
  if (!client) client = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } });
  return client;
}
module.exports = { getSupabase };
