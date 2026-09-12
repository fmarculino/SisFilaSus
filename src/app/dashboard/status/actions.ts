'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { logAudit } from '@/lib/audit'

export async function saveStatusAction(
  id: string | undefined,
  data: {
    codigo: string
    nome: string
    origem: string
    cor: string
    descricao?: string
    active: boolean
    ordem?: number
  }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Não autenticado')
  }

  // Verificar permissão
  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || (profile.role !== 'SMS_ADMIN' && profile.role !== 'COORDENADOR')) {
    throw new Error('Apenas administradores e coordenadores podem gerenciar status.')
  }

  const payload: any = {
    nome: data.nome.trim(),
    origem: data.origem.trim(),
    cor: data.cor.trim(),
    descricao: data.descricao?.trim() || null,
    active: data.active,
    ordem: data.ordem ?? 50,
    updated_at: new Date().toISOString()
  }

  let result
  if (id) {
    // Edição
    const { data: previous } = await supabase
      .from('status_solicitacao')
      .select('*')
      .eq('id', id)
      .single()

    // Não alterar código se for bloqueado
    if (!previous?.bloqueado_edicao_codigo) {
      payload.codigo = data.codigo.trim().toUpperCase().replace(/\s+/g, '_')
    }

    const { data: updated, error } = await supabase
      .from('status_solicitacao')
      .update(payload)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      throw new Error(`Erro ao atualizar status: ${error.message}`)
    }
    result = updated

    await logAudit({
      acao: 'UPDATE',
      tabela: 'status_solicitacao',
      registro_id: id,
      dados_anteriores: previous,
      dados_novos: payload
    })
  } else {
    // Inserção de Novo Status
    const normalizedCodigo = data.codigo.trim().toUpperCase().replace(/\s+/g, '_')
    payload.codigo = normalizedCodigo
    payload.bloqueado_edicao_codigo = false

    const { data: inserted, error } = await supabase
      .from('status_solicitacao')
      .insert(payload)
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        throw new Error('Já existe um status cadastrado com este código identificador.')
      }
      throw new Error(`Erro ao cadastrar status: ${error.message}`)
    }
    result = inserted

    await logAudit({
      acao: 'CREATE',
      tabela: 'status_solicitacao',
      registro_id: inserted.id,
      dados_novos: payload
    })
  }

  revalidatePath('/dashboard/status')
  revalidatePath('/dashboard/fila')
  return result
}

export async function toggleStatusActiveAction(id: string, currentActive: boolean) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Não autenticado')
  }

  // Verificar permissão
  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || (profile.role !== 'SMS_ADMIN' && profile.role !== 'COORDENADOR')) {
    throw new Error('Acesso negado.')
  }

  const nextActive = !currentActive

  const { error } = await supabase
    .from('status_solicitacao')
    .update({ 
      active: nextActive,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)

  if (error) {
    throw new Error(`Erro ao alterar situação: ${error.message}`)
  }

  await logAudit({
    acao: 'UPDATE',
    tabela: 'status_solicitacao',
    registro_id: id,
    dados_novos: { active: nextActive }
  })

  revalidatePath('/dashboard/status')
  revalidatePath('/dashboard/fila')
  return { success: true, active: nextActive }
}
