import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Middleware: Missing Supabase environment variables')
    return supabaseResponse
  }

  try {
    const supabase = createServerClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
            supabaseResponse = NextResponse.next({
              request,
            })
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            )
          },
        },
      }
    )

    const {
      data: { user },
    } = await supabase.auth.getUser()

    // Rotas públicas que não requerem autenticação
    const publicRoutes = ['/login', '/forgot-password', '/portal-cidadao', '/manifest.json', '/sw.js']
    const authRoutes = ['/auth/callback', '/auth/update-password']
    const isPublicRoute = publicRoutes.some(route => request.nextUrl.pathname.startsWith(route))
    const isAuthRoute = authRoutes.some(route => request.nextUrl.pathname.startsWith(route))

    // --- VERIFICAÇÃO DE STATUS ATIVO (com cache de cookie de 5 min) ---
    const statusCache = request.cookies.get('user-status-verified')
    
    if (user && !statusCache) {
      const { data: profile } = await supabase
        .from('users')
        .select('active, role')
        .eq('id', user.id)
        .single()

      if (profile) {
        let blockMessage = ''
        if (profile.active === false) {
          blockMessage = 'Seu usuário está desativado. Entre em contato com a coordenação.'
        }

        if (blockMessage) {
          await supabase.auth.signOut()
          const url = request.nextUrl.clone()
          url.pathname = '/login'
          url.searchParams.set('error', blockMessage)
          const redirectResponse = NextResponse.redirect(url)
          supabaseResponse.cookies.getAll().forEach(cookie => {
            redirectResponse.cookies.set(cookie.name, cookie.value)
          })
          return redirectResponse
        }

        // Cache da verificação por 5 minutos
        supabaseResponse.cookies.set('user-status-verified', 'true', { maxAge: 300 })
      }
    }
    
    // Redirecionamento se não estiver logado
    if (!user && !isPublicRoute && !isAuthRoute) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }

    // Redirecionamento de usuários logados tentando acessar login/forgot-password para o dashboard
    if (user && isPublicRoute && request.nextUrl.pathname !== '/portal-cidadao') {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }

    // Redirecionamento da raiz para o dashboard se logado, ou para login se deslogado
    if (request.nextUrl.pathname === '/') {
      const url = request.nextUrl.clone()
      url.pathname = user ? '/dashboard' : '/login'
      return NextResponse.redirect(url)
    }
  } catch (error) {
    console.error('Middleware: Error updating session', error)
  }

  return supabaseResponse
}
