'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function savePacienteAction(
  id: string | undefined,
  formData: {
    cns_usuario: string
    cpf_usuario: string | null
    nome_usuario: string
    data_nascimento: string | null
    sexo: string | null
    nome_mae: string | null
    telefone_1: string | null
    telefone_2: string | null
    endereco: string | null
    municipio_origem: string | null
    observacoes: string | null
  }
) {
  const supabase = await createClient()

  const cns = formData.cns_usuario.replace(/\D/g, '')
  const cpf = formData.cpf_usuario ? formData.cpf_usuario.replace(/\D/g, '') : null

  if (cns.length !== 15) {
    return { success: false, error: 'O CNS deve possuir exatamente 15 dígitos.' }
  }

  if (cpf && cpf.length !== 11) {
    return { success: false, error: 'O CPF deve possuir exatamente 11 dígitos.' }
  }

  // 1. Validar duplicidade se for novo paciente ou se alterou CNS/CPF
  let checkQuery = supabase
    .from('pacientes')
    .select('id, nome_usuario')

  if (id) {
    checkQuery = checkQuery.neq('id', id)
  }

  const { data: existing, error: checkError } = await checkQuery.or(
    `cns_usuario.eq.${cns}${cpf ? `,cpf_usuario.eq.${cpf}` : ''}`
  )

  if (checkError) {
    console.error('Erro ao verificar duplicidade de paciente:', checkError.message)
    return { success: false, error: 'Erro de validação no banco de dados.' }
  }

  if (existing && existing.length > 0) {
    return { 
      success: false, 
      error: `Paciente já cadastrado com este CNS ou CPF (Cadastro existente: ${existing[0].nome_usuario}).` 
    }
  }

  const payload = {
    cns_usuario: cns,
    cpf_usuario: cpf,
    nome_usuario: formData.nome_usuario.trim().toUpperCase(),
    data_nascimento: formData.data_nascimento || null,
    sexo: formData.sexo || null,
    nome_mae: formData.nome_mae ? formData.nome_mae.trim().toUpperCase() : null,
    telefone_1: formData.telefone_1 ? formData.telefone_1.trim() : null,
    telefone_2: formData.telefone_2 ? formData.telefone_2.trim() : null,
    endereco: formData.endereco ? formData.endereco.trim() : null,
    municipio_origem: formData.municipio_origem ? formData.municipio_origem.trim().toUpperCase() : null,
    observacoes: formData.observacoes ? formData.observacoes.trim() : null
  }

  if (id) {
    const { error: updateError } = await supabase
      .from('pacientes')
      .update(payload)
      .eq('id', id)

    if (updateError) {
      console.error('Erro ao atualizar paciente:', updateError.message)
      return { success: false, error: updateError.message }
    }

    revalidatePath('/dashboard/pacientes')
    revalidatePath('/dashboard/fila')
    return { success: true, pacienteId: id }
  } else {
    const { data: inserted, error: insertError } = await supabase
      .from('pacientes')
      .insert(payload)
      .select('id')
      .single()

    if (insertError) {
      console.error('Erro ao cadastrar paciente:', insertError.message)
      return { success: false, error: insertError.message }
    }

    revalidatePath('/dashboard/pacientes')
    revalidatePath('/dashboard/fila')
    return { success: true, pacienteId: inserted?.id }
  }
}

export async function deletePacienteAction(id: string) {
  const supabase = await createClient()

  // Deletar da base
  const { error } = await supabase
    .from('pacientes')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Erro ao excluir paciente:', error.message)
    return { success: false, error: error.message }
  }

  revalidatePath('/dashboard/pacientes')
  revalidatePath('/dashboard/fila')
  return { success: true }
}
