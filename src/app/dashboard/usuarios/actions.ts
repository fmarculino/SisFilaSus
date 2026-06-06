'use server'

import { createAdminClient } from '@/utils/supabase/admin'
import { revalidatePath } from 'next/cache'

export async function createUserAction(formData: {
  nome: string
  email: string
  role: string
  cnes_vinculo: string | null
  active: boolean
  password: string
}) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Erro de Configuração: SUPABASE_SERVICE_ROLE_KEY não está configurado.')
    return { success: false, error: 'Erro de Configuração: A variável de ambiente SUPABASE_SERVICE_ROLE_KEY não está configurada no servidor.' }
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
  // atualizar os campos específicos (role, cnes_vinculo, nome, active)
  const { error: profileError } = await supabase
    .from('users')
    .update({
      nome: formData.nome,
      role: formData.role,
      cnes_vinculo: formData.role === 'UNIDADE_USER' ? formData.cnes_vinculo : null,
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
    active: boolean
    password?: string
  }
) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Erro de Configuração: SUPABASE_SERVICE_ROLE_KEY não está configurado.')
    return { success: false, error: 'Erro de Configuração: A variável de ambiente SUPABASE_SERVICE_ROLE_KEY não está configurada no servidor.' }
  }

  const supabase = createAdminClient()

  // 1. Atualizar na tabela pública
  const { error: profileError } = await supabase
    .from('users')
    .update({
      nome: formData.nome,
      role: formData.role,
      cnes_vinculo: formData.role === 'UNIDADE_USER' ? formData.cnes_vinculo : null,
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


