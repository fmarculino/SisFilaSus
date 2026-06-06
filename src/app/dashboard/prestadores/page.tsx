import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { PrestadoresClient } from './PrestadoresClient'

export default async function PrestadoresPage() {
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

  // Restrição de acesso: Apenas gestores podem gerenciar prestadores
  const allowedRoles = ['SMS_ADMIN', 'COORDENADOR']
  if (!allowedRoles.includes(role)) {
    redirect('/dashboard')
  }

  // Buscar todos os hospitais prestadores
  const { data: dbPrestadores, error } = await supabase
    .from('hospitais_prestadores')
    .select('*')
    .order('nome')

  if (error) {
    console.error('Error fetching providers:', error)
  }

  return (
    <PrestadoresClient
      role={role}
      email={user.email || ''}
      prestadores={dbPrestadores || []}
    />
  )
}
