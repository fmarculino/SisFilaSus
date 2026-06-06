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
    env[key] = value.trim()
  }
})

const supabaseUrl = env['NEXT_PUBLIC_SUPABASE_URL']
const serviceRoleKey = env['SUPABASE_SERVICE_ROLE_KEY']

const supabase = createClient(supabaseUrl, serviceRoleKey)

async function testSearch() {
  const searchVal = 'fernando marculino'
  console.log('Searching for:', searchVal)

  let query = supabase
    .from('pacientes')
    .select('*', { count: 'exact' })
    .ilike('nome_usuario', `%${searchVal}%`)

  const { data, count, error } = await query

  if (error) {
    console.error('Query Error:', error.message)
  } else {
    console.log('Query success!')
    console.log('Count:', count)
    console.log('Results:', data)
  }
}

testSearch()
