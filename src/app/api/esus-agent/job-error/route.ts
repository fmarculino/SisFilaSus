import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { job_id, mensagem_erro = 'Erro desconhecido durante execução no Agente.' } = body

    if (!job_id) {
      return NextResponse.json({ success: false, error: 'job_id é obrigatório.' }, { status: 400 })
    }

    const supabase = createAdminClient()
    await supabase
      .from('esus_sync_jobs')
      .update({
        status: 'ERRO',
        mensagem_erro,
        mensagem_status: 'Falha durante o processamento no e-SUS local.',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', job_id)

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
