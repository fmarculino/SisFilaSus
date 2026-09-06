import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

const envPath = path.resolve(process.cwd(), '.env.local')
const envContent = fs.readFileSync(envPath, 'utf8')
const envVars = {}
for (const line of envContent.split('\n')) {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) continue
  const idx = trimmed.indexOf('=')
  if (idx > 0) {
    const key = trimmed.substring(0, idx).trim()
    const val = trimmed.substring(idx + 1).trim().replace(/^["']|["']$/g, '')
    envVars[key] = val
  }
}

const supabase = createClient(
  envVars['NEXT_PUBLIC_SUPABASE_URL'],
  envVars['SUPABASE_SERVICE_ROLE_KEY']
)

async function main() {
  console.log('=== Todos os valores únicos de tipo_fila na base ===\n')

  const dist = {}
  let from = 0
  const pageSize = 1000

  while (true) {
    const { data, error } = await supabase
      .from('fila_solicitacoes')
      .select('tipo_fila')
      .range(from, from + pageSize - 1)

    if (error) { console.error(error); break }
    if (!data || data.length === 0) break

    for (const r of data) {
      const k = r.tipo_fila === null || r.tipo_fila === undefined ? 'NULL' : String(r.tipo_fila)
      dist[k] = (dist[k] || 0) + 1
    }

    if (data.length < pageSize) break
    from += pageSize
  }

  console.log('Distribuição completa (todos os registros, inclusive inativos):')
  for (const [k, v] of Object.entries(dist).sort((a, b) => {
    const na = a[0] === 'NULL' ? -1 : parseInt(a[0])
    const nb = b[0] === 'NULL' ? -1 : parseInt(b[0])
    return na - nb
  })) {
    console.log(`  tipo_fila=${k}: ${v} registros`)
  }

  console.log('\nTotal de registros varridos:', Object.values(dist).reduce((a, b) => a + b, 0))
}

main().catch(console.error)
