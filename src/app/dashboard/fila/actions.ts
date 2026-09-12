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

  // 4. Buscar prestadores ativos para o painel de encaminhamento
  const { data: prestadores } = await supabase
    .from('hospitais_prestadores')
    .select('id, cnes, nome, especialidades')
    .eq('active', true)
    .order('nome')

  // 5. Buscar hospital já vinculado à solicitação (se houver)
  const { data: solicitacao } = await supabase
    .from('fila_solicitacoes')
    .select(`
      hospital_encaminhado_id,
      data_encaminhamento,
      data_internacao,
      paciente_id,
      hospitais_prestadores (id, cnes, nome)
    `)
    .eq('cod_solicitacao', codSolicitacao)
    .single()

  // 6. Buscar telefones do paciente vinculado
  let telefones: any[] = []
  if (solicitacao?.paciente_id) {
    const { data: tels } = await supabase
      .from('pacientes_telefones')
      .select('id, numero, tipo, status, prioridade, nome_contato, parentesco, observacoes')
      .eq('paciente_id', solicitacao.paciente_id)
      .order('prioridade', { ascending: true })
    telefones = tels || []
  }

  return {
    snapshots: snapshots || [],
    contatos: contatos || [],
    templates: templates || [],
    prestadores: prestadores || [],
    hospitalEncaminhado: solicitacao?.hospitais_prestadores || null,
    dataEncaminhamento: solicitacao?.data_encaminhamento || null,
    dataInternacao: solicitacao?.data_internacao || null,
    telefones,
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

/**
 * Busca os telefones de um paciente para uso no drawer da fila.
 */
export async function getPatientPhones(pacienteId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('pacientes_telefones')
    .select('id, numero, tipo, status, prioridade, nome_contato, parentesco, observacoes')
    .eq('paciente_id', pacienteId)
    .order('prioridade', { ascending: true })

  if (error) {
    console.error('Erro ao buscar telefones do paciente:', error.message)
    return []
  }

  return data || []
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
export async function encaminharParaPrestador(
  codSolicitacao: number,
  prestadorId: string,
  dataInternacao?: string
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')

  // Obter dados anteriores para auditoria
  const { data: previous } = await supabase
    .from('fila_solicitacoes')
    .select('status_interno, hospital_encaminhado_id, data_encaminhamento')
    .eq('cod_solicitacao', codSolicitacao)
    .single()

  // Determinar novo status com base na presença da data de internação
  const novoStatus = dataInternacao && dataInternacao.trim().length > 0 ? 'INTERNADO' : 'ENCAMINHADO'

  const updatePayload: Record<string, unknown> = {
    hospital_encaminhado_id: prestadorId,
    data_encaminhamento: new Date().toISOString().split('T')[0],
    status_interno: novoStatus,
    updated_at: new Date().toISOString(),
  }

  if (dataInternacao && dataInternacao.trim().length > 0) {
    updatePayload.data_internacao = dataInternacao
  } else {
    updatePayload.data_internacao = null
  }

  const { error } = await supabase
    .from('fila_solicitacoes')
    .update(updatePayload)
    .eq('cod_solicitacao', codSolicitacao)

  if (error) throw new Error(`Erro ao encaminhar paciente: ${error.message}`)

  // Auditoria
  await logAudit({
    acao: 'ENCAMINHAR_PRESTADOR',
    tabela: 'fila_solicitacoes',
    registro_id: codSolicitacao.toString(),
    dados_anteriores: previous,
    dados_novos: updatePayload,
  })

  revalidatePath('/dashboard/fila')
}

export interface AgendaCompativel {
  id: string
  medico_nome: string
  especialidade: string
  data_agenda: string
  horario_inicio: string
  quantidade_vagas: number
  vagas_ocupadas: number
  vagas_restantes: number
  tipo_agenda: string
  observacoes_bloqueio?: string | null
  hospital?: {
    id: string
    cnes: string
    nome: string
  } | null
}

/**
 * Busca agendas futuras, ativas e com vagas abertas compatíveis com o paciente.
 */
export async function fetchAgendasCompativeisAction(params: {
  codSolicitacao: number
  especialidade?: string
  codSigtap?: string
}) {
  const supabase = await createClient()
  const today = new Date().toISOString().split('T')[0]

  let query = supabase
    .from('agendas_prestadores')
    .select(`
      id,
      medico_nome,
      especialidade,
      data_agenda,
      horario_inicio,
      quantidade_vagas,
      tipo_agenda,
      observacoes_bloqueio,
      hospitais_prestadores (id, cnes, nome),
      agendamentos_procedimentos (id, status_agendamento)
    `)
    .eq('active', true)
    .gte('data_agenda', today)
    .order('data_agenda', { ascending: true })
    .order('horario_inicio', { ascending: true })

  // Se veio especialidade, filtra de forma flexível (ex: "CIRURGIA GERAL" casa com "CIRURGIA")
  if (params.especialidade && params.especialidade.trim().length > 0) {
    const termo = params.especialidade.trim().split(' ')[0] // Pega o primeiro termo significativo (ex: CIRURGIA)
    query = query.ilike('especialidade', `%${termo}%`)
  }

  const { data, error } = await query

  if (error) {
    console.error('Erro ao buscar agendas compatíveis:', error.message)
    return { success: false, error: error.message, agendas: [] }
  }

  const agendas: AgendaCompativel[] = (data || []).map((ag: any) => {
    const agendamentos = ag.agendamentos_procedimentos || []
    const totalAgendados = agendamentos.filter(
      (a: any) => a.status_agendamento !== 'DESISTENCIA_PACIENTE' && a.status_agendamento !== 'INAPTO_RISCO_CIRURGICO'
    ).length
    const vagasLivres = Math.max(0, ag.quantidade_vagas - totalAgendados)

    return {
      id: ag.id,
      medico_nome: ag.medico_nome,
      especialidade: ag.especialidade,
      data_agenda: ag.data_agenda,
      horario_inicio: ag.horario_inicio,
      quantidade_vagas: ag.quantidade_vagas,
      vagas_ocupadas: totalAgendados,
      vagas_restantes: vagasLivres,
      tipo_agenda: ag.tipo_agenda,
      observacoes_bloqueio: ag.observacoes_bloqueio,
      hospital: ag.hospitais_prestadores,
    }
  })

  // Ordena prioritariamente as que têm vagas livres
  agendas.sort((a, b) => b.vagas_restantes - a.vagas_restantes)

  return { success: true, agendas }
}

/**
 * Vincula o paciente diretamente na vaga da agenda do prestador.
 */
export async function agendarPacienteEmVagaAction(params: {
  agendaId: string
  codSolicitacao: number
  pacienteId: string
  observacoes?: string
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')

  // Verificar se a agenda tem vagas disponíveis
  const { data: agenda, error: agendaErr } = await supabase
    .from('agendas_prestadores')
    .select(`
      id,
      medico_nome,
      especialidade,
      data_agenda,
      quantidade_vagas,
      hospital_id,
      agendamentos_procedimentos (id, status_agendamento)
    `)
    .eq('id', params.agendaId)
    .single()

  if (agendaErr || !agenda) {
    throw new Error('Agenda não encontrada ou inativa.')
  }

  const agendamentos = agenda.agendamentos_procedimentos || []
  const ocupadas = agendamentos.filter(
    (a: any) => a.status_agendamento !== 'DESISTENCIA_PACIENTE' && a.status_agendamento !== 'INAPTO_RISCO_CIRURGICO'
  ).length

  if (ocupadas >= agenda.quantidade_vagas) {
    throw new Error('As vagas desta agenda já foram preenchidas. Por favor, escolha outra data.')
  }

  // Obter dados anteriores da solicitação
  const { data: solAnterior } = await supabase
    .from('fila_solicitacoes')
    .select('status_interno, hospital_encaminhado_id')
    .eq('cod_solicitacao', params.codSolicitacao)
    .single()

  // Inserir agendamento
  const { data: novoAgendamento, error: agendamentoErr } = await supabase
    .from('agendamentos_procedimentos')
    .upsert({
      agenda_id: params.agendaId,
      cod_solicitacao: params.codSolicitacao,
      paciente_id: params.pacienteId,
      status_agendamento: 'AGENDADO_PRE_OP',
      observacoes_clinicas: params.observacoes || null,
      agendado_por: user.id,
      updated_at: new Date().toISOString()
    }, { onConflict: 'agenda_id, cod_solicitacao' })
    .select()
    .single()

  if (agendamentoErr) {
    throw new Error(`Falha ao vincular paciente na agenda: ${agendamentoErr.message}`)
  }

  // Atualizar a solicitação para CONVOCADO_CONFIRMADO
  const updatePayload = {
    status_interno: 'CONVOCADO_CONFIRMADO',
    hospital_encaminhado_id: agenda.hospital_id || null,
    updated_at: new Date().toISOString()
  }

  await supabase
    .from('fila_solicitacoes')
    .update(updatePayload)
    .eq('cod_solicitacao', params.codSolicitacao)

  // Auditoria
  await logAudit({
    acao: 'AGENDAR_VAGA_PRESTADOR',
    tabela: 'agendamentos_procedimentos',
    registro_id: params.codSolicitacao.toString(),
    dados_anteriores: solAnterior,
    dados_novos: {
      agenda_id: params.agendaId,
      data_agenda: agenda.data_agenda,
      medico_nome: agenda.medico_nome,
      especialidade: agenda.especialidade,
      novo_status: 'CONVOCADO_CONFIRMADO'
    }
  })

  revalidatePath('/dashboard/fila')
  revalidatePath('/dashboard/agendas')

  return { success: true, agendamento: novoAgendamento, agenda }
}

/**
 * Marca o paciente como APTO_AGUARDANDO_VAGA (Banco de Aptos / Pré-selecionados)
 */
export async function marcarComoAptoAguardandoVagaAction(params: {
  codSolicitacao: number
  observacoes?: string
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')

  const { data: previous } = await supabase
    .from('fila_solicitacoes')
    .select('status_interno')
    .eq('cod_solicitacao', params.codSolicitacao)
    .single()

  const updatePayload: Record<string, unknown> = {
    status_interno: 'APTO_AGUARDANDO_VAGA',
    updated_at: new Date().toISOString()
  }

  const { error } = await supabase
    .from('fila_solicitacoes')
    .update(updatePayload)
    .eq('cod_solicitacao', params.codSolicitacao)

  if (error) {
    throw new Error(`Erro ao colocar paciente no banco de aptos: ${error.message}`)
  }

  if (params.observacoes && params.observacoes.trim().length > 0) {
    await supabase.from('historico_movimentacoes_fila').insert({
      cod_solicitacao: params.codSolicitacao,
      tipo_movimentacao: 'QUALIFICACAO_CONTATO',
      posicao_anterior: null,
      posicao_nova: null,
      justificativa: `Paciente apto / aguardando vaga: ${params.observacoes.trim()}`,
      created_by: user.id,
      active: true
    })
  }

  await logAudit({
    acao: 'MARCAR_APTO_AGUARDANDO_VAGA',
    tabela: 'fila_solicitacoes',
    registro_id: params.codSolicitacao.toString(),
    dados_anteriores: previous,
    dados_novos: updatePayload
  })

  revalidatePath('/dashboard/fila')
  revalidatePath('/dashboard/agendas')

  return { success: true }
}

