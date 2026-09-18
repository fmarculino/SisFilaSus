import pg from 'pg';
const { Client } = pg;

async function testConnection() {
  const host = process.env.ESUS_DB_HOST || '10.110.2.8';
  const port = parseInt(process.env.ESUS_DB_PORT || '5433', 10);
  const database = process.env.ESUS_DB_NAME || 'esus';
  const user = process.env.ESUS_DB_USER || 'esus_leitura';
  const password = process.env.ESUS_DB_PASSWORD;

  if (!password) {
    console.error('❌ ERRO: A variável de ambiente ESUS_DB_PASSWORD não está definida.');
    console.error('Defina as variáveis no seu .env.local (que é ignorado pelo Git).');
    process.exit(1);
  }

  console.log(`🔄 Conectando ao PostgreSQL do e-SUS (${host}:${port}/${database}) com usuário ${user}...`);
  
  const client = new Client({
    host,
    port,
    database,
    user,
    password,
    connectionTimeoutMillis: 5000,
  });

  try {
    await client.connect();
    console.log('✅ Conexão estabelecida com sucesso!');
    const res = await client.query('SELECT count(*) FROM tb_cidadao WHERE st_ativo = 1;');
    console.log(`📊 Cidadãos ativos encontrados: ${res.rows[0].count}`);
  } catch (err) {
    console.error('❌ Erro na conexão:', err.message);
  } finally {
    await client.end();
  }
}

testConnection();
