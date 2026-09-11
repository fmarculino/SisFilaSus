import fs from 'fs'
import path from 'path'
import { processEsusImport } from '../src/lib/esus-importer.ts'

async function runBatch() {
  const targetDir = process.argv[2] || 'C:\\Users\\Cliente\\Projetos\\dados-pacientes'
  console.log('===============================================================')
  console.log('🚀 SisFilaSUS - Processamento em Lote de Arquivos e-SUS')
  console.log(`📂 Diretório: ${targetDir}`)
  console.log('===============================================================\n')

  if (!fs.existsSync(targetDir)) {
    console.error(`❌ Diretório não encontrado: ${targetDir}`)
    process.exit(1)
  }

  const files = fs.readdirSync(targetDir).filter(f => f.toLowerCase().endsWith('.csv'))

  if (files.length === 0) {
    console.log('Nenhum arquivo CSV localizado no diretório informado.')
    return
  }

  console.log(`Localizados ${files.length} arquivos CSV para processamento.\n`)

  const summary = []
  const startTime = Date.now()

  for (let i = 0; i < files.length; i++) {
    const fileName = files[i]
    const filePath = path.join(targetDir, fileName)
    const stats = fs.statSync(filePath)
    const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2)

    console.log(`---------------------------------------------------------------`)
    console.log(`[${i + 1}/${files.length}] Lendo: ${fileName} (${fileSizeMB} MB)...`)

    try {
      const fileContent = fs.readFileSync(filePath, 'latin1')
      const t0 = Date.now()
      const result = await processEsusImport(fileContent, fileName)
      const elapsedSec = ((Date.now() - t0) / 1000).toFixed(1)

      console.log(`   ✅ Unidade: ${result.unidadeNome || 'Não Identificada'} (CNES: ${result.unidadeCnes || 'N/A'})`)
      console.log(`   📋 Linhas lidas: ${result.totalLidoArquivo} | Válidos: ${result.totalCidadaosValidos}`)
      console.log(`   💾 Salvos na Base Territorial e-SUS: ${result.totalSalvoEsusBase}`)
      console.log(`   🎯 Pacientes SisFilaSUS encontrados: ${result.totalPacientesSisFilaEncontrados} (Ignorados: ${result.totalPacientesSisFilaIgnorados})`)
      console.log(`   📞 Novos telefones inseridos: ${result.totalTelefonesAdicionados}`)
      console.log(`   📍 Endereços atualizados: ${result.totalEnderecosAtualizados}`)
      console.log(`   ⏱️ Tempo: ${elapsedSec}s\n`)

      summary.push({
        arquivo: fileName,
        unidade: result.unidadeNome || 'Desconhecida',
        cnes: result.unidadeCnes || '-',
        salvosEsus: result.totalSalvoEsusBase,
        enriquecidosSisFila: result.totalPacientesSisFilaEncontrados,
        telefones: result.totalTelefonesAdicionados,
        enderecos: result.totalEnderecosAtualizados,
        tempo: elapsedSec + 's'
      })
    } catch (err) {
      console.error(`   ❌ ERRO ao processar ${fileName}:`, err.message)
      summary.push({
        arquivo: fileName,
        unidade: 'ERRO',
        cnes: '-',
        salvosEsus: 0,
        enriquecidosSisFila: 0,
        telefones: 0,
        enderecos: 0,
        tempo: 'FALHA'
      })
    }
  }

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log('===============================================================')
  console.log('📊 CONSOLIDAÇÃO GERAL DA IMPORTAÇÃO EM LOTE')
  console.log('===============================================================')
  console.table(summary)

  const totalSalvos = summary.reduce((acc, s) => acc + (s.salvosEsus || 0), 0)
  const totalEnriquecidos = summary.reduce((acc, s) => acc + (s.enriquecidosSisFila || 0), 0)
  const totalTels = summary.reduce((acc, s) => acc + (s.telefones || 0), 0)
  const totalEnd = summary.reduce((acc, s) => acc + (s.enderecos || 0), 0)

  console.log(`\n🎉 Processamento concluído em ${totalTime}s!`)
  console.log(`   • Total de arquivos processados: ${files.length}`)
  console.log(`   • Cidadãos registrados na Base Territorial e-SUS: ${totalSalvos.toLocaleString('pt-BR')}`)
  console.log(`   • Pacientes da fila regulada SisFilaSUS enriquecidos: ${totalEnriquecidos.toLocaleString('pt-BR')}`)
  console.log(`   • Novos telefones adicionados sem duplicatas: ${totalTels.toLocaleString('pt-BR')}`)
  console.log(`   • Endereços atualizados: ${totalEnd.toLocaleString('pt-BR')}\n`)
}

runBatch().catch(console.error)
