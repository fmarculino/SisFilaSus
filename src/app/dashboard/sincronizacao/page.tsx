import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { fetchDivergenciasAction } from './actions'
import { SincronizacaoClient } from './SincronizacaoClient'

export default async function SincronizacaoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Obter perfil do usuário logado
  const { data: profile } = await supabase
    .from('users')
    .select('role, nome')
    .eq('id', user.id)
    .single()

  const role = profile?.role || 'OPERADOR_REGULACAO'

  // Apenas Administradores, Coordenadores e Operadores têm acesso
  const allowedRoles = ['SMS_ADMIN', 'COORDENADOR', 'OPERADOR_REGULACAO']
  if (!allowedRoles.includes(role)) {
    redirect('/dashboard')
  }

  const result = await fetchDivergenciasAction()

  return (
    <SincronizacaoClient
      role={role}
      email={user.email || ''}
      initialDivergencias={result.data || []}
    />
  )
}
