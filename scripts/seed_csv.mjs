import { parseAndImportCSV } from '../src/lib/import-parser.ts'
import fs from 'fs'
import path from 'path'

// Load environment variables for supabase/admin.ts
const envPath = path.resolve(process.cwd(), '.env.local')
const envContent = fs.readFileSync(envPath, 'utf8')
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/)
  if (match) {
    const key = match[1].trim()
    let value = (match[2] || '').trim()
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.substring(1, value.length - 1)
    }
    process.env[key] = value
  }
})

console.log('NEXT_PUBLIC_SUPABASE_URL:', JSON.stringify(process.env.NEXT_PUBLIC_SUPABASE_URL))
console.log('SUPABASE_SERVICE_ROLE_KEY starts with:', process.env.SUPABASE_SERVICE_ROLE_KEY ? process.env.SUPABASE_SERVICE_ROLE_KEY.substring(0, 10) : 'undefined')

const csvPath = path.resolve(process.cwd(), 'scratch/SISREG_INTERNACAO_SOL_E_150420_2026-06-05_16-14-00.csv')
console.log('Reading CSV from:', csvPath)
const csvContent = fs.readFileSync(csvPath, 'latin1') // SISREG CSV is usually ISO-8859-1 / latin1 encoded

const userId = '40060ee2-0548-43a5-95bb-8de52ea65f29' // Admin user

async function run() {
  console.log('Running parser...')
  try {
    const stats = await parseAndImportCSV(csvContent, 'SISREG_INTERNACAO_SOL_E_150420_2026-06-05_16-14-00.csv', userId)
    console.log('Import successful!')
    console.log(stats)
  } catch (err) {
    console.error('Error importing:', err)
  }
}

run()
