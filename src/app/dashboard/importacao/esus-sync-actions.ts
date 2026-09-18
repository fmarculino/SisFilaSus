'use server'

import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'

export interface EsusSyncJob {
  id: string
  status: 'PENDENTE' | 'PROCESSANDO' | 'CONCLUIDO' | 'ERRO' | 'CANCELADO'
  solicitado_por: string | null
  solicitado_por_id: string | null
  parametros: {
    dias?: number
    all?: boolean
  }
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

/**
 * Solicita uma nova sincronização com o banco e-SUS PEC
 */
export async function solicitarSincronizacaoEsusAction(
  dias: number = 30,
  isAll: boolean = false
): Promise<{ success: boolean; job?: EsusSyncJob; error?: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Usuário não autenticado.' }
    }

    const adminClient = createAdminClient()

    // Verificar se já existe um job PENDENTE ou PROCESSANDO
    const { data: activeJob } = await adminClient
      .from('esus_sync_jobs')
      .select('id, status, created_at')
      .in('status', ['PENDENTE', 'PROCESSANDO'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (activeJob) {
      return {
        success: false,
        error: `Já existe uma sincronização em andamento ou na fila (Status: ${activeJob.status}). Aguarde a conclusão.`
      }
    }

    const { data, error } = await adminClient
      .from('esus_sync_jobs')
      .insert({
        status: 'PENDENTE',
        solicitado_por: user.email,
        solicitado_por_id: user.id,
        parametros: {
          dias: isAll ? undefined : dias,
          all: isAll
        },
        stats: {},
        mensagem_status: 'Aguardando atendimento pelo Agente Local...'
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
 * Consulta o job de sincronização mais recente
 */
export async function obterUltimoJobSincronizacaoAction(): Promise<{
  success: boolean
  job?: EsusSyncJob | null
  error?: string
}> {
  try {
    const adminClient = createAdminClient()
    const { data, error } = await adminClient
      .from('esus_sync_jobs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      // Se a tabela ainda não foi criada no banco
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
        mensagem_status: 'Cancelado pelo usuário.'
      })
      .eq('id', jobId)
      .eq('status', 'PENDENTE')

    if (error) return { success: false, error: error.message }
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}
