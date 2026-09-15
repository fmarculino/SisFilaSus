/**
 * Utilitários centralizados para telefonia brasileira (SisFilaSUS)
 * Lida com DDD, 9º dígito em celulares, telefones fixos e detecção de duplicatas.
 */

/**
 * Limpa e normaliza um número de telefone brasileiro.
 * - Remove caracteres não numéricos.
 * - Se tiver 10 dígitos (DDD + 8 dígitos) e for celular (primeiro dígito do corpo é 6, 7, 8 ou 9),
 *   adiciona o '9' obrigatório do padrão Anatel, totalizando 11 dígitos.
 * - Se for fixo (primeiro dígito 2, 3, 4, 5), mantém 10 dígitos.
 */
export function normalizeTelefone(raw: string | null | undefined): string {
  if (!raw) return ''
  const digits = raw.replace(/\D/g, '')

  // Se tem 10 dígitos (ex: 9491461585 ou 9488179041)
  if (digits.length === 10) {
    const ddd = digits.substring(0, 2)
    const body = digits.substring(2)
    const firstDigit = body[0]
    // Celulares no Brasil iniciam com 6, 7, 8 ou 9
    if (['6', '7', '8', '9'].includes(firstDigit)) {
      return `${ddd}9${body}`
    }
  }

  return digits
}

/**
 * Formata um número de telefone com máscara brasileira.
 * - 10 dígitos (Fixo ou legado): (XX) XXXX-XXXX
 * - 11 dígitos (Celular com 9º dígito): (XX) XXXXX-XXXX
 */
export function formatPhoneNumber(value: string | null | undefined): string {
  if (!value) return ''
  const clean = value.replace(/\D/g, '').substring(0, 11)
  if (clean.length <= 2) return clean
  if (clean.length <= 6) return `(${clean.substring(0, 2)}) ${clean.substring(2)}`

  // Fixo (10 dígitos): (XX) XXXX-XXXX
  if (clean.length === 10) {
    return `(${clean.substring(0, 2)}) ${clean.substring(2, 6)}-${clean.substring(6)}`
  }

  // Celular (11 dígitos): (XX) XXXXX-XXXX
  if (clean.length === 11) {
    return `(${clean.substring(0, 2)}) ${clean.substring(2, 7)}-${clean.substring(7)}`
  }

  // Intermediário (7 a 9 dígitos)
  return `(${clean.substring(0, 2)}) ${clean.substring(2, 6)}-${clean.substring(6)}`
}

/**
 * Compara dois telefones e determina se representam o mesmo contato.
 * Considera:
 * 1. Igualdade direta após limpeza de caracteres.
 * 2. Igualdade após normalização do 9º dígito de celular (ex: 9491461585 === 94991461585).
 * 3. Truncamento de 10 vs 11 dígitos com mesmo prefixo (ex: 9499155877 vs 94991558777).
 * 4. Mesmos 8 dígitos finais para o mesmo paciente (ex: DDD com erro de digitação ou divergência 94 vs 99).
 */
export function arePhoneNumbersEqual(num1: string | null | undefined, num2: string | null | undefined): boolean {
  if (!num1 || !num2) return false
  const d1 = num1.replace(/\D/g, '')
  const d2 = num2.replace(/\D/g, '')
  if (!d1 || !d2) return false
  if (d1 === d2) return true

  const n1 = normalizeTelefone(d1)
  const n2 = normalizeTelefone(d2)
  if (n1 === n2) return true

  // Truncado por limite de coluna legado (10 dígitos sendo prefixo exato de 11 dígitos)
  if (d1.length === 10 && d2.length === 11 && d2.startsWith(d1)) return true
  if (d2.length === 10 && d1.length === 11 && d1.startsWith(d2)) return true

  // Mesmos 8 dígitos finais (número local sem DDD)
  if (d1.length >= 8 && d2.length >= 8 && d1.slice(-8) === d2.slice(-8)) return true

  return false
}

/**
 * Verifica se um telefone já existe em uma coleção de números conhecidos de um paciente.
 */
export function isPhoneInList(candidate: string, existingList: Iterable<string>): boolean {
  for (const item of existingList) {
    if (arePhoneNumbersEqual(candidate, item)) {
      return true
    }
  }
  return false
}

/**
 * Deduplica uma lista de telefones mantendo a melhor versão de cada número:
 * - Prefere 11 dígitos completos a 10 dígitos truncados
 * - Prefere prioridade menor (0 = principal)
 * - Prefere registros com observações preenchidas
 */
export function deduplicatePhonesList<T extends { numero: string; prioridade?: number; observacoes?: string | null }>(
  phones: T[]
): { kept: T[]; removed: T[] } {
  const sorted = [...phones].sort((a, b) => {
    const dA = (a.numero || '').replace(/\D/g, '')
    const dB = (b.numero || '').replace(/\D/g, '')
    // Preferir 11 dígitos completos
    if (dA.length !== dB.length) return dB.length - dA.length
    // Preferir prioridade 0 (principal)
    const prioA = a.prioridade ?? 999
    const prioB = b.prioridade ?? 999
    if (prioA !== prioB) return prioA - prioB
    // Preferir quem tem observações
    const obsA = (a.observacoes || '').length
    const obsB = (b.observacoes || '').length
    return obsB - obsA
  })

  const kept: T[] = []
  const removed: T[] = []

  for (const item of sorted) {
    const isDup = kept.some(k => arePhoneNumbersEqual(k.numero, item.numero))
    if (isDup) {
      removed.push(item)
    } else {
      kept.push(item)
    }
  }

  // Reindexar prioridades sequencialmente (0, 1, 2...)
  const reindexed = kept.map((item, idx) => ({
    ...item,
    prioridade: idx,
    numero: normalizeTelefone(item.numero)
  }))

  return { kept: reindexed, removed }
}
