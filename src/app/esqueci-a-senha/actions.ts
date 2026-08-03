'use server'

import { createClient } from '@/utils/supabase/server'
import { headers } from 'next/headers'

export async function requestPasswordResetAction(email: string) {
  if (!email || !email.trim()) {
    return { success: false, error: 'Por favor, informe seu endereço de e-mail.' }
  }

  const supabase = await createClient()
  
  // Determina a origem para o callback de redirecionamento
  const headersList = await headers()
  const host = headersList.get('host') || 'localhost:3000'
  const protocol = headersList.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https')
  const origin = process.env.NEXT_PUBLIC_SITE_URL || `${protocol}://${host}`

  const redirectTo = `${origin}/auth/callback?type=recovery`

  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo,
  })

  if (error) {
    console.error('Erro no envio de e-mail de recuperação:', error.message)
    return { success: false, error: error.message }
  }

  return { success: true }
}
