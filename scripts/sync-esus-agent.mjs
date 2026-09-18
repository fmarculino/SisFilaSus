import os from 'os'
import { createAdminClient } from '../src/utils/supabase/admin.ts'
import { 
  createEsusDbPool, 
  extractCidadaosFromEsusDb, 
  countCidadaosInPeriod, 
  testEsusDbConnection 
} from '../src/lib/esus-db-extractor.ts'
import { processEsusCidadaosBatch } from '../src/lib/esus-importer.ts'

const POLL_INTERVAL_MS = 3000 // Checa pedidos a cada 3 segundos
const HEARTBEAT_INTERVAL_MS = 15000 // Heartbeat a cada 15 segundos
const AGENT_ID = `SMS-AGENT-${os.hostname()}`
const AGENT_VERSION = '1.2.0'

async function runAgent() {
  console.log('===============================================================')
  console.log('🤖  SisFilaSUS - Agente Ouvinte de Sincronização e-SUS PEC')
  console.log('===============================================================')
  console.log(`🆔 Identificador do Agente: ${AGENT_ID} (v${AGENT_VERSION})`)
  console.log(`📡 Servidor e-SUS Local: ${process.env.ESUS_DB_HOST || '10.110.2.8'}:${process.env.ESUS_DB_PORT || '5433'}`)
  console.log(`⏳ Aguardando solicitações do SisFilaSUS (Prévia & Sincronização)...`)
  console.log('---------------------------------------------------------------\n')

  const supabase = createAdminClient()

  // Teste inicial da conexão com o e-SUS
  const testConn = await testEsusDbConnection()
  if (!testConn.ok) {
    console.warn(`⚠️  Atenção: Teste inicial com o banco e-SUS falhou: ${testConn.erro}`)
  } else {
    console.log(`✅ Banco e-SUS local conectado e pronto! (${testConn.totalCidadaos?.toLocaleString('pt-BR')} cidadãos ativos)\n`)
  }

  // Loop de Heartbeat em background
  let lastHeartbeat = 0
  const sendHeartbeat = async () => {
    try {
      await supabase
        .from('esus_agentes')
        .upsert({
          identificador: AGENT_ID,
          versao: AGENT_VERSION,
          status: 'ONLINE',
          ultimo_heartbeat: new Date().toISOString(),
          metadados: {
            hostname: os.hostname(),
            platform: os.platform(),
            arch: os.arch(),
            esus_host: process.env.ESUS_DB_HOST || '10.110.2.8'
          },
          updated_at: new Date().toISOString()
        }, { onConflict: 'identificador' })
    } catch (e) {
      // Falha silenciosa de heartbeat
    }
  }

  while (true) {
    try {
      // 1. Enviar heartbeat periódico
      if (Date.now() - lastHeartbeat > HEARTBEAT_INTERVAL_MS) {
        lastHeartbeat = Date.now()
        await sendHeartbeat()
      }

      // 2. Buscar job pendente mais antigo (prioriza PREVIA se houver)
      const { data: job, error } = await supabase
        .from('esus_sync_jobs')
        .select('*')
        .eq('status', 'PENDENTE')
        .order('tipo', { ascending: false }) // PREVIA vem antes de SINCRONIZACAO
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()

      if (error) {
        if (!error.message?.includes('schema cache')) {
          console.error('Erro ao consultar fila de jobs:', error.message)
        }
      } else if (job) {
        if (job.tipo === 'PREVIA') {
          await processPrevia(supabase, job)
        } else {
          await processSyncJob(supabase, job)
        }
      }
    } catch (loopErr) {
      console.error('Erro no ciclo do agente:', loopErr.message)
    }

    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS))
  }
}

/**
 * Processa pedido de PRÉVIA (apenas contagem e estimativa)
 */
