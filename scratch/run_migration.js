const { createClient } = require('@supabase/supabase-js');

// Configurações do Banco Antigo (SisTEA compartido)
const OLD_URL = 'https://qcutdbktpmrnijkeeoln.supabase.co';
const OLD_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjdXRkYmt0cG1ybmlqa2Vlb2xuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDM0NTQxNiwiZXhwIjoyMDk1OTIxNDE2fQ.-Nr7-LG9mVb1QD_eDyiiuz9hieufhTj0x1eFBW3XPy0';

// Configurações do Banco Novo (Dedicado SisFilaSus)
const NEW_URL = 'https://supabase-sisfilatea.coolify.vps.atb.app.br';
const NEW_SERVICE_KEY = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc4MDY5NjMyMCwiZXhwIjo0OTM2MzY5OTIwLCJyb2xlIjoic2VydmljZV9yb2xlIn0.mx_pcM74ValOQKHGAyoAhskcFTg3Qp6MxKIlMSXI61k';

const oldSupabase = createClient(OLD_URL, OLD_SERVICE_KEY, { auth: { persistSession: false } });
const newSupabase = createClient(NEW_URL, NEW_SERVICE_KEY, { auth: { persistSession: false } });

// Mapa de IDs antigos para IDs novos para manter relações integras se necessário.
// Como as chaves primárias são UUIDs gerados ou códigos BigInt reais (cod_solicitacao, codigo_ibge, cnes, cod_sigtap, codigo_cid) 
// que são naturais do SISREG, podemos manter os mesmos IDs!
const CHUNK_SIZE = 500;

async function fetchAllRows(supabaseClient, table, orderCol) {
  let allRows = [];
  let from = 0;
  let to = CHUNK_SIZE - 1;
  let hasMore = true;

  console.log(`Buscando dados da tabela ${table} no banco antigo...`);

  while (hasMore) {
    const { data, error } = await supabaseClient
      .from(table)
      .select('*')
      .order(orderCol, { ascending: true })
      .range(from, to);

    if (error) {
      throw new Error(`Erro ao buscar dados de ${table}: ${error.message}`);
    }

    if (data && data.length > 0) {
      allRows = allRows.concat(data);
      from += CHUNK_SIZE;
      to += CHUNK_SIZE;
    } else {
      hasMore = false;
    }
  }

  console.log(`Total de registros carregados de ${table}: ${allRows.length}`);
  return allRows;
}

async function insertAllRows(supabaseClient, table, rows) {
  if (rows.length === 0) return;
  console.log(`Inserindo ${rows.length} registros na tabela ${table} do banco novo...`);
  
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE);
    const { error } = await supabaseClient
      .from(table)
      .insert(chunk);

    if (error) {
      console.error(`Erro inserindo chunk na tabela ${table}:`, error.message);
      throw error;
    }
  }
  console.log(`Concluído insert de ${table}`);
}

async function migrateUsers() {
  console.log('--- Migrando Usuários e Contas Auth ---');
  // Buscar usuários da base antiga
  const { data: oldUsers, error } = await oldSupabase.from('users').select('*');
  if (error) throw error;

  // Obter usuários auth da nova base para não duplicar
  const { data: newAuthUsersData, error: newAuthError } = await newSupabase.auth.admin.listUsers();
  if (newAuthError) throw newAuthError;
  const existingEmails = new Set(newAuthUsersData.users.map(u => u.email.toLowerCase()));

  const idMap = {}; // oldUserId -> newUserId

  for (const user of oldUsers) {
    const emailLower = user.email.toLowerCase();
    let newUserId;

    if (!existingEmails.has(emailLower)) {
      console.log(`Criando conta Auth para: ${user.nome} (${user.email})`);
      const { data: created, error: createError } = await newSupabase.auth.admin.createUser({
        email: user.email,
        password: 'Mudar@123!',
        email_confirm: true,
        user_metadata: { nome: user.nome, role: user.role }
      });

      if (createError) {
        console.error(`Erro ao criar conta Auth para ${user.email}:`, createError.message);
        continue;
      }
      newUserId = created.user.id;
    } else {
      const match = newAuthUsersData.users.find(u => u.email.toLowerCase() === emailLower);
      newUserId = match.id;
      console.log(`Usuário já existente no Auth: ${user.email}`);
    }

    idMap[user.id] = newUserId;

    // Atualizar perfil do usuário na tabela public.users do banco novo
    const { error: updateError } = await newSupabase
      .from('users')
      .update({
        nome: user.nome,
        role: user.role,
        cnes_vinculo: user.cnes_vinculo,
        active: user.active
      })
      .eq('id', newUserId);

    if (updateError) {
      console.error(`Erro ao atualizar perfil público de ${user.email}:`, updateError.message);
    }
  }

  return idMap;
}

