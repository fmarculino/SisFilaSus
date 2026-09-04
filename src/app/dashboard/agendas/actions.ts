'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { logAudit } from '@/lib/audit'

export interface CreateAgendaInput {
  hospital_id?: string | null
  medico_nome: string
  especialidade: string
  data_agenda: string // YYYY-MM-DD
  horario_inicio: string // HH:mm
  horario_fim?: string // HH:mm
  quantidade_vagas: number
  tipo_agenda: 'CONSULTA_PRE_OP' | 'CIRURGIA_ELETIVA' | 'PEQUENA_CIRURGIA' | 'EXAME_ESPECIALIZADO'
  observacoes_bloqueio?: string
}

export interface UpdateAgendamentoInput {
  compareceu_consulta?: boolean | null
  data_consulta_realizada?: string | null
  parecer_pre_op?: 'APTO_CIRURGIA' | 'INAPTO_TEMPORARIO' | 'INAPTO_DEFINITIVO' | 'ENCAMINHADO_OUTRO_SERVICO' | null
  data_cirurgia_agendada?: string | null
  cirurgia_realizada?: boolean | null
  data_cirurgia_execucao?: string | null
  data_internacao?: string | null
  data_alta?: string | null
  data_retorno_pos_op?: string | null
  status_agendamento?: string
  observacoes_clinicas?: string | null
  desfecho_execucao?: string | null
  intercorrencia_tipo?: string | null
  intercorrencia_descricao?: string | null
  realizado_por_medico?: string | null
}

/**
 * Cria uma nova oferta de agenda / cota de vagas para um médico/prestador.
 */
export async function createAgendaAction(input: CreateAgendaInput) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!input.medico_nome?.trim()) {
    return { success: false, error: 'O nome do médico é obrigatório.' }
  }
  if (!input.especialidade?.trim()) {
    return { success: false, error: 'A especialidade é obrigatória.' }
  }
  if (!input.data_agenda) {
    return { success: false, error: 'A data da agenda é obrigatória.' }
  }

  const { data, error } = await supabase
    .from('agendas_prestadores')
    .insert({
      hospital_id: input.hospital_id || null,
      medico_nome: input.medico_nome.trim().toUpperCase(),
      especialidade: input.especialidade.trim().toUpperCase(),
      data_agenda: input.data_agenda,
      horario_inicio: input.horario_inicio || '08:00',
      horario_fim: input.horario_fim || '12:00',
      quantidade_vagas: Number(input.quantidade_vagas) || 15,
      tipo_agenda: input.tipo_agenda || 'CONSULTA_PRE_OP',
      observacoes_bloqueio: input.observacoes_bloqueio?.trim() || null,
      created_by: user?.id || null,
    })
    .select()
    .single()

  if (error) {
    console.error('Erro ao criar agenda:', error.message)
    return { success: false, error: error.message }
  }

  revalidatePath('/dashboard/agendas')
  return { success: true, data }
}

/**
 * Exclui ou desativa uma agenda.
 */
export async function deleteAgendaAction(agendaId: string) {
  const supabase = await createClient()

  // Verificar se há agendamentos vinculados
  const { count } = await supabase
    .from('agendamentos_procedimentos')
    .select('*', { count: 'exact', head: true })
    .eq('agenda_id', agendaId)

  if (count && count > 0) {
    // Se tiver agendamentos, apenas desativa a agenda para preservar histórico
    const { error } = await supabase
      .from('agendas_prestadores')
      .update({ active: false })
      .eq('id', agendaId)

    if (error) return { success: false, error: error.message }
  } else {
    // Se não tiver agendamentos, exclui diretamente
    const { error } = await supabase
      .from('agendas_prestadores')
      .delete()
      .eq('id', agendaId)

    if (error) return { success: false, error: error.message }
  }

  revalidatePath('/dashboard/agendas')
  return { success: true }
}

/**
 * Busca a lista de agendas com contadores de vagas ocupadas.
 */
