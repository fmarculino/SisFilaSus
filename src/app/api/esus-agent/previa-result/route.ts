import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { job_id, total_estimado = 0 } = body

    if (!job_id) {
      return NextResponse.json({ success: false, error: 'job_id é obrigatório.' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const tempoEstimadoSegundos = Math.max(5, Math.ceil(total_estimado / 80))

    await supabase
      .from('esus_sync_jobs')
      .update({
        status: 'CONCLUIDO',
        total_estimado,
        tempo_estimado_segundos: tempoEstimadoSegundos,
        mensagem_status: `Prévia calculada: ${total_estimado.toLocaleString('pt-BR')} cidadãos identificados (~${tempoEstimadoSegundos}s estimados).`,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', job_id)

    return NextResponse.json({ success: true, total_estimado, tempoEstimadoSegundos })
  } catch (err: any) {
    console.error('Erro em /api/esus-agent/previa-result:', err)
    return NextResponse.json(
      { success: false, error: err.message || 'Erro ao registrar prévia.' },
      { status: 500 }
    )
  }
}
