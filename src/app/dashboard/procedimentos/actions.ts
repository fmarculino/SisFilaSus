'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'

export async function saveProcedimento(
  originalCodSigtap: string | undefined,
  data: {
    cod_sigtap: string
    desc_sigtap: string
    modalidade_fila: number
    grupo_descricao?: string | null
  }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) throw new Error('Não autenticado')

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  const allowed = ['SMS_ADMIN', 'COORDENADOR', 'OPERADOR_REGULACAO']
  if (!profile || !allowed.includes(profile.role)) {
    throw new Error('Acesso negado')
  }

  const cleanCod = data.cod_sigtap.trim().replace(/\D/g, '') || data.cod_sigtap.trim()

  const payload = {
    cod_sigtap: cleanCod,
    desc_sigtap: data.desc_sigtap.trim().toUpperCase(),
    modalidade_fila: Number(data.modalidade_fila) ?? 0,
    grupo_descricao: data.grupo_descricao ? data.grupo_descricao.trim().toUpperCase() : null
  }

  if (originalCodSigtap) {
    const { error } = await supabase
      .from('procedimentos')
      .update(payload)
      .eq('cod_sigtap', originalCodSigtap)

    if (error) throw new Error(`Erro ao atualizar procedimento: ${error.message}`)
  } else {
    const { error } = await supabase
      .from('procedimentos')
      .insert(payload)

    if (error) throw new Error(`Erro ao cadastrar procedimento: ${error.message}`)
  }

  revalidatePath('/dashboard/procedimentos')
  revalidatePath('/dashboard/fila')
}

export async function deleteProcedimento(cod_sigtap: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) throw new Error('Não autenticado')

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  const allowed = ['SMS_ADMIN', 'COORDENADOR']
  if (!profile || !allowed.includes(profile.role)) {
    throw new Error('Apenas Administradores e Coordenadores podem remover procedimentos.')
  }

  const { error } = await supabase
    .from('procedimentos')
    .delete()
    .eq('cod_sigtap', cod_sigtap)

  if (error) {
    throw new Error(`Não foi possível excluir: o procedimento pode estar vinculado a solicitações na fila. (${error.message})`)
  }

  revalidatePath('/dashboard/procedimentos')
  revalidatePath('/dashboard/fila')
}
