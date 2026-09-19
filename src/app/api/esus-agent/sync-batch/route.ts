import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { processEsusCidadaosBatch } from '@/lib/esus-importer'
import { EsusCidadaoParsed } from '@/lib/esus-parser'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const {
      job_id,
      batch_index = 1,
      is_last_batch = false,
      total_estimado = 0,
      total_processados = 0,
      tempo_decorrido_segundos = 0,
      cidadaos = []
    } = body

    if (!job_id) {
      return NextResponse.json({ success: false, error: 'job_id é obrigatório.' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // 1. Processar enriquecimento do lote de cidadãos no banco
    let batchStats = {
      totalSalvoEsusBase: 0,
      totalPacientesSisFilaEncontrados: 0,
      totalTelefonesAdicionados: 0,
      totalEnderecosAtualizados: 0,
      totalUnidadesVinculadas: 0,
    }

    if (Array.isArray(cidadaos) && cidadaos.length > 0) {
      const batchLabel = `e-SUS PEC Agente - Lote ${batch_index}`
      batchStats = await processEsusCidadaosBatch(cidadaos as EsusCidadaoParsed[], batchLabel)
    }

    // 2. Buscar dados atuais do job para acumular estatísticas
    const { data: currentJob } = await supabase
      .from('esus_sync_jobs')
      .select('stats, total_estimado')
      .eq('id', job_id)
      .maybeSingle()

    const oldStats = currentJob?.stats || {}
    const effTotalEstimado = total_estimado || currentJob?.total_estimado || 0

    const accumStats = {
      totalLidos: total_processados,
      totalSalvosEsus: (oldStats.totalSalvosEsus || 0) + batchStats.totalSalvoEsusBase,
      totalPacientesEnriquecidos: (oldStats.totalPacientesEnriquecidos || 0) + batchStats.totalPacientesSisFilaEncontrados,
      totalTelefonesAdicionados: (oldStats.totalTelefonesAdicionados || 0) + batchStats.totalTelefonesAdicionados,
      totalEnderecosAtualizados: (oldStats.totalEnderecosAtualizados || 0) + batchStats.totalEnderecosAtualizados,
      totalUnidadesVinculadas: (oldStats.totalUnidadesVinculadas || 0) + batchStats.totalUnidadesVinculadas,
      tempoDecorrido: `${tempo_decorrido_segundos}s`
    }

    const progressoPct = is_last_batch
      ? 100
      : effTotalEstimado > 0
        ? Math.min(99, Math.round((total_processados / effTotalEstimado) * 100))
        : 50

    const updatePayload: any = {
      status: is_last_batch ? 'CONCLUIDO' : 'PROCESSANDO',
      total_processado: total_processados,
      total_estimado: effTotalEstimado,
      progresso_pct: progressoPct,
      tempo_decorrido_segundos,
      stats: accumStats,
      mensagem_status: is_last_batch
        ? `Sincronização concluída com sucesso em ${tempo_decorrido_segundos}s!`
        : `Processando lote ${batch_index}... (${total_processados.toLocaleString('pt-BR')} de ${effTotalEstimado.toLocaleString('pt-BR')} | +${accumStats.totalPacientesEnriquecidos} enriquecidos)`,
      updated_at: new Date().toISOString()
    }

    if (is_last_batch) {
      updatePayload.completed_at = new Date().toISOString()
    }

    await supabase.from('esus_sync_jobs').update(updatePayload).eq('id', job_id)

    return NextResponse.json({
      success: true,
      batch_index,
      is_last_batch,
      stats: accumStats
    })
  } catch (err: any) {
    console.error('Erro em /api/esus-agent/sync-batch:', err)
    return NextResponse.json(
      { success: false, error: err.message || 'Erro interno no processamento do lote.' },
      { status: 500 }
    )
  }
}
