'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'

export async function saveMunicipio(
  originalIbge: string | undefined,
  data: {
    codigo_ibge: string
    nome: string
    central_reguladora_nome?: string | null
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

  const cleanIbge = data.codigo_ibge.trim().replace(/\D/g, '') || data.codigo_ibge.trim()

  const payload = {
    codigo_ibge: cleanIbge,
    nome: data.nome.trim().toUpperCase(),
    central_reguladora_nome: data.central_reguladora_nome ? data.central_reguladora_nome.trim().toUpperCase() : null
  }

  if (originalIbge) {
    const { error } = await supabase
      .from('municipios')
      .update(payload)
      .eq('codigo_ibge', originalIbge)

    if (error) throw new Error(`Erro ao atualizar município: ${error.message}`)
  } else {
    const { error } = await supabase
      .from('municipios')
      .insert(payload)

    if (error) throw new Error(`Erro ao cadastrar município: ${error.message}`)
  }

  revalidatePath('/dashboard/municipios')
  revalidatePath('/dashboard/fila')
  revalidatePath('/dashboard/pacientes')
  revalidatePath('/dashboard/unidades')
}

export async function deleteMunicipio(codigo_ibge: string) {
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
    throw new Error('Apenas Administradores e Coordenadores podem remover municípios.')
  }

  const { error } = await supabase
    .from('municipios')
    .delete()
    .eq('codigo_ibge', codigo_ibge)

  if (error) {
    throw new Error(`Não foi possível excluir: o município pode ter unidades ou pacientes vinculados. (${error.message})`)
  }

  revalidatePath('/dashboard/municipios')
  revalidatePath('/dashboard/fila')
  revalidatePath('/dashboard/pacientes')
}
