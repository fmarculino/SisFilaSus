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
    unidade?: string
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

  // Buscar configurações gerais do banco de dados
  const { data: configRow } = await supabase
    .from('configuracoes')
    .select('valor')
    .eq('chave', 'geral')
    .maybeSingle()

  const defaultConfig = {
    limite_tentativas_contato: 3,
    anos_limpeza_fila: 5,
    municipio_sede: 'MARABÁ',
    omitir_fora_sisreg_padrao: true
  }

  const config = configRow?.valor 
    ? { ...defaultConfig, ...(configRow.valor as any) }
    : defaultConfig

  const omitirForaSisregDefault = config.omitir_fora_sisreg_padrao
  const anosLimpezaFila = config.anos_limpeza_fila

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
      // Nome do usuário (Busca multi-termo inteligente)
      const words = searchVal.split(/\s+/).filter(w => w.length > 0)
      words.forEach(word => {
        query = query.ilike('pacientes.nome_usuario', `%${word}%`)
      })
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

  if (resolvedParams.unidade) {
    query = query.eq('cnes_solicitante', resolvedParams.unidade)
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
    const yearsAgo = new Date()
    yearsAgo.setFullYear(yearsAgo.getFullYear() - anosLimpezaFila)
    query = query.lte('data_solicitacao', yearsAgo.toISOString())
  }

  // Omitir Fora do SISREG
  const omitirForaSisreg = resolvedParams.omitirForaSisreg !== undefined
    ? resolvedParams.omitirForaSisreg === 'true'
    : omitirForaSisregDefault

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
  const { data: dbUnidades } = await supabase.from('unidades_solicitantes').select('cnes, nome').order('nome')

  // Buscar especialidades cadastradas e dos procedimentos
  const { data: dbEspecialidadesTable } = await supabase
    .from('especialidades')
    .select('nome')
    .eq('active', true)

  const { data: dbEspecialidadesProc } = await supabase
    .from('procedimentos')
    .select('grupo_descricao')
    .not('grupo_descricao', 'is', null)

  const especialidades = Array.from(
    new Set([
      ...(dbEspecialidadesTable || []).map(e => e.nome?.trim()),
      ...(dbEspecialidadesProc || []).map(p => p.grupo_descricao?.trim())
    ])
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
      unidades={dbUnidades || []}
      especialidades={especialidades}
      omitirForaSisregDefault={omitirForaSisregDefault}
      anosLimpezaFila={anosLimpezaFila}
      appliedFilters={{
        search: resolvedParams.search || '',
        proced: resolvedParams.proced || '',
        municipio: resolvedParams.municipio || '',
        unidade: resolvedParams.unidade || '',
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
