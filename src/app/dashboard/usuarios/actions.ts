'use server'

import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createUserAction(formData: {
  nome: string
  email: string
  role: string
  cnes_vinculo: string | null
  hospital_id?: string | null
  active: boolean
  password: string
}) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Erro de Configuração: SUPABASE_SERVICE_ROLE_KEY não está configurado.')
    return { success: false, error: 'Erro de Configuração: A variável de ambiente SUPABASE_SERVICE_ROLE_KEY não está configurada no servidor.' }
  }

  // Validar permissão do usuário que está executando a ação
  const authSupabase = await createClient()
  const { data: { user: callerAuth }, error: callerAuthError } = await authSupabase.auth.getUser()

  if (callerAuthError || !callerAuth) {
    return { success: false, error: 'Sessão inválida ou expirada. Faça login novamente.' }
  }

  const { data: callerProfile } = await authSupabase
    .from('users')
    .select('role')
    .eq('id', callerAuth.id)
    .single()

  const callerRole = callerProfile?.role || ''

  if (!['SMS_ADMIN', 'COORDENADOR'].includes(callerRole)) {
    return { success: false, error: 'Permissão negada. Você não possui privilégios para gerenciar usuários.' }
  }

  // REGRA ESTRITA: Apenas SMS_ADMIN pode criar outro SMS_ADMIN
  if (formData.role === 'SMS_ADMIN' && callerRole !== 'SMS_ADMIN') {
    return { 
      success: false, 
      error: 'Permissão negada: Apenas um Administrador Geral pode cadastrar outro usuário com o perfil de Administrador.' 
    }
  }

  const supabase = createAdminClient()

  // 1. Criar a conta de autenticação no Supabase Auth
  const { data: created, error: authError } = await supabase.auth.admin.createUser({
    email: formData.email,
    password: formData.password,
    email_confirm: true,
    user_metadata: {
      nome: formData.nome,
      role: formData.role
    }
  })

  if (authError) {
    console.error('Erro ao criar usuário no Auth:', authError.message)
    return { success: false, error: authError.message }
  }

  const userId = created.user.id

  // 2. O trigger on_auth_user_created insere o perfil, mas precisamos
  // atualizar os campos específicos (role, cnes_vinculo, hospital_id, nome, active)
  const { error: profileError } = await supabase
    .from('users')
    .update({
      nome: formData.nome,
      role: formData.role,
      cnes_vinculo: formData.role === 'UNIDADE_USER' ? formData.cnes_vinculo : null,
      hospital_id: formData.role === 'PRESTADOR_USER' ? (formData.hospital_id || null) : null,
      active: formData.active
    })
    .eq('id', userId)

  if (profileError) {
    console.error('Erro ao atualizar perfil do usuário:', profileError.message)
    // Tenta deletar o usuário auth se falhou a criação do perfil
    await supabase.auth.admin.deleteUser(userId)
    return { success: false, error: 'Falha ao salvar dados de perfil. Usuário descartado.' }
  }

  revalidatePath('/dashboard/usuarios')
  return { success: true }
}

export async function updateUserAction(
  userId: string,
  formData: {
    nome: string
    email: string
    role: string
    cnes_vinculo: string | null
    hospital_id?: string | null
    active: boolean
    password?: string
  }
) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Erro de Configuração: SUPABASE_SERVICE_ROLE_KEY não está configurado.')
    return { success: false, error: 'Erro de Configuração: A variável de ambiente SUPABASE_SERVICE_ROLE_KEY não está configurada no servidor.' }
  }

  // Validar permissão do usuário que está executando a ação
  const authSupabase = await createClient()
  const { data: { user: callerAuth }, error: callerAuthError } = await authSupabase.auth.getUser()

  if (callerAuthError || !callerAuth) {
    return { success: false, error: 'Sessão inválida ou expirada. Faça login novamente.' }
  }

  const { data: callerProfile } = await authSupabase
    .from('users')
    .select('role')
    .eq('id', callerAuth.id)
    .single()

  const callerRole = callerProfile?.role || ''

  if (!['SMS_ADMIN', 'COORDENADOR'].includes(callerRole)) {
    return { success: false, error: 'Permissão negada. Você não possui privilégios para gerenciar usuários.' }
  }

  const supabase = createAdminClient()

  // Buscar dados atuais do usuário alvo
  const { data: targetUser } = await supabase
    .from('users')
    .select('role')
    .eq('id', userId)
    .single()

  // REGRA ESTRITA: Apenas SMS_ADMIN pode modificar ou alterar status de outro SMS_ADMIN
  if (targetUser?.role === 'SMS_ADMIN' && callerRole !== 'SMS_ADMIN') {
    return { 
      success: false, 
      error: 'Permissão negada: Apenas um Administrador Geral pode modificar ou inativar contas de Administrador.' 
    }
  }

  // REGRA ESTRITA: Apenas SMS_ADMIN pode promover ou atribuir a role SMS_ADMIN
  if (formData.role === 'SMS_ADMIN' && callerRole !== 'SMS_ADMIN') {
    return { 
      success: false, 
      error: 'Permissão negada: Apenas um Administrador Geral pode conceder o perfil de Administrador.' 
    }
  }

  // 1. Atualizar na tabela pública
  const { error: profileError } = await supabase
    .from('users')
    .update({
      nome: formData.nome,
      role: formData.role,
      cnes_vinculo: formData.role === 'UNIDADE_USER' ? formData.cnes_vinculo : null,
      hospital_id: formData.role === 'PRESTADOR_USER' ? (formData.hospital_id || null) : null,
      active: formData.active
    })
    .eq('id', userId)

  if (profileError) {
    console.error('Erro ao atualizar dados do perfil público:', profileError.message)
    return { success: false, error: profileError.message }
  }

  // 2. Atualizar no Auth
  const updateParams: any = {
    email: formData.email,
    user_metadata: {
      nome: formData.nome,
      role: formData.role
    }
  }

  if (formData.password && formData.password.trim() !== '') {
    updateParams.password = formData.password
  }

  const { error: authError } = await supabase.auth.admin.updateUserById(userId, updateParams)

  if (authError) {
    console.error('Erro ao atualizar dados do usuário no Auth:', authError.message)
    return { success: false, error: authError.message }
  }

  revalidatePath('/dashboard/usuarios')
  return { success: true }
}


