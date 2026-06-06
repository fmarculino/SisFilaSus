import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { MensagemClient } from './MensagemClient'

export default async function MensagemPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Obter perfil do usuário
  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = profile?.role || 'OPERADOR_REGULACAO'

  // Apenas gestores administram os templates de resposta
  const allowedRoles = ['SMS_ADMIN', 'COORDENADOR']
  if (!allowedRoles.includes(role)) {
    redirect('/dashboard')
  }

  // Carregar os modelos de mensagens cadastrados
  const { data: templates } = await supabase
    .from('templates_mensagem')
    .select('*')
    .order('titulo', { ascending: true })

  return (
    <MensagemClient 
      role={role}
      email={user.email || ''}
      templates={templates || []}
    />
  )
}
