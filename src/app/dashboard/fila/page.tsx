import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { FilaClient } from './FilaClient'

export default async function FilaPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string
    limit?: string
    search?: string
    proced?: string
    municipio?: string
    risco?: string
    status?: string
    tipo?: string
    antigas?: string
    omitirForaSisreg?: string
    sort?: string
    order?: string
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
    .select('role, nome, cnes_vinculo')
    .eq('id', user.id)
    .single()

  const role = profile?.role || 'OPERADOR_REGULACAO'

  const resolvedParams = await searchParams
  const page = parseInt(resolvedParams.page || '1', 10)
  const limit = parseInt(resolvedParams.limit || '20', 10)
  const offset = (page - 1) * limit
  const sort = resolvedParams.sort || 'posicao_fila'
  const order = resolvedParams.order || 'asc'

  // Construir query da fila com pacientes!inner para permitir filtros
  let query = supabase
    .from('fila_solicitacoes')
    .select(`
      cod_solicitacao,
      data_solicitacao,
      classificacao_risco,
      posicao_fila,
      tipo_fila,
      status_interno,
      status_sisreg,
      data_execucao,
      chave_confirmacao,
      nome_executante,
      estimativa_atendimento_paciente,
      pacientes!inner (id, nome_usuario, cns_usuario, cpf_usuario, data_nascimento, sexo, nome_mae, telefone_1, telefone_2, endereco, municipio_origem, observacoes),
      procedimentos (cod_sigtap, desc_sigtap),
      municipios (codigo_ibge, nome),
      unidades_solicitantes (cnes, nome)
    `, { count: 'exact' })
    .eq('active', true)

  // Filtros de busca
  if (resolvedParams.search) {
    const searchVal = resolvedParams.search.trim()
    if (/^\d+$/.test(searchVal)) {
      if (searchVal.length >= 12) {
        // Provável CNS
        query = query.eq('pacientes.cns_usuario', searchVal)
      } else if (searchVal.length >= 8 && searchVal.length <= 11) {
        // Provável CPF ou Solicitação menor
        query = query.or(`cpf_usuario.eq.${searchVal},cns_usuario.eq.${searchVal}`, { foreignTable: 'pacientes' })
      } else {
        // Código de solicitação
        query = query.eq('cod_solicitacao', parseInt(searchVal, 10))
      }
    } else {
      // Nome do usuário
      query = query.ilike('pacientes.nome_usuario', `%${searchVal}%`)
    }
  }

  if (resolvedParams.proced) {
    query = query.eq('cod_sigtap', resolvedParams.proced)
  }

  if (resolvedParams.municipio) {
    query = query.eq('municipio_origem_ibge', resolvedParams.municipio)
  }

  if (resolvedParams.risco) {
    query = query.eq('classificacao_risco', parseInt(resolvedParams.risco, 10))
  }

  if (resolvedParams.status) {
    query = query.eq('status_interno', resolvedParams.status)
  }

  if (resolvedParams.tipo) {
    query = query.eq('tipo_fila', parseInt(resolvedParams.tipo, 10))
  }

  if (resolvedParams.antigas === 'true') {
    const fiveYearsAgo = new Date()
    fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5)
    query = query.lte('data_solicitacao', fiveYearsAgo.toISOString())
  }

  // Omitir Fora do SISREG por padrão
  const omitirForaSisreg = resolvedParams.omitirForaSisreg !== 'false'
  if (omitirForaSisreg && resolvedParams.status !== 'NAO_ENCONTRADO_SISREG') {
    query = query.neq('status_interno', 'NAO_ENCONTRADO_SISREG')
  }

  // Restrição de unidade
  if (role === 'UNIDADE_USER' && profile?.cnes_vinculo) {
    query = query.eq('cnes_solicitante', profile.cnes_vinculo)
  }

  // Ordenação dinâmica
  if (sort === 'data_solicitacao') {
    query = query
      .order('data_solicitacao', { ascending: order === 'asc' })
      .order('posicao_fila', { ascending: true, nullsFirst: false })
  } else {
    query = query
      .order('posicao_fila', { ascending: true, nullsFirst: false })
      .order('data_solicitacao', { ascending: true })
  }

  query = query.range(offset, offset + limit - 1)

  const { data: solicitacoes, count } = await query

  // Buscar opções de filtros dinamicamente
  const { data: dbProcedimentos } = await supabase.from('procedimentos').select('cod_sigtap, desc_sigtap').order('desc_sigtap')
  const { data: dbMunicipios } = await supabase.from('municipios').select('codigo_ibge, nome').order('nome')

  return (
    <FilaClient
      role={role}
      email={user.email || ''}
      solicitacoes={solicitacoes || []}
      totalItems={count || 0}
      itemsPerPage={limit}
      currentPage={page}
      procedimentos={dbProcedimentos || []}
      municipios={dbMunicipios || []}
      appliedFilters={{
        search: resolvedParams.search || '',
        proced: resolvedParams.proced || '',
        municipio: resolvedParams.municipio || '',
        risco: resolvedParams.risco || '',
        status: resolvedParams.status || '',
        tipo: resolvedParams.tipo || '',
        antigas: resolvedParams.antigas || 'false',
        omitirForaSisreg: omitirForaSisreg ? 'true' : 'false',
      }}
    />
  )
}
