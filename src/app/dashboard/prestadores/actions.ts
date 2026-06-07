'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'

export async function savePrestador(
  id: string | undefined,
  cnes: string,
  nome: string,
  active: boolean,
  especialidades: string[]
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Não autenticado')
  }

  // Verificar perfil
  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || (profile.role !== 'SMS_ADMIN' && profile.role !== 'COORDENADOR')) {
    throw new Error('Acesso negado')
  }

  const payload = {
    cnes: cnes.trim(),
    nome: nome.trim().toUpperCase(),
    active,
    especialidades
  }

  if (id) {
    const { error } = await supabase
      .from('hospitais_prestadores')
      .update(payload)
      .eq('id', id)

    if (error) {
      throw new Error(`Erro ao atualizar prestador: ${error.message}`)
    }
  } else {
    const { error } = await supabase
      .from('hospitais_prestadores')
      .insert(payload)

    if (error) {
      throw new Error(`Erro ao salvar prestador: ${error.message}`)
    }
  }

  revalidatePath('/dashboard/prestadores')
  revalidatePath('/dashboard')
}
