import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { EspecialidadesClient } from './EspecialidadesClient'

export default async function EspecialidadesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('users')
    .select('role, nome')
    .eq('id', user.id)
    .single()

  const role = profile?.role || 'OPERADOR_REGULACAO'

  const allowedRoles = ['SMS_ADMIN', 'COORDENADOR', 'OPERADOR_REGULACAO']
  if (!allowedRoles.includes(role)) {
    redirect('/dashboard')
  }

  // Buscar especialidades do banco de dados
  const { data: dbEspecialidades, error } = await supabase
    .from('especialidades')
    .select('*')
    .order('nome')

  if (error) {
    console.error('Erro ao buscar especialidades:', error)
  }

  return (
    <EspecialidadesClient
      role={role}
      email={user.email || ''}
      initialEspecialidades={dbEspecialidades || []}
    />
  )
}
