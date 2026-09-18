import pg from 'pg'
import { EsusCidadaoParsed, EsusTelefone, sanitizePhoneNumber } from './esus-parser'

const { Pool } = pg

export interface EsusDbConfig {
  host?: string
  port?: number
  database?: string
  user?: string
  password?: string
  connectionTimeoutMillis?: number
}

/**
 * Cria pool de conexão seguro para leitura do e-SUS PEC
 */
export function createEsusDbPool(config?: EsusDbConfig) {
  const host = config?.host || process.env.ESUS_DB_HOST || '10.110.2.8'
  const port = config?.port || parseInt(process.env.ESUS_DB_PORT || '5433', 10)
  const database = config?.database || process.env.ESUS_DB_NAME || 'esus'
  const user = config?.user || process.env.ESUS_DB_USER || 'esus_leitura'
  const password = config?.password || process.env.ESUS_DB_PASSWORD

  if (!password) {
    throw new Error(
      'A senha do banco e-SUS não foi fornecida. Configure a variável de ambiente ESUS_DB_PASSWORD no seu .env.local.'
    )
  }

  return new Pool({
    host,
    port,
    database,
    user,
    password,
    max: 5,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: config?.connectionTimeoutMillis || 5000,
  })
}

/**
 * Testa conexão rápida com o banco e-SUS
 */
export async function testEsusDbConnection(config?: EsusDbConfig): Promise<{
  ok: boolean
  versao?: string
  totalCidadaos?: number
  erro?: string
}> {
  let pool: pg.Pool | null = null
  try {
    pool = createEsusDbPool(config)
    const client = await pool.connect()
    try {
      const verRes = await client.query('SELECT version();')
      const countRes = await client.query('SELECT count(*) FROM tb_cidadao WHERE st_ativo = 1;')
      return {
        ok: true,
        versao: verRes.rows[0]?.version,
        totalCidadaos: parseInt(countRes.rows[0]?.count || '0', 10)
      }
    } finally {
      client.release()
    }
  } catch (err: any) {
    return {
      ok: false,
      erro: err.message || 'Falha desconhecida ao conectar ao banco e-SUS'
    }
  } finally {
    if (pool) await pool.end().catch(() => {})
  }
}

/**
 * Opções para extração de dados
 */
export interface ExtractOptions {
  diasRecentes?: number // Se informado, filtra apenas atualizados nos últimos X dias
  limite?: number
  offset?: number
}

/**
 * Converte data de objeto Date ou string para formato YYYY-MM-DD
 */
function formatDateISO(val: any): string | null {
  if (!val) return null
  if (val instanceof Date) {
    return val.toISOString().split('T')[0]
  }
  const str = String(val).trim()
  if (str.includes('T')) return str.split('T')[0]
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str
  return null
}

/**
 * Extrai cidadãos ativos do e-SUS PEC diretamente do banco PostgreSQL
 */
