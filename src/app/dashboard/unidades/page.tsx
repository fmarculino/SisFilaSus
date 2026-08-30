import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { UnidadesClient } from './UnidadesClient'

export default async function UnidadesPage() {
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

  // Buscar unidades solicitantes com município
  const { data: dbUnidades, error: errUnidades } = await supabase
    .from('unidades_solicitantes')
    .select(`
      cnes,
      nome,
      tipo,
      municipio_ibge,
      created_at,
      municipios (codigo_ibge, nome)
    `)
    .order('nome')

  if (errUnidades) {
    console.error('Erro ao buscar unidades:', errUnidades)
  }

  // Buscar municípios para o dropdown
  const { data: dbMunicipios } = await supabase
    .from('municipios')
    .select('codigo_ibge, nome')
    .order('nome')

  return (
    <UnidadesClient
      role={role}
      email={user.email || ''}
      initialUnidades={dbUnidades || []}
      municipios={dbMunicipios || []}
    />
  )
}
