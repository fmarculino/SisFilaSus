import { NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { existsSync } from 'fs'
import { createHash } from 'crypto'
import path from 'path'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * Endpoint de consulta de versão e integridade do SisFilaSUS Agente e-SUS PEC.
 * O aplicativo de bandeja consulta periodicamente este endpoint para detectar novas versões
 * e realizar o processo de auto-atualização sem intervenção manual (idêntico ao SisEscala).
 */
export async function GET() {
  const possibleVersionPaths = [
    path.join(process.cwd(), 'apps', 'sisfilasus-agent', 'dist', 'VERSION'),
    path.join(process.cwd(), 'apps', 'sisfilasus-agent', 'VERSION'),
  ]

  let versao = '1.3.0'
  for (const vPath of possibleVersionPaths) {
    if (existsSync(vPath)) {
      try {
        const content = await readFile(vPath, 'utf8')
        versao = content.trim()
        break
      } catch (err) {
        console.error('Erro ao ler arquivo VERSION:', err)
      }
    }
  }

  const possibleExePaths = [
    path.join(process.cwd(), 'apps', 'sisfilasus-agent', 'dist', 'SisFilaSusAgent.exe'),
    path.join(process.cwd(), 'apps', 'sisfilasus-agent', 'SisFilaSusAgent.exe'),
  ]

  let sha256 = ''
  for (const exePath of possibleExePaths) {
    if (existsSync(exePath)) {
      try {
        const binario = await readFile(exePath)
        sha256 = createHash('sha256').update(binario).digest('hex')
        break
      } catch (err) {
        console.error('Erro ao calcular sha256 do SisFilaSusAgent.exe:', err)
      }
    }
  }

  return NextResponse.json(
    {
      versao,
      sha256,
      auto_update: true,
      download_url: '/api/esus-agent/tray-download',
    },
    {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    }
  )
}
