import { unstable_cache } from 'next/cache'
import { createAdminClient } from '@/utils/supabase/admin'

/**
 * Cache de Procedimentos (SIGTAP)
 * Revalida a cada 1 hora ou sob demanda via tag 'procedimentos'
 */
export const getCachedProcedimentos = unstable_cache(
  async () => {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('procedimentos')
      .select('cod_sigtap, desc_sigtap, grupo_descricao')
      .order('desc_sigtap')
      .limit(3000)

    if (error) {
      console.error('[cached-data] Erro ao carregar procedimentos:', error.message)
      return []
    }
    return data || []
  },
  ['cached-procedimentos'],
  { revalidate: 3600, tags: ['procedimentos'] }
)

/**
 * Cache de Municípios
 * Revalida a cada 24 horas
 */
export const getCachedMunicipios = unstable_cache(
  async () => {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('municipios')
      .select('codigo_ibge, nome')
      .order('nome')
      .limit(2000)

    if (error) {
      console.error('[cached-data] Erro ao carregar municípios:', error.message)
      return []
    }
    return data || []
  },
  ['cached-municipios'],
  { revalidate: 86400, tags: ['municipios'] }
)

/**
 * Cache de Unidades Solicitantes
 * Revalida a cada 1 hora
 */
export const getCachedUnidades = unstable_cache(
  async () => {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('unidades_solicitantes')
      .select('cnes, nome')
      .order('nome')
      .limit(2000)

    if (error) {
      console.error('[cached-data] Erro ao carregar unidades:', error.message)
      return []
    }
    return data || []
  },
  ['cached-unidades'],
  { revalidate: 3600, tags: ['unidades'] }
)

/**
 * Cache de Especialidades Médicas
 * Revalida a cada 1 hora
 */
export const getCachedEspecialidades = unstable_cache(
  async () => {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('especialidades')
      .select('nome')
      .eq('active', true)
      .limit(2000)

    if (error) {
      console.error('[cached-data] Erro ao carregar especialidades:', error.message)
      return []
    }
    return (data || []).map(e => e.nome?.trim()).filter(Boolean) as string[]
  },
  ['cached-especialidades'],
  { revalidate: 3600, tags: ['especialidades'] }
)

/**
 * Cache de Status Internos da Fila
 * Revalida a cada 30 minutos ou sob alteração
 */
export const getCachedStatusList = unstable_cache(
  async () => {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('status_solicitacao')
      .select('*')
      .order('ordem', { ascending: true })

    if (error) {
      console.error('[cached-data] Erro ao carregar status:', error.message)
      return []
    }
    return data || []
  },
  ['cached-status-list'],
  { revalidate: 1800, tags: ['status_solicitacao'] }
)

/**
 * Cache de Parâmetros e Configurações Gerais
 */
export const getCachedConfigGeral = unstable_cache(
  async () => {
    const supabase = createAdminClient()
    const { data } = await supabase
      .from('configuracoes')
      .select('valor')
      .eq('chave', 'geral')
      .maybeSingle()

    return data?.valor || null
  },
  ['cached-config-geral'],
  { revalidate: 1800, tags: ['configuracoes'] }
)
