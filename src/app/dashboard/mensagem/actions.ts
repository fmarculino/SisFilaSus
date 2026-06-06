'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function saveTemplateAction(
  id: string | undefined,
  formData: {
    titulo: string
    corpo: string
    active?: boolean
  }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Não autenticado' }
  }

  // Verificar permissões (Apenas SMS_ADMIN e COORDENADOR)
  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || (profile.role !== 'SMS_ADMIN' && profile.role !== 'COORDENADOR')) {
    return { success: false, error: 'Acesso negado. Apenas administradores ou coordenadores podem gerenciar templates.' }
  }

  if (!formData.titulo.trim()) {
    return { success: false, error: 'O título do modelo é obrigatório.' }
  }

  if (!formData.corpo.trim()) {
    return { success: false, error: 'O corpo do modelo é obrigatório.' }
  }

  const payload = {
    titulo: formData.titulo.trim(),
    corpo: formData.corpo.trim(),
    active: formData.active !== undefined ? formData.active : true,
    updated_at: new Date().toISOString()
  }

  if (id) {
    const { error } = await supabase
      .from('templates_mensagem')
      .update(payload)
      .eq('id', id)

    if (error) {
      console.error('Erro ao atualizar template:', error.message)
      return { success: false, error: error.message }
    }
  } else {
    const { error } = await supabase
      .from('templates_mensagem')
      .insert(payload)

    if (error) {
      console.error('Erro ao cadastrar template:', error.message)
      return { success: false, error: error.message }
    }
  }

  revalidatePath('/dashboard/mensagem')
  revalidatePath('/dashboard/fila')
  revalidatePath('/dashboard/convocacao')
  return { success: true }
}

export async function deleteTemplateAction(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Não autenticado' }
  }

  // Verificar permissões
  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || (profile.role !== 'SMS_ADMIN' && profile.role !== 'COORDENADOR')) {
    return { success: false, error: 'Acesso negado.' }
  }

  const { error } = await supabase
    .from('templates_mensagem')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Erro ao deletar template:', error.message)
    return { success: false, error: error.message }
  }

  revalidatePath('/dashboard/mensagem')
  revalidatePath('/dashboard/fila')
  revalidatePath('/dashboard/convocacao')
  return { success: true }
}

export async function seedDefaultTemplatesAction() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Não autenticado' }
  }

  // Verificar permissões
  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || (profile.role !== 'SMS_ADMIN' && profile.role !== 'COORDENADOR')) {
    return { success: false, error: 'Acesso negado.' }
  }

  const defaultTemplates = [
    {
      titulo: 'Convocação de Fila (Cirurgias Eletivas)',
      corpo: 'Olá, {nome_usuario}.\n\nEntramos em contato da Regulação da Saúde de Marabá referente à sua solicitação de {desc_sigtap}. Sua posição atual na fila de espera é a {posicao_fila}º posição.\n\nPor favor, responda a esta mensagem confirmando se você ainda deseja realizar o procedimento.',
      active: true
    },
    {
      titulo: 'Confirmação de Agendamento (Consulta/Exame)',
      corpo: 'Prezado(a) {nome_usuario},\n\nSua solicitação para {desc_sigtap} foi AGENDADA para o dia {data_execucao} na unidade {nome_executante}.\n\nSua Chave de Confirmação é {chave_confirmacao}. Por favor, confirme seu comparecimento respondendo a esta mensagem.',
      active: true
    },
    {
      titulo: 'Busca Ativa - Pendente de Contato',
      corpo: 'Olá, {nome_usuario}.\n\nTentamos entrar em contato telefônico com você hoje referente ao seu pedido de {desc_sigtap} na regulação de saúde, mas não obtivemos sucesso.\n\nPedimos a gentileza de responder a esta mensagem informando seu número atualizado ou comparecer à Secretaria de Saúde o quanto antes.',
      active: true
    }
  ]

  const { error } = await supabase
    .from('templates_mensagem')
    .insert(defaultTemplates)

  if (error) {
    console.error('Erro ao semear templates padrão:', error.message)
    return { success: false, error: error.message }
  }

  revalidatePath('/dashboard/mensagem')
  revalidatePath('/dashboard/fila')
  revalidatePath('/dashboard/convocacao')
  return { success: true }
}
