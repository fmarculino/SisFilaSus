import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { AuditoriaClient } from './AuditoriaClient'

export default async function AuditoriaPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string
    limit?: string
    tabela?: string
    acao?: string
    usuario?: string
    search?: string
  }>
}) {
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

  // Restrição de acesso: Apenas SMS_ADMIN e COORDENADOR podem ver os logs de auditoria
  const allowedRoles = ['SMS_ADMIN', 'COORDENADOR']
  if (!allowedRoles.includes(role)) {
    redirect('/dashboard')
  }

  const resolvedParams = await searchParams
  const page = parseInt(resolvedParams.page || '1', 10)
  const limit = parseInt(resolvedParams.limit || '50', 10)
  const offset = (page - 1) * limit

  let query = supabase
    .from('audit_log')
    .select(`
      id,
      tabela,
      registro_id,
      acao,
      dados_anteriores,
      dados_novos,
      created_at,
      users (nome, email)
    `, { count: 'exact' })

  // Filtros
  if (resolvedParams.tabela) {
    query = query.eq('tabela', resolvedParams.tabela)
  }

  if (resolvedParams.acao) {
    query = query.eq('acao', resolvedParams.acao)
  }

  if (resolvedParams.usuario) {
    query = query.eq('usuario_id', resolvedParams.usuario)
  }

  if (resolvedParams.search) {
    query = query.or(`registro_id.ilike.%${resolvedParams.search}%,tabela.ilike.%${resolvedParams.search}%`)
  }

  // Ordenação e Paginação
  query = query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  const { data: logs, count } = await query

  // Buscar todos os usuários para o filtro de usuários
  const { data: dbUsers } = await supabase
    .from('users')
    .select('id, nome, email')
    .order('nome')

  return (
    <AuditoriaClient
      role={role}
      email={user.email || ''}
      logs={logs || []}
      totalItems={count || 0}
      itemsPerPage={limit}
      currentPage={page}
      usersList={dbUsers || []}
      appliedFilters={{
        tabela: resolvedParams.tabela || '',
        acao: resolvedParams.acao || '',
        usuario: resolvedParams.usuario || '',
        search: resolvedParams.search || '',
      }}
    />
  )
}
