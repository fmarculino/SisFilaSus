import { createAdminClient } from '@/utils/supabase/admin'
import { parseEsusCSV, EsusCidadaoParsed } from './esus-parser'

export interface EsusImportStats {
  nomeArquivo: string
  unidadeNome: string | null
  unidadeCnes: string | null
  totalLidoArquivo: number
  totalCidadaosValidos: number
  totalSalvoEsusBase: number
  totalPacientesSisFilaEncontrados: number
  totalPacientesSisFilaIgnorados: number
  totalEnderecosAtualizados: number
  totalTelefonesAdicionados: number
  totalUnidadesVinculadas: number
  dataExportacao: string | null
}

const CHUNK_SIZE = 200 // Seguro contra PostgREST URL length limit

/**
 * Normaliza string para comparação sem acentos e maiúscula
 */
function normalizeString(str: string): string {
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim()
}

/**
 * Tenta localizar o CNES de uma Unidade Solicitante no banco
 */
export async function resolveUnidadeCnes(
  unidadeDetectada: string | null,
  cnesFornecido?: string | null
): Promise<{ cnes: string | null; nome: string | null }> {
  const supabase = createAdminClient()

  if (cnesFornecido) {
    const { data } = await supabase
      .from('unidades_solicitantes')
      .select('cnes, nome')
      .eq('cnes', cnesFornecido)
      .maybeSingle()
    if (data) return { cnes: data.cnes, nome: data.nome }
  }

  if (!unidadeDetectada) return { cnes: null, nome: null }

  const { data: unidades } = await supabase
    .from('unidades_solicitantes')
    .select('cnes, nome')

  if (!unidades || unidades.length === 0) return { cnes: null, nome: null }

  const rawNorm = normalizeString(unidadeDetectada)
  
  // 1. Busca exata
  const exact = unidades.find(u => normalizeString(u.nome) === rawNorm)
  if (exact) return { cnes: exact.cnes, nome: exact.nome }

  // 2. Busca por contenção
  const cleanedSearch = rawNorm
    .replace(/^(UNIDADE DE SAUDE DA FAMILIA|CENTRO DE SAUDE|UBS|POSTO DE SAUDE|USF)\s+/g, '')
    .trim()

  const match = unidades.find(u => {
    const uNorm = normalizeString(u.nome)
    const uClean = uNorm.replace(/^(UNIDADE DE SAUDE DA FAMILIA|CENTRO DE SAUDE|UBS|POSTO DE SAUDE|USF)\s+/g, '').trim()
    if (uClean.includes(cleanedSearch) || cleanedSearch.includes(uClean)) return true

    // Match por palavras-chave relevantes (> 3 caracteres)
    const searchWords = cleanedSearch.split(/\s+/).filter(w => w.length > 3 && !['DE', 'DA', 'DO', 'DOS', 'DAS', 'ALVES'].includes(w))
    const uWords = uClean.split(/\s+/).filter(w => w.length > 3 && !['DE', 'DA', 'DO', 'DOS', 'DAS', 'ALVES'].includes(w))
    if (searchWords.length > 0 && searchWords.every(sw => uWords.includes(sw))) return true

    return false
  })

  if (match) return { cnes: match.cnes, nome: match.nome }

  return { cnes: null, nome: unidadeDetectada }
}

/**
 * Importa um arquivo do e-SUS:
 * 1. Alimenta/Atualiza a base territorial esus_cadastros
 * 2. Enriquece os pacientes existentes no SisFilaSUS (NUNCA insere novos pacientes)
 */
