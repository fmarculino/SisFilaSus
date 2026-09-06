import fs from 'fs'
import path from 'path'

const sqlPath = path.resolve(process.cwd(), 'supabase_schema.sql')
const sqlContent = fs.readFileSync(sqlPath, 'utf8')

// Split by lines
const lines = sqlContent.split('\n')

// Remove lines 8 to 31 (indices 7 to 30)
// Line 8 starts with "-- 2. Tabela de Usuários"
// Let's print out the lines we are removing to be absolutely sure
console.log('Removing lines:')
for (let i = 7; i <= 30; i++) {
  console.log(`${i+1}: ${lines[i]}`)
}

// Remove them
lines.splice(7, 24)

const newSqlContent = lines.join('\n')
const destPath = path.resolve(process.cwd(), 'scratch/db_init_rest.sql')
fs.writeFileSync(destPath, newSqlContent, 'utf8')
console.log('Saved to scratch/db_init_rest.sql')
