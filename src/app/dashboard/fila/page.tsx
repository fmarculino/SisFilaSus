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
    especialidade?: string
    modalidade?: string
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

  // Construir query da fila com pacientes!inner e procedimentos!inner para permitir filtros
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
      procedimentos!inner (cod_sigtap, desc_sigtap, grupo_descricao),
      municipios (codigo_ibge, nome),
      unidades_solicitantes (cnes, nome)
    `, { count: 'exact' })
    .eq('active', true)

  // Filtros de busca
  if (resolvedParams.search) {
    const searchVal = resolvedParams.search.trim()
    const cleanDigits = searchVal.replace(/\D/g, '')

    if (/^\d+$/.test(cleanDigits) && cleanDigits.length > 0) {
      if (cleanDigits.length === 15) {
        // Provável CNS
        query = query.eq('pacientes.cns_usuario', cleanDigits)
      } else if (cleanDigits.length === 11) {
        // Provável CPF
        query = query.eq('pacientes.cpf_usuario', cleanDigits)
      } else if (cleanDigits.length >= 8 && cleanDigits.length <= 14) {
        // CPF parcial ou CNS parcial
        query = query.or(`cpf_usuario.like.%${cleanDigits}%,cns_usuario.like.%${cleanDigits}%`, { foreignTable: 'pacientes' })
      } else {
        // Código de solicitação
        query = query.eq('cod_solicitacao', parseInt(cleanDigits, 10))
      }
    } else {
      // Nome do usuário
      query = query.ilike('pacientes.nome_usuario', `%${searchVal}%`)
    }
  }

  if (resolvedParams.proced) {
    query = query.eq('cod_sigtap', resolvedParams.proced)
  }

  if (resolvedParams.especialidade) {
    query = query.eq('procedimentos.grupo_descricao', resolvedParams.especialidade)
  }

  if (resolvedParams.modalidade) {
    query = query.eq('modalidade_fila', parseInt(resolvedParams.modalidade, 10))
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

  // Buscar especialidades únicas cadastradas
  const { data: dbEspecialidades } = await supabase
    .from('procedimentos')
    .select('grupo_descricao')
    .not('grupo_descricao', 'is', null)

  const especialidades = Array.from(
    new Set((dbEspecialidades || []).map(p => p.grupo_descricao?.trim()))
  ).filter(Boolean).sort() as string[]

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
      especialidades={especialidades}
      appliedFilters={{
        search: resolvedParams.search || '',
        proced: resolvedParams.proced || '',
        municipio: resolvedParams.municipio || '',
        risco: resolvedParams.risco || '',
        status: resolvedParams.status || '',
        tipo: resolvedParams.tipo || '',
        antigas: resolvedParams.antigas || 'false',
        omitirForaSisreg: omitirForaSisreg ? 'true' : 'false',
        especialidade: resolvedParams.especialidade || '',
        modalidade: resolvedParams.modalidade || '',
      }}
    />
  )
}
