import { createClient, createAdminClient } from '@/utils/supabase/server'
import { headers } from 'next/headers'

export async function logAudit({
  acao,
  tabela,
  registro_id,
  dados_anteriores,
  dados_novos,
}: {
  acao: string
  tabela: string
  registro_id: string
  dados_anteriores?: any
  dados_novos?: any
}) {
  try {
    const supabase = await createClient()
    const adminSupabase = await createAdminClient()
    
    // Obter usuário da sessão
    const { data: { user } } = await supabase.auth.getUser()
    const headerList = await headers()
    
    const ip = headerList.get('x-forwarded-for')?.split(',')[0] || 
               headerList.get('x-real-ip') || 
               'unknown'
    const userAgent = headerList.get('user-agent') || 'unknown'

    const { error } = await adminSupabase.from('audit_log').insert({
      usuario_id: user?.id,
      acao,
      tabela,
      registro_id,
      dados_anteriores,
      dados_novos,
      ip_address: ip,
      user_agent: userAgent
    })

    if (error) {
      console.error('Failed to log audit event:', error)
    }
  } catch (err) {
    console.error('Critical error in audit logger:', err)
  }
}
