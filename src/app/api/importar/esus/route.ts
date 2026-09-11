import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { processEsusImport } from '@/lib/esus-importer'
import { logAudit } from '@/lib/audit'

export const maxDuration = 300 // 5 minutos máximo para processar lote

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    // Apenas Administradores e Coordenadores podem importar
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    const allowedRoles = ['SMS_ADMIN', 'COORDENADOR', 'OPERADOR_REGULACAO']
    if (!profile || !allowedRoles.includes(profile.role)) {
      return NextResponse.json(
        { error: 'Acesso negado. Perfil sem permissão para importar cadastros e-SUS.' },
        { status: 403 }
      )
    }

    const { fileContent, fileName, cnesManual } = await request.json()

    if (!fileContent || !fileName) {
      return NextResponse.json(
        { error: 'Arquivo inválido ou não informado.' },
        { status: 400 }
      )
    }

    const stats = await processEsusImport(fileContent, fileName, cnesManual)

    // Auditoria
    await logAudit({
      acao: 'IMPORT',
      tabela: 'esus_cadastros',
      registro_id: fileName,
      dados_novos: stats
    })

    return NextResponse.json(stats)
  } catch (error: any) {
    console.error('Erro na rota de importação e-SUS:', error)
    return NextResponse.json(
      { error: error.message || 'Erro interno ao processar arquivo e-SUS.' },
      { status: 500 }
    )
  }
}