export async function fetchAgendasAction(filters?: {
  dataInicio?: string
  dataFim?: string
  hospitalId?: string
  especialidade?: string
  medico?: string
}) {
  const supabase = await createClient()

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
      active,
      hospitais_prestadores (id, cnes, nome),
      agendamentos_procedimentos (id, status_agendamento)
    `)
    .eq('active', true)
    .order('data_agenda', { ascending: true })
    .order('horario_inicio', { ascending: true })

  if (filters?.dataInicio) {
    query = query.gte('data_agenda', filters.dataInicio)
  }
  if (filters?.dataFim) {
    query = query.lte('data_agenda', filters.dataFim)
  }
  if (filters?.hospitalId) {
    query = query.eq('hospital_id', filters.hospitalId)
  }
  if (filters?.especialidade) {
    query = query.ilike('especialidade', `%${filters.especialidade}%`)
  }
  if (filters?.medico) {
    query = query.ilike('medico_nome', `%${filters.medico}%`)
  }

  const { data, error } = await query

  if (error) {
    console.error('Erro ao buscar agendas:', error.message)
    return { success: false, error: error.message, data: [] }
  }

  return { success: true, data: data || [] }
}

/**
 * Busca detalhes completos de uma agenda com seus pacientes agendados.
 */
export async function fetchAgendaDetalhadaAction(agendaId: string) {
  const supabase = await createClient()

  const { data: agenda, error: agendaError } = await supabase
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
      agendamentos_procedimentos (
        id,
        cod_solicitacao,
        paciente_id,
        compareceu_consulta,
        data_consulta_realizada,
        parecer_pre_op,
        data_cirurgia_agendada,
        cirurgia_realizada,
        data_cirurgia_execucao,
        data_internacao,
        data_alta,
        data_retorno_pos_op,
        status_agendamento,
        observacoes_clinicas,
        exportado_sisreg,
        created_at,
        pacientes (
          id,
          nome_usuario,
          cns_usuario,
          cpf_usuario,
          data_nascimento,
          sexo,
          telefone_1,
          telefone_2,
          municipio_origem,
          pacientes_telefones (id, numero, tipo, status, prioridade, nome_contato, parentesco)
        ),
        fila_solicitacoes (
          cod_solicitacao,
          classificacao_risco,
          posicao_fila,
          data_solicitacao,
          status_interno,
          procedimentos (cod_sigtap, desc_sigtap)
        )
      )
    `)
    .eq('id', agendaId)
    .single()

  if (agendaError) {
    console.error('Erro ao buscar agenda detalhada:', agendaError.message)
    return { success: false, error: agendaError.message, data: null }
  }

  return { success: true, data: agenda }
}

/**
 * Busca pacientes prioritários na fila compatíveis com a especialidade da agenda.
 */
export async function searchPacientesParaAgendaAction(params: {
  especialidade?: string
  search?: string
  limit?: number
}) {
  const supabase = await createClient()

  let query = supabase
    .from('fila_solicitacoes')
    .select(`
      cod_solicitacao,
      paciente_id,
      classificacao_risco,
      posicao_fila,
      data_solicitacao,
      status_interno,
      pacientes!inner (
        id,
        nome_usuario,
        cns_usuario,
        cpf_usuario,
        data_nascimento,
        sexo,
        telefone_1,
        telefone_2,
        municipio_origem,
        pacientes_telefones (id, numero, tipo, status, prioridade, nome_contato, parentesco)
      ),
      procedimentos!inner (
        cod_sigtap,
        desc_sigtap,
        grupo_descricao
      )
    `)
    .eq('active', true)
    .in('status_interno', ['NA_FILA', 'EM_CONVOCACAO', 'SEM_CONTATO'])
    .order('classificacao_risco', { ascending: true }) // 0 e 1 primeiro
    .order('posicao_fila', { ascending: true, nullsFirst: false })
    .limit(params.limit || 30)

  if (params.search) {
    const s = params.search.trim()
    const cleanDigits = s.replace(/\D/g, '')
    if (cleanDigits.length === 15) {
      query = query.eq('pacientes.cns_usuario', cleanDigits)
    } else if (cleanDigits.length === 11) {
      query = query.eq('pacientes.cpf_usuario', cleanDigits)
    } else {
      query = query.ilike('pacientes.nome_usuario', `%${s}%`)
    }
  }

  if (params.especialidade) {
    const esp = params.especialidade.toUpperCase()
    if (esp.includes('UROLOG')) {
      query = query.ilike('procedimentos.desc_sigtap', '%PROSTAT%')
    } else if (esp.includes('PEQUENA')) {
      query = query.or('desc_sigtap.ilike.%CISTO%,desc_sigtap.ilike.%LIPOMA%,desc_sigtap.ilike.%LESÃO%,desc_sigtap.ilike.%NEVOS%')
    } else if (esp.includes('CIRURGIA GERAL')) {
      query = query.or('desc_sigtap.ilike.%COLECIST%,desc_sigtap.ilike.%HERNIA%,desc_sigtap.ilike.%HERNIO%,desc_sigtap.ilike.%HEMORROID%')
    }
  }

  const { data, error } = await query

  if (error) {
    console.error('Erro ao buscar pacientes para agenda:', error.message)
    return { success: false, error: error.message, data: [] }
  }

  return { success: true, data: data || [] }
}

/**
 * Aloca um paciente da fila em uma agenda de prestador.
 */
