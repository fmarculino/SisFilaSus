import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

// Load .env.local manually
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
    env[key] = value
  }
})

const supabaseUrl = env['NEXT_PUBLIC_SUPABASE_URL']
const serviceRoleKey = env['SUPABASE_SERVICE_ROLE_KEY']

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing env vars')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey)

async function check() {
  console.log('Connecting to:', supabaseUrl)
  
  const tables = [
    'users',
    'pacientes',
    'municipios',
    'unidades_solicitantes',
    'hospitais_prestadores',
    'procedimentos',
    'cids',
    'fila_solicitacoes',
    'importacoes',
    'fila_snapshots',
    'contatos',
    'movimentacoes_fila',
    'audit_log',
    'templates_mensagem',
    'configuracoes'
  ]

  for (const table of tables) {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true })
    if (error) {
      console.log(`Table "${table}": Error: ${error.message}`)
    } else {
      console.log(`Table "${table}": count is ${count}`)
    }
  }
}

check()
