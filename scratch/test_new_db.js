const { createClient } = require('@supabase/supabase-js');

const NEW_URL = 'https://supabase-sisfilasus.coolify.vps.atb.app.br';
const NEW_SERVICE = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc4MDY5NjMyMCwiZXhwIjo0OTM2MzY5OTIwLCJyb2xlIjoic2VydmljZV9yb2xlIn0.mx_pcM74ValOQKHGAyoAhskcFTg3Qp6MxKIlMSXI61k';

async function test() {
  console.log('Testing connection to new corrected Supabase URL...');
  try {
    const supabase = createClient(NEW_URL, NEW_SERVICE, {
      auth: { persistSession: false }
    });
    
    // Check patients count
    const { count, error } = await supabase.from('pacientes').select('*', { count: 'exact', head: true });
    if (error) {
      console.log('Query patients table error:', error.message);
    } else {
      console.log('Successfully queried patients table, count:', count);
    }

    // Check solicitacoes count
    const { count: solCount, error: solError } = await supabase.from('fila_solicitacoes').select('*', { count: 'exact', head: true });
    if (solError) {
      console.log('Query fila_solicitacoes table error:', solError.message);
    } else {
      console.log('Successfully queried fila_solicitacoes table, count:', solCount);
    }

    // Try auth admin api
    const { data: users, error: authError } = await supabase.auth.admin.listUsers();
    if (authError) {
      console.error('Auth Admin Error:', authError.message);
    } else {
      console.log('Successfully listed users, count:', users.users.length);
    }
  } catch (err) {
    console.error('Fatal connection error:', err.message);
  }
}

test();
