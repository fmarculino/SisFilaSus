import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const type = requestUrl.searchParams.get('type')
  const next = requestUrl.searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error) {
      if (type === 'recovery') {
        // Redireciona o usuário autenticado para a página de redefinição de senha
        return NextResponse.redirect(`${requestUrl.origin}/auth/update-password`)
      }
      return NextResponse.redirect(`${requestUrl.origin}${next}`)
    }
  }

  // Se houver erro ou token inválido/expirado
  return NextResponse.redirect(`${requestUrl.origin}/login?error=Link de recuperação inválido ou expirado.`)
}