async function processPrevia(supabase, job) {
  const isAll = !!job.parametros?.all
  const days = job.parametros?.dias || (isAll ? undefined : 30)

  console.log(`\n🔍 [CALCULANDO PRÉVIA] Job #${job.id.substring(0, 8)}`)
  console.log(`   • Solicitado por: ${job.solicitado_por || 'Operador SisFilaSUS'}`)
  console.log(`   • Período: ${isAll ? 'Base Completa (Todos)' : `Últimos ${days} dias`}`)

  const pool = createEsusDbPool()
  try {
    const totalEstimado = await countCidadaosInPeriod(pool, days)
    const tempoEstimadoSegundos = Math.max(5, Math.ceil(totalEstimado / 80))

    await safeUpdateJob(supabase, job.id, {
      status: 'CONCLUIDO',
      completed_at: new Date().toISOString(),
      total_estimado: totalEstimado,
      tempo_estimado_segundos: tempoEstimadoSegundos,
      mensagem_status: `Prévia calculada: ${totalEstimado.toLocaleString('pt-BR')} cidadãos identificados (~${tempoEstimadoSegundos}s estimados).`
    })

    console.log(`   ✅ Prévia concluída: ${totalEstimado.toLocaleString('pt-BR')} cidadãos (~${tempoEstimadoSegundos}s estimados)\n`)
  } catch (err) {
    console.error(`   ❌ Erro ao calcular prévia:`, err.message)
    await safeUpdateJob(supabase, job.id, {
      status: 'ERRO',
      completed_at: new Date().toISOString(),
      mensagem_erro: err.message,
      mensagem_status: 'Falha ao consultar prévia no e-SUS.'
    })
  } finally {
    await pool.end().catch(() => {})
  }
}

async function safeUpdateJob(supabase, jobId, payload) {
  let toSend = { ...payload }
  let res = await supabase.from('esus_sync_jobs').update(toSend).eq('id', jobId)
  
  if (res.error && res.error.message?.includes('total_processado')) {
    delete toSend.total_processado
    res = await supabase.from('esus_sync_jobs').update(toSend).eq('id', jobId)
  }
  
  if (res.error) {
    console.error(`   ⚠️ Erro ao atualizar status do job ${jobId.substring(0, 8)}:`, res.error.message)
  }
  return res
}

/**
 * Processa a SINCRONIZAÇÃO COMPLETA com barra de progresso em tempo real
 */
