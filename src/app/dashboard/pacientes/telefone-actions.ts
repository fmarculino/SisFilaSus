'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export interface TelefoneInput {
  id?: string
  numero: string
  tipo: 'CELULAR_WHATSAPP' | 'CELULAR' | 'FIXO' | 'RECADO'
  status: 'ATIVO' | 'INATIVO' | 'TROCOU_DONO' | 'PERDIDO' | 'DESLIGADO' | 'NAO_EXISTE' | 'NAO_ATENDE'
  prioridade: number
  nome_contato?: string
  parentesco?: string
  observacoes?: string
}

/**
 * Busca todos os telefones de um paciente, ordenados por prioridade.
 */
export async function getPacienteTelefonesAction(pacienteId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('pacientes_telefones')
    .select('*')
    .eq('paciente_id', pacienteId)
    .order('prioridade', { ascending: true })

  if (error) {
    console.error('Erro ao buscar telefones do paciente:', error.message)
    return { success: false, error: error.message, data: [] }
  }

  return { success: true, data: data || [] }
}

/**
 * Sincroniza a lista completa de telefones de um paciente.
 * - Telefones com `id` existente: atualiza
 * - Telefones sem `id`: cria novos
 * - Telefones que existiam no banco mas não estão no array: remove
 */
export async function syncPacienteTelefonesAction(
  pacienteId: string,
  telefones: TelefoneInput[]
) {
  const supabase = await createClient()

  // 1. Buscar telefones atuais do paciente
  const { data: existentes, error: fetchError } = await supabase
    .from('pacientes_telefones')
    .select('id')
    .eq('paciente_id', pacienteId)

  if (fetchError) {
    console.error('Erro ao buscar telefones existentes:', fetchError.message)
    return { success: false, error: fetchError.message }
  }

  const existingIds = new Set((existentes || []).map(t => t.id))
  const incomingIds = new Set(telefones.filter(t => t.id).map(t => t.id!))

  // 2. Deletar telefones removidos pelo usuário
  const toDelete = [...existingIds].filter(id => !incomingIds.has(id))
  if (toDelete.length > 0) {
    const { error: deleteError } = await supabase
      .from('pacientes_telefones')
      .delete()
      .in('id', toDelete)

    if (deleteError) {
      console.error('Erro ao deletar telefones removidos:', deleteError.message)
      return { success: false, error: deleteError.message }
    }
  }

  // 3. Inserir novos e atualizar existentes
  for (const tel of telefones) {
    const cleanNumero = tel.numero.replace(/\D/g, '')
    if (!cleanNumero) continue // pular telefones sem número

    const payload = {
      paciente_id: pacienteId,
      numero: cleanNumero,
      tipo: tel.tipo,
      status: tel.status,
      prioridade: tel.prioridade,
      nome_contato: tel.nome_contato?.trim() || null,
      parentesco: tel.parentesco?.trim() || null,
      observacoes: tel.observacoes?.trim() || null,
    }

    if (tel.id && existingIds.has(tel.id)) {
      // Update
      const { error: updateError } = await supabase
        .from('pacientes_telefones')
        .update(payload)
        .eq('id', tel.id)

      if (updateError) {
        console.error(`Erro ao atualizar telefone ${tel.id}:`, updateError.message)
        return { success: false, error: updateError.message }
      }
    } else {
      // Insert
      const { error: insertError } = await supabase
        .from('pacientes_telefones')
        .insert(payload)

      if (insertError) {
        console.error('Erro ao inserir novo telefone:', insertError.message)
        return { success: false, error: insertError.message }
      }
    }
  }

  // 4. Também sincronizar os campos legados telefone_1 e telefone_2 para retrocompatibilidade
  const telefonesAtivos = telefones
    .filter(t => t.status === 'ATIVO' && t.numero.replace(/\D/g, ''))
    .sort((a, b) => a.prioridade - b.prioridade)

  const tel1 = telefonesAtivos[0]?.numero.replace(/\D/g, '') || null
  const tel2 = telefonesAtivos[1]?.numero.replace(/\D/g, '') || null

  const { error: syncError } = await supabase
    .from('pacientes')
    .update({ telefone_1: tel1, telefone_2: tel2 })
    .eq('id', pacienteId)

  if (syncError) {
    console.error('Erro ao sincronizar campos legados de telefone:', syncError.message)
    // Não falha a operação inteira, apenas loga
  }

  revalidatePath('/dashboard/pacientes')
  revalidatePath('/dashboard/fila')
  revalidatePath('/dashboard/convocacao')

  return { success: true }
}

/**
 * Marca um telefone específico com um novo status (ex: após contato sem sucesso).
 */
export async function updateTelefoneStatusAction(
  telefoneId: string,
  newStatus: TelefoneInput['status']
) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('pacientes_telefones')
    .update({ status: newStatus })
    .eq('id', telefoneId)

  if (error) {
    console.error('Erro ao atualizar status do telefone:', error.message)
    return { success: false, error: error.message }
  }

  revalidatePath('/dashboard/pacientes')
  revalidatePath('/dashboard/fila')
  revalidatePath('/dashboard/convocacao')

  return { success: true }
}