export async function processEsusImport(
  fileContent: string,
  fileName: string,
  cnesManual?: string | null
): Promise<EsusImportStats> {
  const supabase = createAdminClient()

  // 1. Parser do arquivo CSV
  const parsed = parseEsusCSV(fileContent, fileName)
  const { cnes: unidadeCnes, nome: unidadeNome } = await resolveUnidadeCnes(
    parsed.unidadeDetectada,
    cnesManual
  )

  const stats: EsusImportStats = {
    nomeArquivo: fileName,
    unidadeNome: unidadeNome || parsed.unidadeDetectada,
    unidadeCnes,
    totalLidoArquivo: parsed.totalLinhas,
    totalCidadaosValidos: parsed.totalValidos,
    totalSalvoEsusBase: 0,
    totalPacientesSisFilaEncontrados: 0,
    totalPacientesSisFilaIgnorados: 0,
    totalEnderecosAtualizados: 0,
    totalTelefonesAdicionados: 0,
    totalUnidadesVinculadas: 0,
    dataExportacao: parsed.dataExportacao
  }

  if (parsed.cidadaos.length === 0) {
    return stats
  }

  // =========================================================================
  // FASE 1: Gravar/Atualizar na Base Territorial 'esus_cadastros'
  // =========================================================================
  for (let i = 0; i < parsed.cidadaos.length; i += CHUNK_SIZE) {
    const chunk = parsed.cidadaos.slice(i, i + CHUNK_SIZE)
    const chunkCpfs = chunk.map(c => c.cpf).filter(Boolean) as string[]
    const chunkCns = chunk.map(c => c.cns).filter(Boolean) as string[]

    // Buscar existentes no esus_cadastros
    const existingMap = new Map<string, any>()
    if (chunkCpfs.length > 0) {
      const { data: exCpf } = await supabase
        .from('esus_cadastros')
        .select('*')
        .in('cpf', chunkCpfs)
      ;(exCpf || []).forEach(e => {
        if (e.cpf) existingMap.set(e.cpf, e)
      })
    }
    if (chunkCns.length > 0) {
      const { data: exCns } = await supabase
        .from('esus_cadastros')
        .select('*')
        .in('cns', chunkCns)
      ;(exCns || []).forEach(e => {
        if (e.cns) existingMap.set(e.cns, e)
      })
    }

    const toInsert: any[] = []
    const toUpdate: { id: string; payload: any }[] = []

    for (const c of chunk) {
      const existing = (c.cpf && existingMap.get(c.cpf)) || (c.cns && existingMap.get(c.cns))

      if (existing) {
        // Mesclar telefones sem duplicar número
        const existingPhones: any[] = Array.isArray(existing.telefones) ? existing.telefones : []
        const currentNums = new Set(existingPhones.map(t => t.numero))
        const mergedPhones = [...existingPhones]

        for (const t of c.telefones) {
          if (!currentNums.has(t.numero)) {
            mergedPhones.push(t)
            currentNums.add(t.numero)
          }
        }

        toUpdate.push({
          id: existing.id,
          payload: {
            nome: c.nome || existing.nome,
            cpf: c.cpf || existing.cpf,
            cns: c.cns || existing.cns,
            data_nascimento: c.dataNascimento || existing.data_nascimento,
            sexo: c.sexo || existing.sexo,
            endereco: c.endereco || existing.endereco,
            unidade_cnes: unidadeCnes || existing.unidade_cnes,
            equipe_nome: c.equipeNome || existing.equipe_nome,
            equipe_ine: c.equipeIne || existing.equipe_ine,
            microarea: c.microarea || existing.microarea,
            telefones: mergedPhones,
            data_atualizacao_esus: c.dataAtualizacaoEsus || existing.data_atualizacao_esus,
            total_atualizacoes: (existing.total_atualizacoes || 1) + 1,
            updated_at: new Date().toISOString()
          }
        })
      } else {
        toInsert.push({
          cpf: c.cpf,
          cns: c.cns,
          nome: c.nome,
          data_nascimento: c.dataNascimento,
          sexo: c.sexo,
          endereco: c.endereco,
          unidade_cnes: unidadeCnes,
          equipe_nome: c.equipeNome,
          equipe_ine: c.equipeIne,
          microarea: c.microarea,
          telefones: c.telefones,
          data_atualizacao_esus: c.dataAtualizacaoEsus,
          total_atualizacoes: 1
        })
      }
    }

    if (toInsert.length > 0) {
      const { error: insErr } = await supabase
        .from('esus_cadastros')
        .insert(toInsert)
      if (insErr) {
        console.error('Erro ao inserir em esus_cadastros:', insErr.message)
      } else {
        stats.totalSalvoEsusBase += toInsert.length
      }
    }

    for (const item of toUpdate) {
      const { error: updErr } = await supabase
        .from('esus_cadastros')
        .update(item.payload)
        .eq('id', item.id)
      if (updErr) {
        console.error(`Erro ao atualizar esus_cadastros ${item.id}:`, updErr.message)
      } else {
        stats.totalSalvoEsusBase++
      }
    }
  }

  // =========================================================================
  // FASE 2: Enriquecer Pacientes Existentes no SisFilaSUS (REGRA: NUNCA INSERIR)
  // =========================================================================
  const cidadaosPorDoc = new Map<string, EsusCidadaoParsed>()
  parsed.cidadaos.forEach(c => {
    if (c.cpf) cidadaosPorDoc.set(c.cpf, c)
    if (c.cns) cidadaosPorDoc.set(c.cns, c)
  })

  const todosCpfs = parsed.cidadaos.map(c => c.cpf).filter(Boolean) as string[]
  const todosCns = parsed.cidadaos.map(c => c.cns).filter(Boolean) as string[]

  const matchedPacientesMap = new Map<string, any>()

  // Buscar por CPF em blocos seguros
  for (let i = 0; i < todosCpfs.length; i += CHUNK_SIZE) {
    const chunk = todosCpfs.slice(i, i + CHUNK_SIZE)
    const { data, error } = await supabase
      .from('pacientes')
      .select('id, cpf_usuario, cns_usuario, nome_usuario, endereco, unidade_referencia_cnes, telefone_1, telefone_2')
      .in('cpf_usuario', chunk)

    if (error) {
      console.error('Erro ao consultar pacientes por CPF:', error.message)
    } else if (data) {
      data.forEach(p => matchedPacientesMap.set(p.id, p))
    }
  }

  // Buscar por CNS em blocos seguros
  for (let i = 0; i < todosCns.length; i += CHUNK_SIZE) {
    const chunk = todosCns.slice(i, i + CHUNK_SIZE)
    const { data, error } = await supabase
      .from('pacientes')
      .select('id, cpf_usuario, cns_usuario, nome_usuario, endereco, unidade_referencia_cnes, telefone_1, telefone_2')
      .in('cns_usuario', chunk)

    if (error) {
      console.error('Erro ao consultar pacientes por CNS:', error.message)
    } else if (data) {
      data.forEach(p => matchedPacientesMap.set(p.id, p))
    }
  }

  const matchedPacientes = Array.from(matchedPacientesMap.values())
  stats.totalPacientesSisFilaEncontrados = matchedPacientes.length
  stats.totalPacientesSisFilaIgnorados = parsed.cidadaos.length - matchedPacientes.length

  if (matchedPacientes.length === 0) {
    return stats
  }

  // Buscar todos os telefones existentes desses pacientes
  const matchedIds = matchedPacientes.map(p => p.id)
  const existingPhonesByPaciente = new Map<string, Set<string>>()
  matchedPacientes.forEach(p => {
    const set = new Set<string>()
    if (p.telefone_1) set.add(p.telefone_1.replace(/\D/g, ''))
    if (p.telefone_2) set.add(p.telefone_2.replace(/\D/g, ''))
    existingPhonesByPaciente.set(p.id, set)
  })

  for (let i = 0; i < matchedIds.length; i += CHUNK_SIZE) {
    const chunk = matchedIds.slice(i, i + CHUNK_SIZE)
    const { data: phones } = await supabase
      .from('pacientes_telefones')
      .select('paciente_id, numero')
      .in('paciente_id', chunk)

    ;(phones || []).forEach(pt => {
      const clean = pt.numero.replace(/\D/g, '')
      if (clean) {
        let set = existingPhonesByPaciente.get(pt.paciente_id)
        if (!set) {
          set = new Set()
          existingPhonesByPaciente.set(pt.paciente_id, set)
        }
        set.add(clean)
      }
    })
  }

  // Preparar inserção de telefones e atualizações de pacientes
  const newPhonesToInsert: any[] = []

  for (const p of matchedPacientes) {
    const esusData = (p.cpf_usuario && cidadaosPorDoc.get(p.cpf_usuario)) ||
                     (p.cns_usuario && cidadaosPorDoc.get(p.cns_usuario))
    if (!esusData) continue

    const knownNumbers = existingPhonesByPaciente.get(p.id) || new Set<string>()
    const patientNewNumbers: string[] = []

    // Adicionar telefones que ainda não existem
    for (const t of esusData.telefones) {
      if (!knownNumbers.has(t.numero)) {
        knownNumbers.add(t.numero)
        patientNewNumbers.push(t.numero)
        newPhonesToInsert.push({
          paciente_id: p.id,
          numero: t.numero,
          tipo: t.tipo,
          status: 'ATIVO',
          prioridade: knownNumbers.size,
          observacoes: `Importado do e-SUS (${stats.unidadeNome || 'Atenção Primária'})`
        })
        stats.totalTelefonesAdicionados++
      }
    }

    // Atualização de cadastro do paciente
    const updatePayload: any = {
      updated_at: new Date().toISOString()
    }

    // Endereço: se tiver no e-SUS, atualiza
    if (esusData.endereco) {
      updatePayload.endereco = esusData.endereco
      stats.totalEnderecosAtualizados++
    }

    // Unidade de Referência
    if (unidadeCnes) {
      updatePayload.unidade_referencia_cnes = unidadeCnes
      stats.totalUnidadesVinculadas++
    }

    // Equipe e Microárea
    if (esusData.equipeNome) updatePayload.equipe_saude_nome = esusData.equipeNome
    if (esusData.equipeIne) updatePayload.equipe_saude_ine = esusData.equipeIne
    if (esusData.microarea) updatePayload.microarea = esusData.microarea
    if (esusData.dataAtualizacaoEsus) updatePayload.data_atualizacao_esus = esusData.dataAtualizacaoEsus

    // Retrocompatibilidade telefone_1 e telefone_2
    if (!p.telefone_1 && patientNewNumbers.length > 0) {
      updatePayload.telefone_1 = patientNewNumbers[0]
      if (!p.telefone_2 && patientNewNumbers.length > 1) {
        updatePayload.telefone_2 = patientNewNumbers[1]
      }
    } else if (!p.telefone_2 && patientNewNumbers.length > 0) {
      updatePayload.telefone_2 = patientNewNumbers[0]
    }

    // Executar update do paciente
    const { error: updErr } = await supabase
      .from('pacientes')
      .update(updatePayload)
      .eq('id', p.id)

    if (updErr) {
      console.error(`Erro ao atualizar paciente ${p.id}:`, updErr.message)
    }
  }

  // Inserir telefones em lote
  if (newPhonesToInsert.length > 0) {
    for (let i = 0; i < newPhonesToInsert.length; i += CHUNK_SIZE) {
      const chunk = newPhonesToInsert.slice(i, i + CHUNK_SIZE)
      const { error: insertTelErr } = await supabase
        .from('pacientes_telefones')
        .insert(chunk)
      if (insertTelErr) {
        console.error('Erro ao inserir novos telefones:', insertTelErr.message)
      }
    }
  }

  return stats
}

