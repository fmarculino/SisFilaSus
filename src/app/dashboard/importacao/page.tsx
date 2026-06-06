import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
// Importação do componente cliente de importação
import { ImportacaoClient } from './ImportacaoClient'

export default async function ImportPage() {
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
  
  // Apenas Admins e Coordenadores podem acessar a importação
  if (role !== 'SMS_ADMIN' && role !== 'COORDENADOR') {
    redirect('/dashboard')
  }

  return (
    <ImportacaoClient 
      role={role} 
      email={user.email || ''} 
    />
  )
}
