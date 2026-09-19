import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * Endpoint de Heartbeat do Comunicador/Agente e-SUS PEC.
 * O aplicativo local envia um POST periodicamente (a cada 15s) para atestar que está
 * ativo, conectado e pronto para processar sincronizações.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const {
      identificador = 'SMS-AGENT-UNKNOWN',
      versao = '1.3.0',
      status = 'ONLINE',
      metadados = {}
    } = body

    const supabase = createAdminClient()
    const nowIso = new Date().toISOString()

    // 1. Gravar sinal de vida no banco de dados
    const { error: upsertErr } = await supabase
      .from('esus_agentes')
      .upsert({
        identificador,
        versao,
        status: status === 'OFFLINE' ? 'OFFLINE' : 'ONLINE',
        ultimo_heartbeat: nowIso,
        metadados: {
          ...metadados,
          ip_origem: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'local'
        },
        updated_at: nowIso
      }, { onConflict: 'identificador' })

    if (upsertErr) {
      console.error('Erro ao atualizar esus_agentes:', upsertErr.message)
    }

    // 2. Verificar se há algum job de sincronização pendente na fila
    const { data: pendingJob } = await supabase
      .from('esus_sync_jobs')
      .select('id, tipo, parametros, created_at')
      .eq('status', 'PENDENTE')
      .order('tipo', { ascending: false }) // PREVIA tem prioridade
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    return NextResponse.json({
      success: true,
      online: true,
      ultimo_heartbeat: nowIso,
      has_pending_job: !!pendingJob,
      pending_job: pendingJob || null
    }, {
      headers: {
        'Cache-Control': 'no-store, max-age=0'
      }
    })
  } catch (err: any) {
    console.error('Falha no processamento do heartbeat do agente:', err)
    return NextResponse.json(
      { success: false, error: err.message || 'Erro interno no heartbeat' },
      { status: 500 }
    )
  }
}