export async function allocatePacienteToAgendaAction(
  agendaId: string,
  codSolicitacao: number,
  pacienteId: string
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // 1. Inserir agendamento
  const { data, error } = await supabase
    .from('agendamentos_procedimentos')
    .insert({
      agenda_id: agendaId,
      cod_solicitacao: codSolicitacao,
      paciente_id: pacienteId,
      status_agendamento: 'AGENDADO_PRE_OP',
      agendado_por: user?.id || null,
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return { success: false, error: 'Este paciente já está alocado nesta agenda.' }
    }
    console.error('Erro ao alocar paciente:', error.message)
    return { success: false, error: error.message }
  }

  // 2. Atualizar status na fila
  await supabase
    .from('fila_solicitacoes')
    .update({ status_interno: 'EM_CONVOCACAO' })
    .eq('cod_solicitacao', codSolicitacao)

  revalidatePath('/dashboard/agendas')
  revalidatePath('/dashboard/fila')
  return { success: true, data }
}

/**
 * Atualiza os dados clínicos e o status de um agendamento.
 */
export async function updateAgendamentoAction(
  agendamentoId: string,
  input: UpdateAgendamentoInput
) {
  const supabase = await createClient()

  const payload: any = {
    updated_at: new Date().toISOString()
  }

  if (input.compareceu_consulta !== undefined) payload.compareceu_consulta = input.compareceu_consulta
  if (input.data_consulta_realizada !== undefined) payload.data_consulta_realizada = input.data_consulta_realizada
  if (input.parecer_pre_op !== undefined) payload.parecer_pre_op = input.parecer_pre_op
  if (input.data_cirurgia_agendada !== undefined) payload.data_cirurgia_agendada = input.data_cirurgia_agendada
  if (input.cirurgia_realizada !== undefined) payload.cirurgia_realizada = input.cirurgia_realizada
  if (input.data_cirurgia_execucao !== undefined) payload.data_cirurgia_execucao = input.data_cirurgia_execucao
  if (input.data_internacao !== undefined) payload.data_internacao = input.data_internacao
  if (input.data_alta !== undefined) payload.data_alta = input.data_alta
  if (input.data_retorno_pos_op !== undefined) payload.data_retorno_pos_op = input.data_retorno_pos_op
  if (input.status_agendamento !== undefined) payload.status_agendamento = input.status_agendamento
  if (input.observacoes_clinicas !== undefined) payload.observacoes_clinicas = input.observacoes_clinicas
  if (input.desfecho_execucao !== undefined) payload.desfecho_execucao = input.desfecho_execucao
  if (input.intercorrencia_tipo !== undefined) payload.intercorrencia_tipo = input.intercorrencia_tipo
  if (input.intercorrencia_descricao !== undefined) payload.intercorrencia_descricao = input.intercorrencia_descricao
  if (input.realizado_por_medico !== undefined) payload.realizado_por_medico = input.realizado_por_medico

  const { data, error } = await supabase
    .from('agendamentos_procedimentos')
    .update(payload)
    .eq('id', agendamentoId)
    .select('cod_solicitacao, status_agendamento')
    .single()

  if (error) {
    console.error('Erro ao atualizar agendamento:', error.message)
    return { success: false, error: error.message }
  }

  // Sincronizar status_interno na fila se cirurgia realizada, revertida ou cancelamento
  if (data?.cod_solicitacao) {
    if (data.status_agendamento === 'CIRURGIA_REALIZADA') {
      await supabase
        .from('fila_solicitacoes')
        .update({ status_interno: 'PROCEDIMENTO_REALIZADO', execucao_confirmada: true })
        .eq('cod_solicitacao', data.cod_solicitacao)
    } else if (input.cirurgia_realizada === false) {
      await supabase
        .from('fila_solicitacoes')
        .update({ status_interno: 'AGENDADO', execucao_confirmada: false })
        .eq('cod_solicitacao', data.cod_solicitacao)
    } else if (data.status_agendamento === 'DESISTENCIA_PACIENTE') {
      await supabase
        .from('fila_solicitacoes')
        .update({ status_interno: 'DESISTENCIA' })
        .eq('cod_solicitacao', data.cod_solicitacao)
    }
  }

  revalidatePath('/dashboard/agendas')
  revalidatePath('/dashboard/fila')
  return { success: true, data }
}

/**
 * Remove um paciente de uma agenda (desalocação / cancelamento).
 */
export async function removeAgendamentoAction(agendamentoId: string) {
  const supabase = await createClient()

  // Buscar cod_solicitacao antes de remover
  const { data: agendamento } = await supabase
    .from('agendamentos_procedimentos')
    .select('cod_solicitacao')
    .eq('id', agendamentoId)
    .single()

  const { error } = await supabase
    .from('agendamentos_procedimentos')
    .delete()
    .eq('id', agendamentoId)

  if (error) {
    console.error('Erro ao desalocar paciente:', error.message)
    return { success: false, error: error.message }
  }

  // Devolver status do paciente para a fila
  if (agendamento?.cod_solicitacao) {
    await supabase
      .from('fila_solicitacoes')
      .update({ status_interno: 'NA_FILA' })
      .eq('cod_solicitacao', agendamento.cod_solicitacao)
  }

  revalidatePath('/dashboard/agendas')
  revalidatePath('/dashboard/fila')
  return { success: true }
}

