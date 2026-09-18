'use server'

import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'

export interface EsusSyncJob {
  id: string
  tipo: 'PREVIA' | 'SINCRONIZACAO'
  status: 'PENDENTE' | 'PROCESSANDO' | 'CONCLUIDO' | 'ERRO' | 'CANCELADO'
  solicitado_por: string | null
  solicitado_por_id: string | null
  parametros: {
    dias?: number
    all?: boolean
  }
  total_estimado: number
  total_processado: number
  progresso_pct: number
  tempo_estimado_segundos: number
  tempo_decorrido_segundos: number
  stats: {
    totalLidos?: number
    totalSalvosEsus?: number
    totalPacientesEnriquecidos?: number
    totalTelefonesAdicionados?: number
    totalEnderecosAtualizados?: number
    totalUnidadesVinculadas?: number
    tempoDecorrido?: string
  }
  mensagem_status: string | null
  mensagem_erro: string | null
  agente_identificador: string | null
  created_at: string
  started_at: string | null
  completed_at: string | null
}

export interface EsusAgenteStatus {
  online: boolean
  identificador?: string
  versao?: string
  ultimoHeartbeat?: string
}

/**
 * Solicita uma PRÉVIA (apenas contagem e estimativa) antes de iniciar
 */
export async function solicitarPreviaEsusAction(
  dias: number = 30,
  isAll: boolean = false
): Promise<{ success: boolean; job?: EsusSyncJob; error?: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { success: false, error: 'Usuário não autenticado.' }

    const adminClient = createAdminClient()

    // Limpar prévias antigas não concluídas deste usuário
    await adminClient
      .from('esus_sync_jobs')
      .update({ status: 'CANCELADO' })
      .eq('tipo', 'PREVIA')
      .in('status', ['PENDENTE', 'PROCESSANDO'])

    const { data, error } = await adminClient
      .from('esus_sync_jobs')
      .insert({
        tipo: 'PREVIA',
        status: 'PENDENTE',
        solicitado_por: user.email,
        solicitado_por_id: user.id,
        parametros: {
          dias: isAll ? undefined : dias,
          all: isAll
        },
        stats: {},
        mensagem_status: 'Consultando contagem de registros no e-SUS PEC...'
      })
      .select()
      .single()

    if (error) return { success: false, error: error.message }
    return { success: true, job: data as EsusSyncJob }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

/**
 * Solicita uma nova sincronização com o banco e-SUS PEC
 */
export async function solicitarSincronizacaoEsusAction(
  dias: number = 30,
  isAll: boolean = false,
  totalEstimado: number = 0
): Promise<{ success: boolean; job?: EsusSyncJob; error?: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Usuário não autenticado.' }
    }

    const adminClient = createAdminClient()

    // Verificar se já existe uma sincronização ativa em andamento
    const { data: activeJob } = await adminClient
      .from('esus_sync_jobs')
      .select('id, status, created_at')
      .eq('tipo', 'SINCRONIZACAO')
      .in('status', ['PENDENTE', 'PROCESSANDO'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (activeJob) {
      return {
        success: false,
        error: `Já existe uma sincronização em andamento (Status: ${activeJob.status}). Aguarde a conclusão.`
      }
    }

    const estimatedSeconds = Math.max(10, Math.ceil(totalEstimado / 80))

    const { data, error } = await adminClient
      .from('esus_sync_jobs')
      .insert({
        tipo: 'SINCRONIZACAO',
        status: 'PENDENTE',
        solicitado_por: user.email,
        solicitado_por_id: user.id,
        parametros: {
          dias: isAll ? undefined : dias,
          all: isAll
        },
        total_estimado: totalEstimado,
        tempo_estimado_segundos: estimatedSeconds,
        progresso_pct: 0,
        stats: {},
        mensagem_status: 'Aguardando atendimento pelo Agente Local no servidor...'
      })
      .select()
      .single()

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true, job: data as EsusSyncJob }
  } catch (err: any) {
    return { success: false, error: err.message || 'Erro inesperado ao solicitar sincronização.' }
  }
}

/**
 * Consulta o job mais recente (sincronização ou prévia)
 */
export async function obterUltimoJobSincronizacaoAction(tipo: 'PREVIA' | 'SINCRONIZACAO' = 'SINCRONIZACAO'): Promise<{
  success: boolean
  job?: EsusSyncJob | null
  error?: string
}> {
  try {
    const adminClient = createAdminClient()
    const { data, error } = await adminClient
      .from('esus_sync_jobs')
      .select('*')
      .eq('tipo', tipo)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      if (error.code === 'PGRST205' || error.message?.includes('schema cache')) {
        return { success: true, job: null }
      }
      return { success: false, error: error.message }
    }

    return { success: true, job: data as EsusSyncJob | null }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

/**
 * Verifica se há algum Agente Local online com heartbeat recente
 */
export async function verificarAgenteOnlineAction(): Promise<{
  success: boolean
  status: EsusAgenteStatus
}> {
  try {
    const adminClient = createAdminClient()
    const cutoff = new Date(Date.now() - 45000).toISOString() // 45 segundos atrás

    const { data, error } = await adminClient
      .from('esus_agentes')
      .select('*')
      .gte('ultimo_heartbeat', cutoff)
      .order('ultimo_heartbeat', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error || !data) {
      return { success: true, status: { online: false } }
    }

    return {
      success: true,
      status: {
        online: true,
        identificador: data.identificador,
        versao: data.versao,
        ultimoHeartbeat: data.ultimo_heartbeat
      }
    }
  } catch (err) {
    return { success: true, status: { online: false } }
  }
}

/**
 * Cancela um job pendente
 */
export async function cancelarJobSincronizacaoAction(
  jobId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const adminClient = createAdminClient()
    const { error } = await adminClient
      .from('esus_sync_jobs')
      .update({
        status: 'CANCELADO',
        mensagem_status: 'Cancelado pelo operador.'
      })
      .eq('id', jobId)
      .in('status', ['PENDENTE', 'PROCESSANDO'])

    if (error) return { success: false, error: error.message }
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}
