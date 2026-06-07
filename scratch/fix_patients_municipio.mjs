import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

// Carregar .env.local manualmente
const envPath = path.resolve(process.cwd(), '.env.local')
const envContent = fs.readFileSync(envPath, 'utf8')
const env = {}
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/)
  if (match) {
    const key = match[1]
    let value = match[2] || ''
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.substring(1, value.length - 1)
    }
    env[key] = value.trim()
  }
})

const supabaseUrl = env['NEXT_PUBLIC_SUPABASE_URL']
const serviceRoleKey = env['SUPABASE_SERVICE_ROLE_KEY']

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Erro: NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausentes no .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey)

async function run() {
  console.log("Iniciando correção de municípios de origem dos pacientes...")
  
  // Buscar todas as solicitações ativas com município e dados do paciente
  const { data, error } = await supabase
    .from('fila_solicitacoes')
    .select(`
      paciente_id,
      municipios (
        nome
      ),
      pacientes (
        id,
        municipio_origem
      )
    `)
  
  if (error) {
    console.error("Erro ao carregar dados:", error)
    return
  }

  console.log(`Carregados ${data?.length || 0} registros de solicitações.`)

  const updatesMap = new Map() // paciente_id -> municipio_nome

  for (const row of data || []) {
    const paciente = row.pacientes
    const municipio = row.municipios
    if (!paciente || !municipio) continue

    const currentMuni = paciente.municipio_origem?.trim().toUpperCase()
    const realMuni = municipio.nome?.trim().toUpperCase()

    if (!realMuni) continue

    // Se o município atual do paciente for nulo, ou for MARABA e o real for outro, precisamos atualizar
    if (!currentMuni || (currentMuni === 'MARABA' && realMuni !== 'MARABA')) {
      updatesMap.set(paciente.id, realMuni)
    }
  }

  console.log(`Encontrados ${updatesMap.size} pacientes que necessitam de atualização.`)

  let updatedCount = 0
  for (const [pacienteId, realMuni] of updatesMap.entries()) {
    const { error: updateErr } = await supabase
      .from('pacientes')
      .update({ municipio_origem: realMuni })
      .eq('id', pacienteId)

    if (updateErr) {
      console.error(`Erro ao atualizar paciente ${pacienteId}:`, updateErr.message)
    } else {
      updatedCount++
      if (updatedCount % 50 === 0) {
        console.log(`Progresso: ${updatedCount} pacientes atualizados...`)
      }
    }
  }

  console.log(`Correção concluída! ${updatedCount} pacientes atualizados com sucesso.`)
}

run()
