import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { MovimentacoesClient } from './MovimentacoesClient'

export default async function MovimentacoesPage() {
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

  // Restrição de acesso a apenas perfis que podem ver/gerenciar movimentações
  const allowedRoles = ['SMS_ADMIN', 'COORDENADOR', 'OPERADOR_REGULACAO', 'MEDICO_REGULADOR']
  if (!allowedRoles.includes(role)) {
    redirect('/dashboard')
  }

  // Buscar todas as movimentações da fila
  const { data: dbMovs, error } = await supabase
    .from('movimentacoes_fila')
    .select(`
      id,
      cod_solicitacao,
      tipo,
      justificativa,
      status,
      valor_anterior,
      valor_novo,
      observacoes_decisao,
      created_at,
      updated_at,
      solicitante:users!solicitada_por(nome, email),
      aprovador:users!aprovada_por(nome, email),
      solicitacao:fila_solicitacoes(
        cod_solicitacao,
        pacientes(nome_usuario, cns_usuario, cpf_usuario),
        procedimentos(desc_sigtap)
      )
    `)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching movements:', error)
  }

  return (
    <MovimentacoesClient
      role={role}
      email={user.email || ''}
      movimentacoes={dbMovs || []}
    />
  )
}
