'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'

export async function saveMedico(
  id: string | undefined,
  data: {
    nome: string
    crm: string
    uf_crm: string
    especialidade_id?: string | null
    especialidade_nome?: string | null
    hospital_id?: string | null
    telefone?: string | null
    email?: string | null
    active: boolean
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

  const payload = {
    nome: data.nome.trim().toUpperCase(),
    crm: data.crm.trim().replace(/\D/g, '') || data.crm.trim(),
    uf_crm: (data.uf_crm || 'PA').trim().toUpperCase(),
    especialidade_id: data.especialidade_id || null,
    especialidade_nome: data.especialidade_nome ? data.especialidade_nome.trim().toUpperCase() : null,
    hospital_id: data.hospital_id || null,
    telefone: data.telefone ? data.telefone.trim() : null,
    email: data.email ? data.email.trim().toLowerCase() : null,
    active: data.active
  }

  if (id) {
    const { error } = await supabase
      .from('medicos')
      .update(payload)
      .eq('id', id)

    if (error) throw new Error(`Erro ao atualizar médico: ${error.message}`)
  } else {
    const { error } = await supabase
      .from('medicos')
      .insert(payload)

    if (error) throw new Error(`Erro ao cadastrar médico: ${error.message}`)
  }

  revalidatePath('/dashboard/medicos')
  revalidatePath('/dashboard/agendas')
}

export async function toggleMedicoStatus(id: string, active: boolean) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) throw new Error('Não autenticado')

  const { error } = await supabase
    .from('medicos')
    .update({ active })
    .eq('id', id)

  if (error) throw new Error(`Erro ao alterar status do médico: ${error.message}`)

  revalidatePath('/dashboard/medicos')
}
