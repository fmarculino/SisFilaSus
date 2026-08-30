'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'

export async function saveUnidade(
  originalCnes: string | undefined,
  data: {
    cnes: string
    nome: string
    municipio_ibge?: string | null
    tipo?: string | null
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

  const cleanCnes = data.cnes.trim().replace(/\D/g, '') || data.cnes.trim()

  const payload = {
    cnes: cleanCnes,
    nome: data.nome.trim().toUpperCase(),
    municipio_ibge: data.municipio_ibge ? data.municipio_ibge.trim() : null,
    tipo: data.tipo ? data.tipo.trim().toUpperCase() : 'UBS'
  }

  if (originalCnes) {
    const { error } = await supabase
      .from('unidades_solicitantes')
      .update(payload)
      .eq('cnes', originalCnes)

    if (error) throw new Error(`Erro ao atualizar unidade: ${error.message}`)
  } else {
    const { error } = await supabase
      .from('unidades_solicitantes')
      .insert(payload)

    if (error) throw new Error(`Erro ao cadastrar unidade: ${error.message}`)
  }

  revalidatePath('/dashboard/unidades')
  revalidatePath('/dashboard/fila')
  revalidatePath('/dashboard/usuarios')
}

export async function deleteUnidade(cnes: string) {
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
    throw new Error('Apenas Administradores e Coordenadores podem remover unidades.')
  }

  const { error } = await supabase
    .from('unidades_solicitantes')
    .delete()
    .eq('cnes', cnes)

  if (error) {
    throw new Error(`Não foi possível excluir: a unidade pode estar associada a pacientes, solicitações ou usuários. (${error.message})`)
  }

  revalidatePath('/dashboard/unidades')
  revalidatePath('/dashboard/fila')
  revalidatePath('/dashboard/usuarios')
}
