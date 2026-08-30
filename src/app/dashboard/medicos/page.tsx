import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { MedicosClient } from './MedicosClient'

export default async function MedicosPage() {
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

  // Buscar médicos cadastrados com relacionamentos
  const { data: dbMedicos, error: errMedicos } = await supabase
    .from('medicos')
    .select(`
      id,
      nome,
      crm,
      uf_crm,
      especialidade_id,
      especialidade_nome,
      hospital_id,
      telefone,
      email,
      active,
      created_at,
      especialidades (id, nome),
      hospitais_prestadores (id, nome, cnes)
    `)
    .order('nome')

  if (errMedicos) {
    console.error('Erro ao buscar médicos:', errMedicos)
  }

  // Buscar especialidades ativas
  const { data: dbEspecialidades } = await supabase
    .from('especialidades')
    .select('id, nome')
    .eq('active', true)
    .order('nome')

  // Buscar prestadores ativos
  const { data: dbPrestadores } = await supabase
    .from('hospitais_prestadores')
    .select('id, nome, cnes')
    .eq('active', true)
    .order('nome')

  return (
    <MedicosClient
      role={role}
      email={user.email || ''}
      initialMedicos={dbMedicos || []}
      especialidades={dbEspecialidades || []}
      prestadores={dbPrestadores || []}
    />
  )
}