async function processSyncJob(supabase, job) {
  const isAll = !!job.parametros?.all
  const days = job.parametros?.dias || (isAll ? undefined : 30)
  const batchSize = 500
  const startTime = Date.now()

  console.log(`\n🚀 [INICIANDO SINCRONIZAÇÃO] Job #${job.id.substring(0, 8)}`)
  console.log(`   • Solicitado por: ${job.solicitado_por || 'Operador SisFilaSUS'}`)
  console.log(`   • Período: ${isAll ? 'Base Completa (Todos)' : `Últimos ${days} dias`}`)

  const pool = createEsusDbPool()

  // 1. Obter total exato antes de começar
  let totalEstimado = job.total_estimado || 0
  if (totalEstimado <= 0) {
    try {
      totalEstimado = await countCidadaosInPeriod(pool, days)
    } catch (e) {
      totalEstimado = 0
    }
  }

  const tempoEstimadoSegundos = Math.max(10, Math.ceil(totalEstimado / 80))

  await safeUpdateJob(supabase, job.id, {
    status: 'PROCESSANDO',
    started_at: new Date().toISOString(),
    agente_identificador: AGENT_ID,
    total_estimado: totalEstimado,
    total_processado: 0,
    progresso_pct: 0,
    tempo_estimado_segundos: tempoEstimadoSegundos,
    tempo_decorrido_segundos: 0,
    mensagem_status: `Conectado ao e-SUS. Extraindo dados (0 de ${totalEstimado.toLocaleString('pt-BR')})...`
  })

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
      const stats = await processEsusCidadaosBatch(cidadaosChunk, batchLabel)

      const elapsedChunk = ((Date.now() - t0) / 1000).toFixed(1)
      totalProcessados += cidadaosChunk.length
      totalSalvosEsus += stats.totalSalvoEsusBase
      totalPacientesEnriquecidos += stats.totalPacientesSisFilaEncontrados
      totalTelefonesAdicionados += stats.totalTelefonesAdicionados
      totalEnderecosAtualizados += stats.totalEnderecosAtualizados
      totalUnidadesVinculadas += stats.totalUnidadesVinculadas

      const progressoPct = totalEstimado > 0 ? Math.min(99, Math.round((totalProcessados / totalEstimado) * 100)) : 50
      const tempoDecorridoSec = Math.round((Date.now() - startTime) / 1000)

      console.log(`   ⏳ [Lote ${batchIndex}] ${totalProcessados}/${totalEstimado} (${progressoPct}%) em ${elapsedChunk}s | SisFila: +${stats.totalPacientesSisFilaEncontrados} | +${stats.totalTelefonesAdicionados} tels`)

      // Atualizar progresso em tempo real no Supabase (alimenta a barra de progresso da web)
      await safeUpdateJob(supabase, job.id, {
        total_processado: totalProcessados,
        progresso_pct: progressoPct,
        tempo_decorrido_segundos: tempoDecorridoSec,
        mensagem_status: `Processando lote ${batchIndex}... (${totalProcessados.toLocaleString('pt-BR')} de ${totalEstimado.toLocaleString('pt-BR')} cidadãos | ${totalPacientesEnriquecidos} pacientes enriquecidos)`,
        stats: {
          totalLidos: totalProcessados,
          totalSalvosEsus: totalSalvosEsus,
          totalPacientesEnriquecidos: totalPacientesEnriquecidos,
          totalTelefonesAdicionados: totalTelefonesAdicionados,
          totalEnderecosAtualizados: totalEnderecosAtualizados,
          totalUnidadesVinculadas: totalUnidadesVinculadas,
          tempoDecorrido: tempoDecorridoSec + 's'
        }
      })

      offset += cidadaosChunk.length
      batchIndex++

      if (cidadaosChunk.length < batchSize) {
        break
      }
    }

    const totalTimeSec = Math.round((Date.now() - startTime) / 1000)

    // Finalizar com 100% de progresso
    await safeUpdateJob(supabase, job.id, {
      status: 'CONCLUIDO',
      completed_at: new Date().toISOString(),
      total_processado: totalProcessados,
      progresso_pct: 100,
      tempo_decorrido_segundos: totalTimeSec,
      mensagem_status: `Sincronização concluída com sucesso em ${totalTimeSec}s!`,
      stats: {
        totalLidos: totalProcessados,
        totalSalvosEsus: totalSalvosEsus,
        totalPacientesEnriquecidos: totalPacientesEnriquecidos,
        totalTelefonesAdicionados: totalTelefonesAdicionados,
        totalEnderecosAtualizados: totalEnderecosAtualizados,
        totalUnidadesVinculadas: totalUnidadesVinculadas,
        tempoDecorrido: totalTimeSec + 's'
      }
    })

    console.log(`🎉 [CONCLUÍDO COM SUCESSO] #${job.id.substring(0, 8)} em ${totalTimeSec}s!`)
    console.log(`   • ${totalProcessados} lidos | ${totalPacientesEnriquecidos} enriquecidos | +${totalTelefonesAdicionados} novos telefones\n`)
  } catch (err) {
    console.error(`❌ [FALHA NO PROCESSAMENTO]:`, err.message)
    await safeUpdateJob(supabase, job.id, {
      status: 'ERRO',
      completed_at: new Date().toISOString(),
      mensagem_erro: err.message || 'Falha durante o processamento do lote.',
      mensagem_status: 'Falha durante a sincronização.'
    })
  } finally {
    await pool.end().catch(() => {})
  }
}

runAgent().catch(console.error)
