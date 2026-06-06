import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { parseAndImportCSV } from '@/lib/import-parser'
import { logAudit } from '@/lib/audit'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    // Verificar permissões (Apenas SMS_ADMIN e COORDENADOR podem importar)
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || (profile.role !== 'SMS_ADMIN' && profile.role !== 'COORDENADOR')) {
      return NextResponse.json({ error: 'Acesso negado. Apenas administradores ou coordenadores podem realizar importações.' }, { status: 403 })
    }

    const { fileContent, fileName } = await request.json()

    if (!fileContent || !fileName) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado ou formato inválido' }, { status: 400 })
    }

    const stats = await parseAndImportCSV(fileContent, fileName, user.id)

    // Auditoria
    await logAudit({
      acao: 'IMPORT',
      tabela: 'importacoes',
      registro_id: fileName,
      dados_novos: stats
    })

    return NextResponse.json(stats)
  } catch (error: any) {
    console.error('Erro na rota de importação:', error)
    return NextResponse.json({ error: error.message || 'Erro interno do servidor.' }, { status: 500 })
  }
}