async function startMigration() {
  console.log('Iniciando processo de migração de dados...');
  try {
    // 1. Usuários
    const userIdMap = await migrateUsers();

    // 2. Tabelas de Apoio Independentes
    const municipios = await fetchAllRows(oldSupabase, 'municipios', 'codigo_ibge');
    await insertAllRows(newSupabase, 'municipios', municipios);

    const unidades = await fetchAllRows(oldSupabase, 'unidades_solicitantes', 'cnes');
    await insertAllRows(newSupabase, 'unidades_solicitantes', unidades);

    const hospitais = await fetchAllRows(oldSupabase, 'hospitais_prestadores', 'id');
    await insertAllRows(newSupabase, 'hospitais_prestadores', hospitais);

    const procedimentos = await fetchAllRows(oldSupabase, 'procedimentos', 'cod_sigtap');
    await insertAllRows(newSupabase, 'procedimentos', procedimentos);

    const cids = await fetchAllRows(oldSupabase, 'cids', 'codigo_cid');
    await insertAllRows(newSupabase, 'cids', cids);

    const pacientes = await fetchAllRows(oldSupabase, 'pacientes', 'id');
    await insertAllRows(newSupabase, 'pacientes', pacientes);

    const importacoes = await fetchAllRows(oldSupabase, 'importacoes', 'id');
    // Mapear importado_por se o ID do usuário mudou
    const mappedImportacoes = importacoes.map(imp => ({
      ...imp,
      importado_por: userIdMap[imp.importado_por] || imp.importado_por
    }));
    await insertAllRows(newSupabase, 'importacoes', mappedImportacoes);

    // 3. Tabela Central
    const fila = await fetchAllRows(oldSupabase, 'fila_solicitacoes', 'cod_solicitacao');
    await insertAllRows(newSupabase, 'fila_solicitacoes', fila);

    // 4. Tabelas Dependentes
    const snapshots = await fetchAllRows(oldSupabase, 'fila_snapshots', 'id');
    await insertAllRows(newSupabase, 'fila_snapshots', snapshots);

    const contatos = await fetchAllRows(oldSupabase, 'contatos', 'id');
    const mappedContatos = contatos.map(c => ({
      ...c,
      operador_id: userIdMap[c.operador_id] || c.operador_id
    }));
    await insertAllRows(newSupabase, 'contatos', mappedContatos);

    const movimentacoes = await fetchAllRows(oldSupabase, 'movimentacoes_fila', 'id');
    const mappedMovimentacoes = movimentacoes.map(m => ({
      ...m,
      solicitada_por: userIdMap[m.solicitada_por] || m.solicitada_por,
      aprovada_por: m.aprovada_por ? (userIdMap[m.aprovada_por] || m.aprovada_por) : null
    }));
    await insertAllRows(newSupabase, 'movimentacoes_fila', mappedMovimentacoes);

    const templates = await fetchAllRows(oldSupabase, 'templates_mensagem', 'id');
    await insertAllRows(newSupabase, 'templates_mensagem', templates);

    const configs = await fetchAllRows(oldSupabase, 'configuracoes', 'id');
    await insertAllRows(newSupabase, 'configuracoes', configs);

    const auditLogs = await fetchAllRows(oldSupabase, 'audit_log', 'id');
    const mappedAuditLogs = auditLogs.map(l => ({
      ...l,
      usuario_id: l.usuario_id ? (userIdMap[l.usuario_id] || l.usuario_id) : null
    }));
    await insertAllRows(newSupabase, 'audit_log', mappedAuditLogs);

    console.log('🎉 MIGRAÇÃO DE DADOS E USUÁRIOS CONCLUÍDA COM SUCESSO! 🎉');
  } catch (err) {
    console.error('❌ FATAL: ERRO NA MIGRAÇÃO:', err);
  }
}

startMigration();
