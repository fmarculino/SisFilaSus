'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { logAudit } from '@/lib/audit'

export async function fetchSolicitacaoExtraData(codSolicitacao: number) {
  const supabase = await createClient()

  // 1. Obter snapshots ordenados por data decrescente
  const { data: snapshots, error: snapError } = await supabase
    .from('fila_snapshots')
    .select(`
      id,
      posicao_fila,
      classificacao_risco,
      created_at,
      importacoes (nome_arquivo)
    `)
    .eq('cod_solicitacao', codSolicitacao)
    .order('created_at', { ascending: false })

  if (snapError) console.error('Error fetching snapshots:', snapError)

  // 2. Obter contatos ordenados por data decrescente
  const { data: contatos, error: contError } = await supabase
    .from('contatos')
    .select(`
      id,
      tipo,
      resultado,
      telefone_usado,
      observacoes,
      created_at,
      users (nome)
    `)
    .eq('cod_solicitacao', codSolicitacao)
    .order('created_at', { ascending: false })

  if (contError) console.error('Error fetching contacts:', contError)

  // 3. Obter templates de mensagem para a convocação
  const { data: templates } = await supabase
    .from('templates_mensagem')
    .select('id, titulo, corpo')
    .eq('active', true)

  return {
    snapshots: snapshots || [],
    contatos: contatos || [],
    templates: templates || []
  }
}

export async function updatePatientPhone(
  pacienteId: string,
  telefone_1: string,
  telefone_2: string
) {
  const supabase = await createClient()

  const { data: previous } = await supabase
    .from('pacientes')
    .select('telefone_1, telefone_2')
    .eq('id', pacienteId)
    .single()

  const { error } = await supabase
    .from('pacientes')
    .update({
      telefone_1: telefone_1.trim(),
      telefone_2: telefone_2.trim(),
      updated_at: new Date().toISOString()
    })
    .eq('id', pacienteId)

  if (error) {
    throw new Error(`Erro ao atualizar telefones: ${error.message}`)
  }

  // Auditoria
  await logAudit({
    acao: 'UPDATE',
    tabela: 'pacientes',
    registro_id: pacienteId,
    dados_anteriores: previous,
    dados_novos: { telefone_1, telefone_2 }
  })

  revalidatePath('/dashboard/fila')
}

export async function createContactLog(
  codSolicitacao: number,
  tipo: 'WHATSAPP' | 'LIGACAO' | 'VISITA' | 'SMS',
  resultado: string,
  telefoneUsado: string,
  observacoes: string
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Não autenticado')
  }

  const { error } = await supabase
    .from('contatos')
    .insert({
      cod_solicitacao: codSolicitacao,
      operador_id: user.id,
      tipo,
      resultado,
      telefone_usado: telefoneUsado.trim(),
      observacoes: observacoes.trim()
    })

  if (error) {
    throw new Error(`Erro ao salvar contato: ${error.message}`)
  }

  // Atualizar o status interno da solicitação automaticamente se houver sucesso
  let novoStatus: string | null = null
  if (resultado === 'SUCESSO_CONFIRMOU') {
    novoStatus = 'CONVOCADO_CONFIRMADO'
  } else if (resultado === 'SUCESSO_RECUSOU') {
    novoStatus = 'CONVOCADO_RECUSOU'
  } else if (resultado === 'SEM_RESPOSTA') {
    novoStatus = 'SEM_CONTATO'
  }

  if (novoStatus) {
    const { error: updateError } = await supabase
      .from('fila_solicitacoes')
      .update({ status_interno: novoStatus })
      .eq('cod_solicitacao', codSolicitacao)

    if (updateError) console.error('Erro ao atualizar status da solicitação:', updateError)
  }

  // Auditoria
  await logAudit({
    acao: 'CREATE',
    tabela: 'contatos',
    registro_id: codSolicitacao.toString(),
    dados_novos: { tipo, resultado, telefoneUsado }
  })

  revalidatePath('/dashboard/fila')
}

export async function proposeMovement(
  codSolicitacao: number,
  tipo: 'MUDANCA_RISCO' | 'MUDANCA_POSICAO' | 'AGRAVAMENTO_CLINICO' | 'DESISTENCIA' | 'OBITO' | 'TRANSFERENCIA',
  justificativa: string,
  valorNovo: { classificacao_risco?: number; posicao_fila?: number }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Não autenticado')
  }

  // Obter valor anterior do banco
  const { data: current, error: currentError } = await supabase
    .from('fila_solicitacoes')
    .select('classificacao_risco, posicao_fila')
    .eq('cod_solicitacao', codSolicitacao)
    .single()

  if (currentError || !current) {
    throw new Error('Solicitação não encontrada')
  }

  const valorAnterior = {
    classificacao_risco: current.classificacao_risco,
    posicao_fila: current.posicao_fila
  }

  const { error } = await supabase
    .from('movimentacoes_fila')
    .insert({
      cod_solicitacao: codSolicitacao,
      solicitada_por: user.id,
      tipo,
      justificativa: justificativa.trim(),
      status: 'PENDENTE',
      valor_anterior: valorAnterior,
      valor_novo: valorNovo
    })

  if (error) {
    throw new Error(`Erro ao propor movimentação: ${error.message}`)
  }

  revalidatePath('/dashboard/fila')
  revalidatePath('/dashboard/movimentacoes')
}

export async function updateSolicitacaoStatus(codSolicitacao: number, novoStatus: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')

  const { data: previous } = await supabase
    .from('fila_solicitacoes')
    .select('status_interno')
    .eq('cod_solicitacao', codSolicitacao)
    .single()

  const { error } = await supabase
    .from('fila_solicitacoes')
    .update({ 
      status_interno: novoStatus,
      updated_at: new Date().toISOString()
    })
    .eq('cod_solicitacao', codSolicitacao)

  if (error) throw new Error(`Erro ao atualizar status: ${error.message}`)

  // Auditoria
  await logAudit({
    acao: 'UPDATE_STATUS',
    tabela: 'fila_solicitacoes',
    registro_id: codSolicitacao.toString(),
    dados_anteriores: previous,
    dados_novos: { status_interno: novoStatus }
  })

  revalidatePath('/dashboard/fila')
}
