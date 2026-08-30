import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { MunicipiosClient } from './MunicipiosClient'

export default async function MunicipiosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

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

  // Buscar municípios
  const { data: dbMunicipios, error: errMun } = await supabase
    .from('municipios')
    .select('*')
    .order('nome')

  if (errMun) {
    console.error('Erro ao buscar municípios:', errMun)
  }

  return (
    <MunicipiosClient
      role={role}
      email={user.email || ''}
      initialMunicipios={dbMunicipios || []}
    />
  )
}
