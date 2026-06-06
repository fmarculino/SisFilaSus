'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { logAudit } from '@/lib/audit'

export async function approveMovement(id: string, observacoesDecisao: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Não autenticado')
  }

  const { data: previous } = await supabase
    .from('movimentacoes_fila')
    .select('*')
    .eq('id', id)
    .single()

  if (!previous) {
    throw new Error('Movimentação não encontrada')
  }

  if (previous.status !== 'PENDENTE') {
    throw new Error('Esta movimentação já foi analisada')
  }

  const { error } = await supabase
    .from('movimentacoes_fila')
    .update({
      status: 'APROVADO',
      aprovada_por: user.id,
      observacoes_decisao: observacoesDecisao.trim(),
      updated_at: new Date().toISOString()
    })
    .eq('id', id)

  if (error) {
    throw new Error(`Erro ao aprovar movimentação: ${error.message}`)
  }

  revalidatePath('/dashboard/movimentacoes')
  revalidatePath('/dashboard/fila')
  revalidatePath('/dashboard')
}

export async function rejectMovement(id: string, observacoesDecisao: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Não autenticado')
  }

  const { data: previous } = await supabase
    .from('movimentacoes_fila')
    .select('*')
    .eq('id', id)
    .single()

  if (!previous) {
    throw new Error('Movimentação não encontrada')
  }

  if (previous.status !== 'PENDENTE') {
    throw new Error('Esta movimentação já foi analisada')
  }

  const { error } = await supabase
    .from('movimentacoes_fila')
    .update({
      status: 'REJEITADO',
      aprovada_por: user.id,
      observacoes_decisao: observacoesDecisao.trim(),
      updated_at: new Date().toISOString()
    })
    .eq('id', id)

  if (error) {
    throw new Error(`Erro ao rejeitar movimentação: ${error.message}`)
  }

  revalidatePath('/dashboard/movimentacoes')
  revalidatePath('/dashboard/fila')
}
