import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { UsuariosClient } from './UsuariosClient'

export default async function UsuariosPage() {
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

  // Restrição de acesso: Apenas SMS_ADMIN e COORDENADOR podem gerenciar usuários
  const allowedRoles = ['SMS_ADMIN', 'COORDENADOR']
  if (!allowedRoles.includes(role)) {
    redirect('/dashboard')
  }

  // Buscar todos os perfis cadastrados no banco
  const { data: dbUsers } = await supabase
    .from('users')
    .select('*')
    .order('nome')

  // Buscar unidades de saúde solicitantes para vínculo
  const { data: dbUnidades } = await supabase
    .from('unidades_solicitantes')
    .select('cnes, nome')
    .order('nome')

  return (
    <UsuariosClient
      role={role}
      email={user.email || ''}
      users={dbUsers || []}
      unidades={dbUnidades || []}
    />
  )
}
