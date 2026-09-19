import { NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * Baixa o executável `SisFilaSusAgent.exe` puro diretamente do servidor.
 * Usado pelo mecanismo de auto-atualização do agente Windows.
 */
export async function GET() {
  const possiblePaths = [
    path.join(process.cwd(), 'apps', 'sisfilasus-agent', 'dist', 'SisFilaSusAgent.exe'),
    path.join(process.cwd(), 'apps', 'sisfilasus-agent', 'SisFilaSusAgent.exe'),
  ]

  let binario: Buffer | null = null
  for (const exePath of possiblePaths) {
    if (existsSync(exePath)) {
      try {
        binario = await readFile(exePath)
        break
      } catch (err) {
        console.error('Erro ao ler binário do agente:', err)
      }
    }
  }

  if (!binario) {
    return NextResponse.json(
      { error: 'Binário do SisFilaSUS Agente não encontrado no servidor.' },
      { status: 404 }
    )
  }

  return new NextResponse(new Uint8Array(binario), {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': 'attachment; filename="SisFilaSusAgent.exe"',
      'Content-Length': String(binario.length),
      'Cache-Control': 'no-store, max-age=0',
    },
  })
}
