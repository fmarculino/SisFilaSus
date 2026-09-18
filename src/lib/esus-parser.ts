import { normalizeTelefone, arePhoneNumbersEqual } from './phone-utils'

export interface EsusTelefone {
  numero: string
  tipo: 'CELULAR_WHATSAPP' | 'FIXO' | 'RECADO'
}

export interface EsusCidadaoParsed {
  cpf: string | null
  cns: string | null
  nome: string
  dataNascimento: string | null
  sexo: string | null
  endereco: string | null
  equipeNome: string | null
  equipeIne: string | null
  microarea: string | null
  telefones: EsusTelefone[]
  dataAtualizacaoEsus: string | null
  unidadeCnes?: string | null
  unidadeNome?: string | null
}

export interface EsusParseResult {
  unidadeDetectada: string | null
  dataExportacao: string | null
  totalLinhas: number
  totalValidos: number
  cidadaos: EsusCidadaoParsed[]
}

/**
 * Normaliza número de telefone brasileiro (DDD + 8 ou 9 dígitos).
 * Celulares de 10 dígitos são automaticamente promovidos para 11 dígitos com o '9' obrigatório.
 * Rejeita sequências fictícias (ex: 9400000000, 9999999999).
 */
export function sanitizePhoneNumber(raw: string): string | null {
  if (!raw) return null
  const digits = raw.replace(/\D/g, '')
  if (digits.length !== 10 && digits.length !== 11) return null

  // Rejeitar DDD inválido (< 11)
  const ddd = parseInt(digits.substring(0, 2), 10)
  if (ddd < 11 || ddd > 99) return null

  // Rejeitar números onde todos os dígitos do corpo são repetidos (ex: 9400000000 ou 94999999999)
  const body = digits.substring(2)
  if (/^(\d)\1+$/.test(body)) return null

  return normalizeTelefone(digits)
}

/**
 * Converte data em formato DD/MM/YYYY para YYYY-MM-DD
 */
export function parseDateBR(dateStr: string): string | null {
  if (!dateStr || !dateStr.includes('/')) return null
  const parts = dateStr.trim().split('/')
  if (parts.length !== 3) return null
  const [day, month, year] = parts
  if (day.length !== 2 || month.length !== 2 || year.length !== 4) return null
  return `${year}-${month}-${day}`
}

/**
 * Parser de arquivos e-SUS Atenção Primária ("Acompanhamento de cidadãos vinculados")
 */
export function parseEsusCSV(
  fileContent: string,
  fileName: string = ''
): EsusParseResult {
  const lines = fileContent.split(/\r?\n/).filter(line => line.trim().length > 0)
  if (lines.length < 5) {
    throw new Error('O arquivo CSV do e-SUS está vazio ou possui cabeçalho incompleto.')
  }

  // 1. Extrair Unidade de Saúde do Cabeçalho (geralmente Linha 5 / índice 4)
  let unidadeDetectada: string | null = null
  for (let i = 0; i < Math.min(10, lines.length); i++) {
    const l = lines[i]
    if (/UNIDADE DE SA[UÚ]DE/i.test(l)) {
      unidadeDetectada = l.replace(/^UNIDADE DE SA[UÚ]DE\s+/i, '').trim()
      break
    }
  }

  // Se não achou na linha, tenta pelo nome do arquivo
  if (!unidadeDetectada && fileName) {
    const nameMatch = fileName.match(/acompanhamento-cidadaos-vinculados_[\d-]+\s*(.+)\.csv$/i)
    if (nameMatch && nameMatch[1]) {
      unidadeDetectada = nameMatch[1].trim()
    }
  }

  // 2. Extrair Data de Geração (Linha 13 ou similar)
  let dataExportacao: string | null = null
  for (let i = 0; i < Math.min(17, lines.length); i++) {
    const l = lines[i]
    if (l.includes('Gerado em')) {
      const parts = l.split(';')
      const datePart = parts.find(p => /^\d{2}\/\d{2}\/\d{4}$/.test(p.trim()))
      if (datePart) {
        dataExportacao = parseDateBR(datePart.trim())
      }
      break
    }
  }

  // 3. Localizar cabeçalho dos dados
  let headerIndex = -1
  for (let i = 0; i < Math.min(25, lines.length); i++) {
    const l = lines[i]
    if (l.includes('CPF/CNS') && l.includes('Nome equipe')) {
      headerIndex = i
      break
    }
  }

  if (headerIndex === -1) {
    throw new Error('Cabeçalho de dados ("CPF/CNS") não encontrado no arquivo do e-SUS.')
  }

  const cidadaos: EsusCidadaoParsed[] = []

  // 4. Processar linhas de dados
  for (let i = headerIndex + 1; i < lines.length; i++) {
    const row = lines[i]
    const p = row.split(';')
    if (p.length < 6) continue

    const docRaw = (p[4] || '').replace(/\D/g, '')
    let cpf: string | null = null
    let cns: string | null = null

    if (docRaw.length === 11) {
      cpf = docRaw
    } else if (docRaw.length === 15) {
      cns = docRaw
    } else {
      // Sem documento válido de identificação (nem CPF nem CNS)
      continue
    }

    const nome = (p[5] || '').trim().toUpperCase()
    if (!nome) continue

    const equipeNome = p[0] ? p[0].trim().toUpperCase() : null
    const equipeIne = p[1] ? p[1].replace(/\D/g, '') : null
    
    let microarea: string | null = p[2] ? p[2].replace(/["']/g, '').trim() : null
    if (microarea && /n[aã]o informada/i.test(microarea)) {
      microarea = null
    }

    const endereco = p[3] ? p[3].trim() : null
    const sexo = p[7] ? p[7].trim().toUpperCase() : null
    const dataNascimento = parseDateBR(p[9] || '')

    // Telefones
    const telefones: EsusTelefone[] = []
    const cel = sanitizePhoneNumber(p[10] || '')
    const res = sanitizePhoneNumber(p[11] || '')
    const recado = sanitizePhoneNumber(p[12] || '')

    const addIfUnique = (num: string | null, tipo: EsusTelefone['tipo']) => {
      if (!num) return
      const alreadyExists = telefones.some(t => arePhoneNumbersEqual(t.numero, num))
      if (!alreadyExists) {
        telefones.push({ numero: num, tipo })
      }
    }

    addIfUnique(cel, 'CELULAR_WHATSAPP')
    addIfUnique(res, 'FIXO')
    addIfUnique(recado, 'RECADO')

    const dataAtualizacaoEsus = parseDateBR(p[13] || '')

    cidadaos.push({
      cpf,
      cns,
      nome,
      dataNascimento,
      sexo,
      endereco,
      equipeNome,
      equipeIne,
      microarea,
      telefones,
      dataAtualizacaoEsus: dataAtualizacaoEsus || dataExportacao
    })
  }

  return {
    unidadeDetectada,
    dataExportacao,
    totalLinhas: lines.length,
    totalValidos: cidadaos.length,
    cidadaos
  }
}
