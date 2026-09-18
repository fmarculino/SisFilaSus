import { createEsusDbPool, extractCidadaosFromEsusDb, testEsusDbConnection } from '../src/lib/esus-db-extractor.ts'
import { processEsusCidadaosBatch } from '../src/lib/esus-importer.ts'

async function runDirectSync() {
  const args = process.argv.slice(2)
  const isAll = args.includes('--all')
  const daysArg = args.find(a => a.startsWith('--days='))
  const days = daysArg ? parseInt(daysArg.split('=')[1], 10) : (isAll ? undefined : 30)
  const batchSize = 500

  console.log('===============================================================')
  console.log('🏛️  SisFilaSUS - Sincronização Direta com o Banco e-SUS PEC')
  console.log('===============================================================')
  console.log(`📡 Servidor e-SUS: ${process.env.ESUS_DB_HOST || '10.110.2.8'}:${process.env.ESUS_DB_PORT || '5433'}`)
  console.log(`👤 Usuário de Leitura: ${process.env.ESUS_DB_USER || 'esus_leitura'}`)
  console.log(`🎯 Modo: ${isAll ? 'Base Completa (Todos os cidadãos)' : `Cidadãos atualizados nos últimos ${days} dias`}`)
  console.log(`📦 Tamanho do lote: ${batchSize} registros`)
  console.log('---------------------------------------------------------------\n')

  // 1. Testar conexão
  console.log('⏳ Testando conexão com o banco e-SUS...')
  const testConn = await testEsusDbConnection()
  if (!testConn.ok) {
    console.error(`❌ Falha ao conectar no banco do e-SUS: ${testConn.erro}`)
    console.error('Verifique se as variáveis de conexão estão corretas no .env.local e se o computador está na rede local da SMS.')
    process.exit(1)
  }

  console.log(`✅ Conexão estabelecida com sucesso! (${testConn.versao?.split(',')[0]})`)
  console.log(`📊 Total de cidadãos ativos na base do e-SUS: ${testConn.totalCidadaos?.toLocaleString('pt-BR')}\n`)

  const pool = createEsusDbPool()
  const startTime = Date.now()

  let offset = 0
  let totalProcessados = 0
  let totalSalvosEsus = 0
  let totalPacientesEnriquecidos = 0
  let totalTelefonesAdicionados = 0
  let totalEnderecosAtualizados = 0
  let totalUnidadesVinculadas = 0
  let batchIndex = 1

  try {
    while (true) {
      const t0 = Date.now()
      const cidadaosChunk = await extractCidadaosFromEsusDb(pool, {
        diasRecentes: days,
        limite: batchSize,
        offset: offset
      })

      if (cidadaosChunk.length === 0) {
        if (offset === 0) {
          console.log(`ℹ️  Nenhum cidadão encontrado com atualização nos últimos ${days} dias.`)
          console.log(`💡 Dica: Para sincronizar a base completa, utilize o parâmetro: npm run sync:esus -- --all`)
        }
        break
      }

      const batchLabel = `e-SUS PEC DB - Lote ${batchIndex} (${offset + 1} a ${offset + cidadaosChunk.length})`
      process.stdout.write(`⏳ [Lote ${batchIndex}] Processando ${cidadaosChunk.length} cidadãos... `)

      const stats = await processEsusCidadaosBatch(
        cidadaosChunk,
        batchLabel
      )

      const elapsed = ((Date.now() - t0) / 1000).toFixed(1)

      totalProcessados += cidadaosChunk.length
      totalSalvosEsus += stats.totalSalvoEsusBase
      totalPacientesEnriquecidos += stats.totalPacientesSisFilaEncontrados
      totalTelefonesAdicionados += stats.totalTelefonesAdicionados
      totalEnderecosAtualizados += stats.totalEnderecosAtualizados
      totalUnidadesVinculadas += stats.totalUnidadesVinculadas

      console.log(`✅ Concluído em ${elapsed}s | 🎯 SisFila: +${stats.totalPacientesSisFilaEncontrados} | 📞 +${stats.totalTelefonesAdicionados} tels`)

      offset += cidadaosChunk.length
      batchIndex++

      // Se o chunk retornado for menor que o lote, chegamos ao final
      if (cidadaosChunk.length < batchSize) {
        break
      }
    }
  } catch (err) {
    console.error('\n❌ Erro durante a sincronização:', err)
  } finally {
    await pool.end().catch(() => {})
  }

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1)

  console.log('\n===============================================================')
  console.log('📊 CONSOLIDAÇÃO GERAL DA SINCRONIZAÇÃO e-SUS PEC')
  console.log('===============================================================')
  console.log(`   • Tempo total decorrido: ${totalTime}s`)
  console.log(`   • Cidadãos lidos do e-SUS: ${totalProcessados.toLocaleString('pt-BR')}`)
  console.log(`   • Base Territorial (esus_cadastros): ${totalSalvosEsus.toLocaleString('pt-BR')} registros sincronizados`)
  console.log(`   • Pacientes da Fila SisFilaSUS Enriquecidos: ${totalPacientesEnriquecidos.toLocaleString('pt-BR')}`)
  console.log(`   • Novos Telefones Inseridos (sem duplicatas): ${totalTelefonesAdicionados.toLocaleString('pt-BR')}`)
  console.log(`   • Endereços Atualizados: ${totalEnderecosAtualizados.toLocaleString('pt-BR')}`)
  console.log(`   • Unidades de Referência Vinculadas: ${totalUnidadesVinculadas.toLocaleString('pt-BR')}`)
  console.log('===============================================================\n')
}

runDirectSync().catch(console.error)
