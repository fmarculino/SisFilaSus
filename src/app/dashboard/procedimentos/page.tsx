import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { ProcedimentosClient } from './ProcedimentosClient'

export default async function ProcedimentosPage() {
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

  // Buscar procedimentos com contagem ou lista
  const { data: dbProcedimentos, error: errProced } = await supabase
    .from('procedimentos')
    .select('*')
    .order('desc_sigtap')

  if (errProced) {
    console.error('Erro ao buscar procedimentos:', errProced)
  }

  // Buscar especialidades para vínculo
  const { data: dbEspecialidades } = await supabase
    .from('especialidades')
    .select('id, nome')
    .eq('active', true)
    .order('nome')

  return (
    <ProcedimentosClient
      role={role}
      email={user.email || ''}
      initialProcedimentos={dbProcedimentos || []}
      especialidades={dbEspecialidades || []}
    />
  )
}