/**
 * Enriquece uma lista de pacientes (por IDs) consultando a base 'esus_cadastros'.
 * Utilizado automaticamente no final das importações do SISREG.
 */
export async function enriquecerPacientesComEsus(
  pacienteIds: string[]
): Promise<{ totalEnriquecidos: number; totalTelefones: number }> {
  if (!pacienteIds || pacienteIds.length === 0) {
    return { totalEnriquecidos: 0, totalTelefones: 0 }
  }

  const supabase = createAdminClient()
  let totalEnriquecidos = 0
  let totalTelefones = 0

  for (let i = 0; i < pacienteIds.length; i += CHUNK_SIZE) {
    const chunkIds = pacienteIds.slice(i, i + CHUNK_SIZE)
    const { data: pacientes } = await supabase
      .from('pacientes')
      .select('id, cpf_usuario, cns_usuario, endereco, unidade_referencia_cnes, telefone_1, telefone_2')
      .in('id', chunkIds)

    if (!pacientes || pacientes.length === 0) continue

    const cpfs = pacientes.map(p => p.cpf_usuario).filter(Boolean) as string[]
    const cnsList = pacientes.map(p => p.cns_usuario).filter(Boolean) as string[]

    const esusMap = new Map<string, any>()
    if (cpfs.length > 0) {
      const { data: esusCpf } = await supabase
        .from('esus_cadastros')
        .select('*')
        .in('cpf', cpfs)
      ;(esusCpf || []).forEach(e => {
        if (e.cpf) esusMap.set(e.cpf, e)
      })
    }
    if (cnsList.length > 0) {
      const { data: esusCns } = await supabase
        .from('esus_cadastros')
        .select('*')
        .in('cns', cnsList)
      ;(esusCns || []).forEach(e => {
        if (e.cns) esusMap.set(e.cns, e)
      })
    }

    if (esusMap.size === 0) continue

    // Buscar telefones existentes
    const { data: existingPhones } = await supabase
      .from('pacientes_telefones')
      .select('paciente_id, numero')
      .in('paciente_id', chunkIds)

    const existingPhonesByPaciente = new Map<string, Set<string>>()
    pacientes.forEach(p => {
      const set = new Set<string>()
      if (p.telefone_1) set.add(p.telefone_1.replace(/\D/g, ''))
      if (p.telefone_2) set.add(p.telefone_2.replace(/\D/g, ''))
      existingPhonesByPaciente.set(p.id, set)
    })
    ;(existingPhones || []).forEach(pt => {
      const clean = pt.numero.replace(/\D/g, '')
      if (clean) {
        existingPhonesByPaciente.get(pt.paciente_id)?.add(clean)
      }
    })

    const newPhonesToInsert: any[] = []

    for (const p of pacientes) {
      const esus = (p.cpf_usuario && esusMap.get(p.cpf_usuario)) ||
                   (p.cns_usuario && esusMap.get(p.cns_usuario))
      if (!esus) continue

      totalEnriquecidos++
      const knownNumbers = existingPhonesByPaciente.get(p.id) || new Set<string>()
      const patientNewNumbers: string[] = []

      // Inserir telefones
      const esusPhones: any[] = Array.isArray(esus.telefones) ? esus.telefones : []
      for (const t of esusPhones) {
        if (t.numero && !knownNumbers.has(t.numero)) {
          knownNumbers.add(t.numero)
          patientNewNumbers.push(t.numero)
          newPhonesToInsert.push({
            paciente_id: p.id,
            numero: t.numero,
            tipo: t.tipo || 'CELULAR_WHATSAPP',
            status: 'ATIVO',
            prioridade: knownNumbers.size,
            observacoes: 'Enriquecimento automático e-SUS'
          })
          totalTelefones++
        }
      }

      // Atualizar paciente
      const updatePayload: any = {
        updated_at: new Date().toISOString()
      }

      if (esus.endereco && (!p.endereco || p.endereco.trim() === '')) {
        updatePayload.endereco = esus.endereco
      }
      if (esus.unidade_cnes && !p.unidade_referencia_cnes) {
        updatePayload.unidade_referencia_cnes = esus.unidade_cnes
      }
      if (esus.equipe_nome) updatePayload.equipe_saude_nome = esus.equipe_nome
      if (esus.equipe_ine) updatePayload.equipe_saude_ine = esus.equipe_ine
      if (esus.microarea) updatePayload.microarea = esus.microarea
      if (esus.data_atualizacao_esus) updatePayload.data_atualizacao_esus = esus.data_atualizacao_esus

      if (!p.telefone_1 && patientNewNumbers.length > 0) {
        updatePayload.telefone_1 = patientNewNumbers[0]
      }
      if (!p.telefone_2 && patientNewNumbers.length > 1) {
        updatePayload.telefone_2 = patientNewNumbers[1]
      }

      await supabase.from('pacientes').update(updatePayload).eq('id', p.id)
    }

    if (newPhonesToInsert.length > 0) {
      await supabase.from('pacientes_telefones').insert(newPhonesToInsert)
    }
  }

  return { totalEnriquecidos, totalTelefones }
}
