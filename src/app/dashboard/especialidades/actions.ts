'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'

export async function saveEspecialidade(
  id: string | undefined,
  nome: string,
  descricao: string,
  active: boolean
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

  const allowed = ['SMS_ADMIN', 'COORDENADOR', 'OPERADOR_REGULACAO']
  if (!profile || !allowed.includes(profile.role)) {
    throw new Error('Acesso negado')
  }

  const payload = {
    nome: nome.trim().toUpperCase(),
    descricao: descricao.trim() || null,
    active
  }

  if (id) {
    const { error } = await supabase
      .from('especialidades')
      .update(payload)
      .eq('id', id)

    if (error) {
      throw new Error(`Erro ao atualizar especialidade: ${error.message}`)
    }
  } else {
    const { error } = await supabase
      .from('especialidades')
      .insert(payload)

    if (error) {
      throw new Error(`Erro ao cadastrar especialidade: ${error.message}`)
    }
  }

  revalidatePath('/dashboard/especialidades')
  revalidatePath('/dashboard/medicos')
  revalidatePath('/dashboard/agendas')
  revalidatePath('/dashboard/fila')
}

export async function toggleEspecialidadeStatus(id: string, active: boolean) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) throw new Error('Não autenticado')

  const { error } = await supabase
    .from('especialidades')
    .update({ active })
    .eq('id', id)

  if (error) throw new Error(`Erro ao alterar status: ${error.message}`)

  revalidatePath('/dashboard/especialidades')
}
