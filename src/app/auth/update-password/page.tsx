import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { UpdatePasswordClient } from './UpdatePasswordClient'

export default async function UpdatePasswordPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Obter perfil do usuário logado para obter a role
  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = profile?.role || 'OPERADOR_REGULACAO'

  return (
    <UpdatePasswordClient
      role={role}
      email={user.email || ''}
    />
  )
}
