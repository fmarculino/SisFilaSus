const { createClient } = require('@supabase/supabase-js');

const NEW_URL = 'https://supabase-sisfilasus.coolify.vps.atb.app.br';
const NEW_SERVICE_KEY = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc4MDY5NjMyMCwiZXhwIjo0OTM2MzY5OTIwLCJyb2xlIjoic2VydmljZV9yb2xlIn0.mx_pcM74ValOQKHGAyoAhskcFTg3Qp6MxKIlMSXI61k';

const supabase = createClient(NEW_URL, NEW_SERVICE_KEY, { auth: { persistSession: false } });

async function cleanUsers() {
  console.log('Iniciando limpeza de usuários no novo banco dedicado...');
  try {
    // 1. Listar usuários da autenticação
    const { data, error } = await supabase.auth.admin.listUsers();
    if (error) throw error;

    const users = data.users || [];
    console.log(`Total de usuários encontrados no Auth: ${users.length}`);

    let adminUserId = null;

    for (const user of users) {
      const email = user.email.toLowerCase();
      if (email === 'admin@admin.com') {
        adminUserId = user.id;
        console.log(`Encontrado admin@admin.com (ID: ${user.id}). Atualizando senha para '379146Jr'...`);
        
        const { error: updateAuthErr } = await supabase.auth.admin.updateUserById(user.id, {
          password: '379146Jr',
          user_metadata: { nome: 'Admin', role: 'SMS_ADMIN' }
        });

        if (updateAuthErr) {
          console.error('Erro ao atualizar senha do admin no Auth:', updateAuthErr.message);
        } else {
          console.log('Senha do admin atualizada com sucesso no Auth.');
        }

        // Garantir que está correto na tabela pública
        const { error: updateProfileErr } = await supabase
          .from('users')
          .update({
            nome: 'Admin',
            role: 'SMS_ADMIN',
            active: true
          })
          .eq('id', user.id);

        if (updateProfileErr) {
          console.error('Erro ao atualizar perfil do admin na tabela public.users:', updateProfileErr.message);
        } else {
          console.log('Perfil público do admin atualizado para SMS_ADMIN.');
        }
      } else {
        console.log(`Removendo usuário: ${user.email} (ID: ${user.id})...`);
        
        // Deletar da tabela pública explicitamente
        const { error: delProfileErr } = await supabase
          .from('users')
          .delete()
          .eq('id', user.id);

        if (delProfileErr) {
          console.error(`Erro ao deletar perfil público de ${user.email}:`, delProfileErr.message);
        }

        // Deletar do Auth
        const { error: delAuthErr } = await supabase.auth.admin.deleteUser(user.id);
        if (delAuthErr) {
          console.error(`Erro ao deletar ${user.email} do Auth:`, delAuthErr.message);
        } else {
          console.log(`Usuário ${user.email} deletado com sucesso.`);
        }
      }
    }

    // Se o admin por acaso não foi encontrado (caso improvável), cria ele
    if (!adminUserId) {
      console.log('Aviso: admin@admin.com não foi encontrado no Auth. Criando nova conta...');
      const { data: created, error: createError } = await supabase.auth.admin.createUser({
        email: 'admin@admin.com',
        password: '379146Jr',
        email_confirm: true,
        user_metadata: { nome: 'Admin', role: 'SMS_ADMIN' }
      });

      if (createError) {
        throw new Error(`Erro ao criar admin@admin.com: ${createError.message}`);
      }

      console.log('admin@admin.com criado com sucesso.');

      const { error: updateProfileErr } = await supabase
        .from('users')
        .update({
          nome: 'Admin',
          role: 'SMS_ADMIN',
          active: true
        })
        .eq('id', created.user.id);

      if (updateProfileErr) {
        console.error('Erro ao atualizar perfil público do novo admin:', updateProfileErr.message);
      }
    }

    // Limpar quaisquer outros perfis órfãos na tabela public.users
    const { data: remainingDbUsers, error: listDbErr } = await supabase.from('users').select('id, email');
    if (!listDbErr && remainingDbUsers) {
      for (const dbUser of remainingDbUsers) {
        if (dbUser.email.toLowerCase() !== 'admin@admin.com') {
          console.log(`Limpando perfil órfão na tabela pública: ${dbUser.email}`);
          await supabase.from('users').delete().eq('id', dbUser.id);
        }
      }
    }

    console.log('🎉 LIMPEZA E CONFIGURAÇÃO DO ADMIN CONCLUÍDAS COM SUCESSO! 🎉');
  } catch (err) {
    console.error('Erro durante a execução do script:', err);
  }
}

cleanUsers();
