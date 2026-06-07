import { createAdminClient } from '@/utils/supabase/admin'

interface ImportResult {
  nomeArquivo: string
  totalRegistros: number
  registrosNovos: number
  registrosAtualizados: number
  registrosAusentes: number
  dataExportacao: string | null
}

export async function parseAndImportCSV(
  fileContent: string,
  fileName: string,
  userId: string
): Promise<ImportResult> {
  const supabase = createAdminClient()

  // 1. Dividir em linhas
  const lines = fileContent.split(/\r?\n/).filter(line => line.trim().length > 0)
  if (lines.length < 2) {
    throw new Error('O arquivo CSV está vazio ou possui formato inválido.')
  }

  // 2. Tratar cabeçalho (sanitizando duplicatas)
  const headerLine = lines[0]
  const rawHeaders = headerLine.split(';').map(h => h.trim())
  const seenHeaders = new Map<string, number>()
  const sanitizedHeaders = rawHeaders.map(h => {
    const count = seenHeaders.get(h) || 0
    seenHeaders.set(h, count + 1)
    return count > 0 ? `${h}_${count}` : h
  })

  const getColValue = (rowCols: string[], headerName: string): string => {
    const idx = sanitizedHeaders.indexOf(headerName)
    return idx !== -1 && rowCols[idx] ? rowCols[idx].trim() : ''
  }

  // Identificar se é Ambulatorial/Exames (geralmente possui a coluna 'STATUS SOLICITACAO' ou 'EXECUCAO CONFIRMADA')
  const isAmbulatorial = sanitizedHeaders.includes('STATUS SOLICITACAO') || sanitizedHeaders.includes('EXECUCAO CONFIRMADA')

  // Listas para agrupamento em lote (bulk)
  const municipiosMap = new Map<string, any>()
  const unidadesMap = new Map<string, any>()
  const procedimentosMap = new Map<string, any>()
  const cidsMap = new Map<string, any>()
  const pacientesMap = new Map<string, any>()
  const solicitacoesMap = new Map<number, any>()

  let dataExportacaoStr: string | null = null

  // 3. Processar linhas
  for (let i = 1; i < lines.length; i++) {
    const rowCols = lines[i].split(';')
    if (rowCols.length < 5) continue

    // Obter data de exportação da primeira linha de dados
    if (!dataExportacaoStr) {
      const expDate = getColValue(rowCols, 'DATA DE EXPORTACAO')
      if (expDate) dataExportacaoStr = expDate
    }

    // Identificação única da solicitação
    const codSolStr = getColValue(rowCols, 'COD. SOLICITACAO')
    if (!codSolStr) continue
    const cod_solicitacao = parseInt(codSolStr, 10)
    if (isNaN(cod_solicitacao)) continue

    // Município Solicitante / Origem
    let munCode = ''
    let munNome = ''
    let centralReguladoraNome = ''

    if (isAmbulatorial) {
      // Ambulatorial
      munCode = '150420' // Default para Marabá se não mapeado
      munNome = 'MARABA'
      centralReguladoraNome = getColValue(rowCols, 'NOME CNES CENTRAL REGULADORA') || 'CENTRAL DE REGULACAO DE MARABA'
    } else {
      // Internação / Eletivas
      munCode = getColValue(rowCols, 'COD. CENTRAL REGULADORA SOLICITANTE')
      munNome = getColValue(rowCols, 'NOME CENTRAL REGULADORA SOLICITANTE')
      centralReguladoraNome = getColValue(rowCols, 'NOME CENTRAL REGULADORA')
    }

    // Paciente
    const cns_usuario = getColValue(rowCols, 'CNS DO USUARIO')
    if (!cns_usuario) continue // CNS é obrigatório

    const cpf_usuario = getColValue(rowCols, 'CPF DO USUARIO') || null
    const nome_usuario = getColValue(rowCols, 'NOME DO USUARIO')
    const dataNascStr = getColValue(rowCols, 'DATA DE NASCIMENTO DO USUARIO')
    const data_nascimento = dataNascStr ? dataNascStr : null
    const sexo = getColValue(rowCols, 'SEXO DO USUARIO') || null
    const nome_mae = getColValue(rowCols, 'NOME DA MAE DO USUARIO') || null

    pacientesMap.set(cns_usuario, {
      cns_usuario,
      cpf_usuario,
      nome_usuario,
      data_nascimento,
      sexo,
      nome_mae,
      municipio_origem: munNome ? munNome.toUpperCase() : null,
      updated_at: new Date().toISOString()
    })

    if (munCode) {
      municipiosMap.set(munCode, {
        codigo_ibge: munCode,
        nome: munNome,
        central_reguladora_nome: centralReguladoraNome
      })
    }

    // Unidade Solicitante
    const cnesSol = getColValue(rowCols, 'COD. CNES SOLICITANTE')
    const nomeSol = getColValue(rowCols, 'NOME UNIDADE SOLICITANTE')
    if (cnesSol) {
      unidadesMap.set(cnesSol, {
        cnes: cnesSol,
        nome: nomeSol,
        municipio_ibge: munCode || null,
        tipo: nomeSol.toUpperCase().includes('HOSPITAL') ? 'Hospital' : 'UBS'
      })
    }

    // Procedimento (SIGTAP)
    let codSigtap = getColValue(rowCols, 'COD. SIGTAP')
    let descSigtap = getColValue(rowCols, 'DESC. SIGTAP')

    if (!codSigtap) {
      codSigtap = getColValue(rowCols, 'COD. INTERNO DO ITEM DO GRUPO DE PROCEDIMENTOS')
      descSigtap = getColValue(rowCols, 'DESC. INTERNA DO ITEM DO GRUPO DE PROCEDIMENTOS')
    }

    if (codSigtap) {
      const modFilaStr = getColValue(rowCols, 'COD. MODALIDADE FILA')
      const modalidade_fila = modFilaStr ? parseInt(modFilaStr, 10) : null
      
      const grupoCod = getColValue(rowCols, 'COD. INTERNO DO GRUPO DE PROCEDIMENTOS') || null
      const grupoDesc = getColValue(rowCols, 'DESC. INTERNA DO GRUPO DE PROCEDIMENTOS') || null

      procedimentosMap.set(codSigtap, {
        cod_sigtap: codSigtap,
        desc_sigtap: descSigtap || 'PROCEDIMENTO SEM DESCRICAO',
        modalidade_fila,
        grupo_codigo: grupoCod,
        grupo_descricao: grupoDesc
      })
    }

    // CID
    const codCid = getColValue(rowCols, 'COD. CID')
    const descCid = getColValue(rowCols, 'DESC. CID')
    if (codCid) {
      cidsMap.set(codCid, {
        codigo_cid: codCid,
        desc_cid: descCid
      })
    }

    // Dados clínicos da solicitação
    const dataSolStr = getColValue(rowCols, 'DATA/HORA DA SOLICITACAO')
    const data_solicitacao = dataSolStr ? dataSolStr : new Date().toISOString()
    
    const riscoStr = getColValue(rowCols, 'COD. CLASSIFICACAO DE RISCO')
    const classificacao_risco = riscoStr ? parseInt(riscoStr, 10) : 3 // Default Eletivo

    const posFilaStr = getColValue(rowCols, 'POSICAO NA FILA')
    const posicao_fila = posFilaStr ? parseInt(posFilaStr, 10) : null

    const modFilaStr = getColValue(rowCols, 'COD. MODALIDADE FILA')
    const modalidade_fila = modFilaStr ? parseInt(modFilaStr, 10) : null

    const tipoFilaStr = getColValue(rowCols, 'COD. TIPO DE FILA')
    const tipo_fila = tipoFilaStr ? parseInt(tipoFilaStr, 10) : (isAmbulatorial ? 1 : 3)

    const estimativaProcStr = getColValue(rowCols, 'ESTIMATIVA PARA ATENDIMENTO DO PROCEDIMENTO')
    const estimativa_atendimento_proc = estimativaProcStr ? parseInt(estimativaProcStr, 10) : null

    const estimativaPacStr = getColValue(rowCols, 'ESTIM. DE ATENDIMENTO DO PACIENTE')
    const estimativa_atendimento_paciente = estimativaPacStr ? parseInt(estimativaPacStr, 10) : null

    const prodMediaStr = getColValue(rowCols, 'PRODUCAO MEDIA MENSAL DO PROCEDIMENTO')
    const producao_media_mensal = prodMediaStr ? parseInt(prodMediaStr, 10) : null

    // Campos adicionais de Ambulatorial/Regulado
    let data_autorizacao_agendamento: string | null = null
    let data_execucao: string | null = null
    let execucao_confirmada = false
    let status_sisreg: string | null = null
    let chave_confirmacao: string | null = null
    let cnes_executante: string | null = null
    let nome_executante: string | null = null
    let tipo_vaga_solicitada: number | null = null
    let tipo_vaga_consumida: number | null = null

    if (isAmbulatorial) {
      const authDate = getColValue(rowCols, 'DATA/HORA DA AUTORIZACAO/AGENDAMENTO')
      if (authDate && authDate !== 'N/A') data_autorizacao_agendamento = authDate

      const execDate = getColValue(rowCols, 'DATA/HORA DA EXECUCAO DO PROCEDIMENTO')
      if (execDate && execDate !== 'N/A') data_execucao = execDate

      const execConf = getColValue(rowCols, 'EXECUCAO CONFIRMADA')
      execucao_confirmada = execConf === '1'

      status_sisreg = getColValue(rowCols, 'STATUS SOLICITACAO') || null
      chave_confirmacao = getColValue(rowCols, 'CHAVE DE CONFIRMACAO') || null

      cnes_executante = getColValue(rowCols, 'COD. CNES EXECUTANTE') || null
      nome_executante = getColValue(rowCols, 'NOME UNIDADE EXECUTANTE') || null

      const vagaSol = getColValue(rowCols, 'TIPO DE VAGA SOLICITADA')
      if (vagaSol) tipo_vaga_solicitada = parseInt(vagaSol, 10)

      const vagaCons = getColValue(rowCols, 'TIPO DE VAGA CONSUMIDA')
      if (vagaCons) tipo_vaga_consumida = parseInt(vagaCons, 10)
    }

    solicitacoesMap.set(cod_solicitacao, {
      cod_solicitacao,
      cns_usuario, // usado temporariamente para mapear paciente_id
      cod_sigtap: codSigtap,
      codigo_cid: codCid || null,
      cnes_solicitante: cnesSol || null,
      municipio_origem_ibge: munCode || null,
      data_solicitacao,
      classificacao_risco,
      posicao_fila,
      modalidade_fila,
      tipo_fila,
      estimativa_atendimento_proc,
      estimativa_atendimento_paciente,
      producao_media_mensal,
      data_autorizacao_agendamento,
      data_execucao,
      execucao_confirmada,
      chave_confirmacao,
      status_sisreg,
      cnes_executante,
      nome_executante,
      tipo_vaga_solicitada,
      tipo_vaga_consumida,
      status_interno: isAmbulatorial ? 'CONVOCADO_CONFIRMADO' : 'NA_FILA',
      updated_at: new Date().toISOString()
    })
  }

  const solicitacoes = Array.from(solicitacoesMap.values())

  // 4. Salvar dados de apoio (Batch Upserts)
  const municipiosArray = Array.from(municipiosMap.values())
  const unidadesArray = Array.from(unidadesMap.values())
  const procedimentosArray = Array.from(procedimentosMap.values())
  const cidsArray = Array.from(cidsMap.values())
  const pacientesArray = Array.from(pacientesMap.values())

  // Upsert de Municípios
  if (municipiosArray.length > 0) {
    const { error } = await supabase.from('municipios').upsert(municipiosArray, { onConflict: 'codigo_ibge' })
    if (error) throw new Error(`Erro ao salvar municípios: ${error.message}`)
  }

  // Upsert de Unidades Solicitantes
  if (unidadesArray.length > 0) {
    const { error } = await supabase.from('unidades_solicitantes').upsert(unidadesArray, { onConflict: 'cnes' })
    if (error) throw new Error(`Erro ao salvar unidades solicitantes: ${error.message}`)
  }

  // Upsert de Procedimentos
  if (procedimentosArray.length > 0) {
    const { error } = await supabase.from('procedimentos').upsert(procedimentosArray, { onConflict: 'cod_sigtap' })
    if (error) throw new Error(`Erro ao salvar procedimentos: ${error.message}`)
  }

  // Upsert de CIDs
  if (cidsArray.length > 0) {
    const { error } = await supabase.from('cids').upsert(cidsArray, { onConflict: 'codigo_cid' })
    if (error) throw new Error(`Erro ao salvar CIDs: ${error.message}`)
  }

  // Upsert de Pacientes em lotes de 1000
  if (pacientesArray.length > 0) {
    for (let j = 0; j < pacientesArray.length; j += 1000) {
      const chunk = pacientesArray.slice(j, j + 1000)
      const { error } = await supabase.from('pacientes').upsert(chunk, { onConflict: 'cns_usuario' })
      if (error) throw new Error(`Erro ao salvar pacientes: ${error.message}`)
    }
  }

  // 5. Mapear cns_usuario para id (UUID) do Paciente
  const cnsList = Array.from(pacientesMap.keys())
  const patientMap = new Map<string, string>()

  for (let j = 0; j < cnsList.length; j += 100) {
    const chunk = cnsList.slice(j, j + 100)
    const { data, error } = await supabase
      .from('pacientes')
      .select('id, cns_usuario')
      .in('cns_usuario', chunk)
    if (error) throw new Error(`Erro ao mapear IDs de pacientes: ${error.message}`)
    if (data) {
      data.forEach(p => patientMap.set(p.cns_usuario, p.id))
    }
  }

  // 6. Preparar Fila de Solicitações vinculando o paciente_id correto
  const finalSolicitacoes = solicitacoes.map(sol => {
    const paciente_id = patientMap.get(sol.cns_usuario)
    if (!paciente_id) {
      throw new Error(`Integridade quebrada: paciente com CNS ${sol.cns_usuario} não foi encontrado.`)
    }
    const { cns_usuario, ...rest } = sol
    return {
      ...rest,
      paciente_id
    }
  })

  // 7. Obter solicitações antigas antes da importação para calcular novos/atualizados/ausentes
  const codSolsImportados = finalSolicitacoes.map(s => s.cod_solicitacao)

  // Criar o lote de Importação
  const { data: importLote, error: importError } = await supabase
    .from('importacoes')
    .insert({
      nome_arquivo: fileName,
      data_exportacao_sisreg: dataExportacaoStr ? dataExportacaoStr : new Date().toISOString(),
      total_registros: finalSolicitacoes.length,
      importado_por: userId,
      registros_novos: 0,
      registros_atualizados: 0,
      registros_ausentes: 0
    })
    .select()
    .single()

  if (importError || !importLote) {
    throw new Error(`Erro ao registrar lote de importação: ${importError?.message}`)
  }

  // 8. Inserir/Atualizar Fila de Solicitações em lotes de 1000 e contar estatísticas
  let novos = 0
  let atualizados = 0

  for (let j = 0; j < finalSolicitacoes.length; j += 1000) {
    const chunk = finalSolicitacoes.slice(j, j + 1000)
    
    // Vincular o lote de importação a cada registro do chunk
    const chunkWithImportLote = chunk.map(c => ({
      ...c,
      ultima_importacao_id: importLote.id
    }))

    // Obter quais destes já existem no banco
    const idsChunk = chunk.map(c => c.cod_solicitacao)
    const existentesSet = new Set<number>()
    
    for (let k = 0; k < idsChunk.length; k += 100) {
      const subChunk = idsChunk.slice(k, k + 100)
      const { data: existentes } = await supabase
        .from('fila_solicitacoes')
        .select('cod_solicitacao')
        .in('cod_solicitacao', subChunk)
      if (existentes) {
        existentes.forEach(e => existentesSet.add(e.cod_solicitacao))
      }
    }
    
    chunk.forEach(item => {
      if (existentesSet.has(item.cod_solicitacao)) {
        atualizados++
      } else {
        novos++
      }
    })

    const { error } = await supabase.from('fila_solicitacoes').upsert(chunkWithImportLote, { onConflict: 'cod_solicitacao' })
    if (error) throw new Error(`Erro ao salvar solicitações na fila: ${error.message}`)

    // Registrar snapshots de posição para esse lote
    const snapshotsBatch = chunk.map(item => ({
      cod_solicitacao: item.cod_solicitacao,
      importacao_id: importLote.id,
      posicao_fila: item.posicao_fila,
      classificacao_risco: item.classificacao_risco
    }))

    const { error: snapError } = await supabase.from('fila_snapshots').insert(snapshotsBatch)
    if (snapError) console.error(`Aviso: Falha ao inserir snapshots: ${snapError.message}`)
  }

  // 9. Identificar registros ausentes (que estavam ativos antes e não constam no arquivo atual)
  // Como a importação pode ser parcial (por tipo de procedimento ou filtro do SISREG),
  // identificamos registros ausentes baseados nas mesmas especialidades importadas.
  const codProcedimentosImportados = Array.from(procedimentosMap.keys())
  let ausentes = 0

  if (codProcedimentosImportados.length > 0) {
    // Buscar quantidade de solicitações ativas do mesmo tipo que não constam neste lote (apenas nos status de fila e contato iniciais)
    const { count, error: countError } = await supabase
      .from('fila_solicitacoes')
      .select('*', { count: 'exact', head: true })
      .eq('active', true)
      .in('cod_sigtap', codProcedimentosImportados)
      .in('status_interno', ['NA_FILA', 'EM_CONVOCACAO', 'SEM_CONTATO'])
      .or(`ultima_importacao_id.neq.${importLote.id},ultima_importacao_id.is.null`)

    if (countError) console.error('Erro ao contar ausentes:', countError)
    ausentes = count || 0

    if (ausentes > 0) {
      // Marcar status_interno como NÃO ENCONTRADO NO SISREG (mas sem desativar a flag 'active' automaticamente)
      // Apenas para registros que ainda estão no ciclo inicial de fila (NA_FILA, EM_CONVOCACAO, SEM_CONTATO)
      const { error: updateError } = await supabase
        .from('fila_solicitacoes')
        .update({ status_interno: 'NAO_ENCONTRADO_SISREG' })
        .eq('active', true)
        .in('cod_sigtap', codProcedimentosImportados)
        .in('status_interno', ['NA_FILA', 'EM_CONVOCACAO', 'SEM_CONTATO'])
        .or(`ultima_importacao_id.neq.${importLote.id},ultima_importacao_id.is.null`)

      if (updateError) console.error('Erro ao atualizar ausentes:', updateError)
    }
  }

  // 10. Identificar divergências críticas de status (Óbitos, Desistências, Recusas e Internados ativos no SISREG)
  try {
    const { data: divergentes } = await supabase
      .from('fila_solicitacoes')
      .select('cod_solicitacao, status_interno, status_sisreg')
      .eq('ultima_importacao_id', importLote.id)
      .in('status_interno', ['OBITO', 'DESISTENCIA', 'CONVOCADO_RECUSOU', 'INTERNADO'])
      .not('posicao_fila', 'is', null)

    if (divergentes && divergentes.length > 0) {
      const payloadDiv = divergentes.map(d => {
        let tipo = 'DESISTENCIA_ATIVA'
        if (d.status_interno === 'OBITO') {
          tipo = 'OBITO_ATIVO'
        } else if (d.status_interno === 'CONVOCADO_RECUSOU') {
          tipo = 'RECUSA_ATIVA'
        } else if (d.status_interno === 'INTERNADO') {
          tipo = 'INTERNADO_ATIVO'
        }
        return {
          cod_solicitacao: d.cod_solicitacao,
          importacao_id: importLote.id,
          tipo_divergencia: tipo,
          status_sisreg_importado: d.status_sisreg,
          status_interno_local: d.status_interno,
          resolvido: false,
          updated_at: new Date().toISOString()
        }
      })

      const { error: insertDivErr } = await supabase
        .from('divergencias_sisreg')
        .upsert(payloadDiv, { onConflict: 'cod_solicitacao' })

      if (insertDivErr) {
        console.error('Erro ao salvar divergências detectadas:', insertDivErr.message)
      }
    }
  } catch (err: any) {
    console.error('Falha crítica ao detectar divergências:', err.message)
  }

  // Atualizar estatísticas do lote de importação
  await supabase
    .from('importacoes')
    .update({
      registros_novos: novos,
      registros_atualizados: atualizados,
      registros_ausentes: ausentes
    })
    .eq('id', importLote.id)

  return {
    nomeArquivo: fileName,
    totalRegistros: finalSolicitacoes.length,
    registrosNovos: novos,
    registrosAtualizados: atualizados,
    registrosAusentes: ausentes,
    dataExportacao: dataExportacaoStr
  }
}
