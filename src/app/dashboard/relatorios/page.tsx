import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { RelatoriosClient } from './RelatoriosClient'

export default async function RelatoriosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Obter perfil do usuário
  const { data: profile } = await supabase
    .from('users')
    .select('role, nome')
    .eq('id', user.id)
    .single()

  const role = profile?.role || 'OPERADOR_REGULACAO'

  // Restrição de acesso: Apenas SMS_ADMIN e COORDENADOR podem ver os relatórios
  const allowedRoles = ['SMS_ADMIN', 'COORDENADOR']
  if (!allowedRoles.includes(role)) {
    redirect('/dashboard')
  }

  // Fetch report data from views in parallel
  const [
    esperaProcedRes,
    esperaRiscoRes,
    produtividadeRes,
    statusDistRes
  ] = await Promise.all([
    supabase.from('vw_relatorio_espera_procedimento').select('*'),
    supabase.from('vw_relatorio_espera_risco').select('*'),
    supabase.from('vw_relatorio_produtividade_operador').select('*'),
    supabase.from('vw_relatorio_status_distribuicao').select('*')
  ])

  return (
    <RelatoriosClient
      role={role}
      email={user.email || ''}
      esperaProcedimento={esperaProcedRes.data || []}
      esperaRisco={esperaRiscoRes.data || []}
      produtividadeOperador={produtividadeRes.data || []}
      statusDistribuicao={statusDistRes.data || []}
    />
  )
}
