'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { logAudit } from '@/lib/audit'

export async function login(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!email || !password) {
    redirect('/login?error=Preencha todos os campos.')
  }

  const { error, data } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    redirect('/login?error=Credenciais inválidas.')
  }

  const user = data.user

  // Verificar se o usuário está ativo
  const { data: profile } = await supabase
    .from('users')
    .select('role, active')
    .eq('id', user.id)
    .single()

  if (profile) {
    if (profile.active === false) {
      await supabase.auth.signOut()
      redirect('/login?error=Seu usuário está desativado. Entre em contato com a coordenação.')
    }
  }

  // Log de Auditoria
  await logAudit({
    acao: 'LOGIN',
    tabela: 'users',
    registro_id: user.id,
    dados_novos: { email }
  })

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

export async function logout() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (user) {
    // Registrar logout antes de destruir a sessão
    await logAudit({
      acao: 'LOGOUT',
      tabela: 'users',
      registro_id: user.id
    })
  }

  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}