export async function extractCidadaosFromEsusDb(
  pool: pg.Pool,
  options?: ExtractOptions
): Promise<EsusCidadaoParsed[]> {
  const client = await pool.connect()

  try {
    let whereClause = `WHERE c.st_ativo = 1 AND (c.nu_cpf IS NOT NULL OR c.nu_cns IS NOT NULL)`
    const params: any[] = []

    if (options?.diasRecentes && options.diasRecentes > 0) {
      params.push(options.diasRecentes)
      whereClause += ` AND (c.dt_atualizado >= NOW() - ($${params.length} || ' days')::interval)`
    }

    let limitClause = ''
    if (options?.limite && options.limite > 0) {
      params.push(options.limite)
      limitClause += ` LIMIT $${params.length}`
    }
    if (options?.offset && options.offset > 0) {
      params.push(options.offset)
      limitClause += ` OFFSET $${params.length}`
    }

    const query = `
      SELECT 
        c.co_seq_cidadao,
        c.no_cidadao,
        c.nu_cpf,
        c.nu_cns,
        c.dt_nascimento,
        c.no_sexo,
        c.nu_micro_area,
        c.ds_logradouro,
        c.nu_numero,
        c.st_sem_numero,
        c.ds_complemento,
        c.no_bairro,
        c.ds_cep,
        c.nu_telefone_celular,
        c.nu_telefone_contato,
        c.nu_telefone_residencial,
        c.dt_atualizado,
        u.nu_cnes,
        u.no_unidade_saude,
        e.nu_ine,
        e.no_equipe
      FROM tb_cidadao c
      LEFT JOIN tb_fat_cidadao_pec f ON f.co_cidadao = c.co_seq_cidadao
      LEFT JOIN tb_dim_unidade_saude u ON u.co_seq_dim_unidade_saude = f.co_dim_unidade_saude_vinc
      LEFT JOIN tb_dim_equipe e ON e.co_seq_dim_equipe = f.co_dim_equipe_vinc
      ${whereClause}
      ORDER BY c.dt_atualizado DESC NULLS LAST
      ${limitClause};
    `

    const res = await client.query(query, params)
    const cidadaos: EsusCidadaoParsed[] = []

    for (const r of res.rows) {
      // Normalização de CPF
      let cpf: string | null = null
      if (r.nu_cpf) {
        const digits = r.nu_cpf.replace(/\D/g, '')
        if (digits.length > 0 && digits.length <= 11) {
          cpf = digits.padStart(11, '0')
        }
      }

      // Normalização de CNS
      let cns: string | null = null
      if (r.nu_cns) {
        const digits = r.nu_cns.replace(/\D/g, '')
        if (digits.length === 15) {
          cns = digits
        }
      }

      // Deve ter ao menos um documento de identificação
      if (!cpf && !cns) continue

      // Formatação de Endereço
      const addressParts: string[] = []
      if (r.ds_logradouro && r.ds_logradouro.trim()) {
        let logr = r.ds_logradouro.trim()
        if (r.nu_numero && r.nu_numero.trim()) {
          logr += `, ${r.nu_numero.trim()}`
        } else if (r.st_sem_numero === 1) {
          logr += ', S/N'
        }
        if (r.ds_complemento && r.ds_complemento.trim()) {
          logr += ` (${r.ds_complemento.trim()})`
        }
        addressParts.push(logr)
      }
      if (r.no_bairro && r.no_bairro.trim()) {
        addressParts.push(r.no_bairro.trim())
      }
      if (r.ds_cep && r.ds_cep.trim()) {
        const cepDigits = r.ds_cep.replace(/\D/g, '')
        if (cepDigits.length === 8) {
          addressParts.push(`CEP: ${cepDigits.substring(0, 5)}-${cepDigits.substring(5)}`)
        }
      }
      const endereco = addressParts.length > 0 ? addressParts.join(' - ') : null

      // Extração e desduplicação de telefones
      const rawPhones: { raw: string; tipo: 'CELULAR_WHATSAPP' | 'FIXO' | 'RECADO' }[] = []
      if (r.nu_telefone_celular) rawPhones.push({ raw: r.nu_telefone_celular, tipo: 'CELULAR_WHATSAPP' })
      if (r.nu_telefone_contato) rawPhones.push({ raw: r.nu_telefone_contato, tipo: 'RECADO' })
      if (r.nu_telefone_residencial) rawPhones.push({ raw: r.nu_telefone_residencial, tipo: 'FIXO' })

      const telefones: EsusTelefone[] = []
      for (const item of rawPhones) {
        const clean = sanitizePhoneNumber(item.raw)
        if (clean && !telefones.some(t => t.numero === clean)) {
          telefones.push({
            numero: clean,
            tipo: item.tipo
          })
        }
      }

      // Equipe e UBS
      const equipeNome = (r.no_equipe && r.no_equipe !== 'SEM EQUIPE') ? r.no_equipe.trim() : null
      const equipeIne = (r.nu_ine && r.nu_ine !== '-') ? r.nu_ine.trim() : null
      const unidadeCnes = r.nu_cnes && r.nu_cnes.trim() ? r.nu_cnes.trim() : null
      const unidadeNome = r.no_unidade_saude && r.no_unidade_saude.trim() ? r.no_unidade_saude.trim() : null
      const microarea = r.nu_micro_area && r.nu_micro_area.trim() ? r.nu_micro_area.trim() : null

      cidadaos.push({
        cpf,
        cns,
        nome: (r.no_cidadao || 'NÃO INFORMADO').trim().toUpperCase(),
        dataNascimento: formatDateISO(r.dt_nascimento),
        sexo: r.no_sexo ? r.no_sexo.trim().toUpperCase() : null,
        endereco,
        equipeNome,
        equipeIne,
        microarea,
        telefones,
        dataAtualizacaoEsus: formatDateISO(r.dt_atualizado),
        unidadeCnes,
        unidadeNome
      })
    }

    return cidadaos
  } finally {
    client.release()
  }
}