/**
 * Busca dados completos para a visão Kanban (agrupados por etapa do funil).
 */
export async function fetchKanbanDataAction(filters?: {
  hospitalId?: string
  medico?: string
  especialidade?: string
}) {
  const supabase = await createClient()

  let query = supabase
    .from('agendamentos_procedimentos')
    .select(`
      id,
      cod_solicitacao,
      paciente_id,
      compareceu_consulta,
      data_consulta_realizada,
      parecer_pre_op,
      data_cirurgia_agendada,
      cirurgia_realizada,
      data_cirurgia_execucao,
      data_internacao,
      data_alta,
      data_retorno_pos_op,
      status_agendamento,
      observacoes_clinicas,
      exportado_sisreg,
      agendas_prestadores!inner (
        id,
        medico_nome,
        especialidade,
        data_agenda,
        horario_inicio,
        hospitais_prestadores (nome)
      ),
      pacientes!inner (
        id,
        nome_usuario,
        cns_usuario,
        cpf_usuario,
        telefone_1,
        telefone_2,
        pacientes_telefones (id, numero, tipo, status, prioridade, nome_contato)
      ),
      fila_solicitacoes!inner (
        cod_solicitacao,
        classificacao_risco,
        posicao_fila,
        procedimentos (desc_sigtap)
      )
    `)
    .order('created_at', { ascending: false })

  if (filters?.hospitalId) {
    query = query.eq('agendas_prestadores.hospital_id', filters.hospitalId)
  }
  if (filters?.medico) {
    query = query.ilike('agendas_prestadores.medico_nome', `%${filters.medico}%`)
  }
  if (filters?.especialidade) {
    query = query.ilike('agendas_prestadores.especialidade', `%${filters.especialidade}%`)
  }

  const { data, error } = await query

  if (error) {
    console.error('Erro ao buscar dados do Kanban:', error.message)
    return { success: false, error: error.message, data: [] }
  }

  return { success: true, data: data || [] }
}

/**
 * Busca dados para o relatório de fechamento / devolutiva ao SISREG.
 */
export async function fetchFechamentoSisregAction(filters?: {
  dataInicio?: string
  dataFim?: string
  hospitalId?: string
  apenasPendentes?: boolean
}) {
  const supabase = await createClient()

  let query = supabase
    .from('agendamentos_procedimentos')
    .select(`
      id,
      cod_solicitacao,
      compareceu_consulta,
      data_consulta_realizada,
      parecer_pre_op,
      data_cirurgia_agendada,
      cirurgia_realizada,
      data_cirurgia_execucao,
      status_agendamento,
      observacoes_clinicas,
      exportado_sisreg,
      data_exportacao_sisreg,
      agendas_prestadores!inner (
        medico_nome,
        especialidade,
        data_agenda,
        hospitais_prestadores (nome, cnes)
      ),
      pacientes!inner (
        nome_usuario,
        cns_usuario,
        cpf_usuario,
        telefone_1
      ),
      fila_solicitacoes!inner (
        cod_solicitacao,
        data_solicitacao,
        procedimentos (cod_sigtap, desc_sigtap)
      )
    `)
    .order('created_at', { ascending: false })

  if (filters?.apenasPendentes) {
    query = query.eq('exportado_sisreg', false)
  }
  if (filters?.dataInicio) {
    query = query.gte('agendas_prestadores.data_agenda', filters.dataInicio)
  }
  if (filters?.dataFim) {
    query = query.lte('agendas_prestadores.data_agenda', filters.dataFim)
  }

  const { data, error } = await query

  if (error) {
    console.error('Erro ao buscar relatório de fechamento SISREG:', error.message)
    return { success: false, error: error.message, data: [] }
  }

  return { success: true, data: data || [] }
}

/**
 * Marca uma lista de agendamentos em lote como exportados / informados ao SISREG.
 */
export async function markExportedSisregAction(agendamentoIds: string[]) {
  const supabase = await createClient()

  if (!agendamentoIds || agendamentoIds.length === 0) {
    return { success: false, error: 'Nenhum item selecionado.' }
  }

  const { error } = await supabase
    .from('agendamentos_procedimentos')
    .update({
      exportado_sisreg: true,
      data_exportacao_sisreg: new Date().toISOString()
    })
    .in('id', agendamentoIds)

  if (error) {
    console.error('Erro ao marcar exportados:', error.message)
    return { success: false, error: error.message }
  }

  revalidatePath('/dashboard/agendas')
  return { success: true }
}
