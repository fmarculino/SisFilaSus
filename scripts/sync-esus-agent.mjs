import os from 'os'
import { createAdminClient } from '../src/utils/supabase/admin.ts'
import { createEsusDbPool, extractCidadaosFromEsusDb, testEsusDbConnection } from '../src/lib/esus-db-extractor.ts'
import { processEsusCidadaosBatch } from '../src/lib/esus-importer.ts'

const POLL_INTERVAL_MS = 5000 // Verifica a cada 5 segundos
const AGENT_ID = `SMS-AGENT-${os.hostname()}`

async function runAgent() {
  console.log('===============================================================')
  console.log('🤖  SisFilaSUS - Agente Ouvinte de Sincronização e-SUS PEC')
  console.log('===============================================================')
  console.log(`🆔 Identificador do Agente: ${AGENT_ID}`)
  console.log(`📡 Servidor e-SUS Local: ${process.env.ESUS_DB_HOST || '10.110.2.8'}:${process.env.ESUS_DB_PORT || '5433'}`)
  console.log(`⏳ Aguardando solicitações vindas do sistema SisFilaSUS...`)
  console.log('---------------------------------------------------------------\n')

  const supabase = createAdminClient()

  // Teste inicial da conexão com o e-SUS
  const testConn = await testEsusDbConnection()
  if (!testConn.ok) {
    console.warn(`⚠️  Atenção: Teste inicial com o banco e-SUS falhou: ${testConn.erro}`)
    console.warn('O agente continuará rodando, mas certifique-se de que o PostgreSQL do e-SUS está ativo.')
  } else {
    console.log(`✅ Banco e-SUS conectado e pronto! (${testConn.totalCidadaos?.toLocaleString('pt-BR')} cidadãos disponíveis)\n`)
  }

  while (true) {
    try {
      // Buscar job pendente mais antigo (FIFO)
      const { data: job, error } = await supabase
        .from('esus_sync_jobs')
        .select('*')
        .eq('status', 'PENDENTE')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()

      if (error) {
        if (!error.message?.includes('schema cache')) {
          console.error('Erro ao consultar fila de jobs:', error.message)
        }
      } else if (job) {
        await processJob(supabase, job)
      }
    } catch (loopErr) {
      console.error('Erro no ciclo do agente:', loopErr.message)
    }

    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS))
  }
}

async function processJob(supabase, job) {
  const isAll = !!job.parametros?.all
  const days = job.parametros?.dias || (isAll ? undefined : 30)
  const batchSize = 500
  const startTime = Date.now()

  console.log(`\n🔔 [NOVO PEDIDO DETECTADO] Job #${job.id.substring(0, 8)}`)
  console.log(`   • Solicitado por: ${job.solicitado_por || 'Operador SisFilaSUS'}`)
  console.log(`   • Modo: ${isAll ? 'Base Completa' : `Últimos ${days} dias`}`)

  // 1. Assumir o job e marcar como PROCESSANDO
  await supabase
    .from('esus_sync_jobs')
    .update({
      status: 'PROCESSANDO',
      started_at: new Date().toISOString(),
      agente_identificador: AGENT_ID,
      mensagem_status: 'Agente conectou no banco e-SUS. Iniciando extração dos dados...'
    })
    .eq('id', job.id)

  const pool = createEsusDbPool()
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
        break
      }

      const batchLabel = `e-SUS PEC DB - Lote ${batchIndex} (${offset + 1} a ${offset + cidadaosChunk.length})`
      process.stdout.write(`   ⏳ [Lote ${batchIndex}] Processando ${cidadaosChunk.length} cidadãos... `)

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

      console.log(`✅ ${elapsed}s | SisFila: +${stats.totalPacientesSisFilaEncontrados} | +${stats.totalTelefonesAdicionados} tels`)

      // Atualizar progresso parcial no job
      await supabase
        .from('esus_sync_jobs')
        .update({
          mensagem_status: `Processados ${totalProcessados.toLocaleString('pt-BR')} cidadãos... (${totalPacientesEnriquecidos} pacientes enriquecidos)`,
          stats: {
            totalLidos: totalProcessados,
            totalSalvosEsus: totalSalvosEsus,
            totalPacientesEnriquecidos: totalPacientesEnriquecidos,
            totalTelefonesAdicionados: totalTelefonesAdicionados,
            totalEnderecosAtualizados: totalEnderecosAtualizados,
            totalUnidadesVinculadas: totalUnidadesVinculadas
          }
        })
        .eq('id', job.id)

      offset += cidadaosChunk.length
      batchIndex++

      if (cidadaosChunk.length < batchSize) {
        break
      }
    }

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1)

    // Marcar job como CONCLUIDO
    await supabase
      .from('esus_sync_jobs')
      .update({
        status: 'CONCLUIDO',
        completed_at: new Date().toISOString(),
        mensagem_status: `Concluído com sucesso em ${totalTime}s!`,
        stats: {
          totalLidos: totalProcessados,
          totalSalvosEsus: totalSalvosEsus,
          totalPacientesEnriquecidos: totalPacientesEnriquecidos,
          totalTelefonesAdicionados: totalTelefonesAdicionados,
          totalEnderecosAtualizados: totalEnderecosAtualizados,
          totalUnidadesVinculadas: totalUnidadesVinculadas,
          tempoDecorrido: totalTime + 's'
        }
      })
      .eq('id', job.id)

    console.log(`🎉 [JOB CONCLUÍDO] #${job.id.substring(0, 8)} em ${totalTime}s`)
    console.log(`   • ${totalProcessados} lidos | ${totalPacientesEnriquecidos} enriquecidos | +${totalTelefonesAdicionados} telefones\n`)
  } catch (err) {
    console.error(`❌ [FALHA NO JOB] #${job.id.substring(0, 8)}:`, err.message)
    await supabase
      .from('esus_sync_jobs')
      .update({
        status: 'ERRO',
        completed_at: new Date().toISOString(),
        mensagem_erro: err.message || 'Falha durante o processamento do lote.',
        mensagem_status: 'Falha durante o processamento.'
      })
      .eq('id', job.id)
  } finally {
    await pool.end().catch(() => {})
  }
}

runAgent().catch(console.error)
