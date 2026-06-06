'use server'

import { createClient } from '@/utils/supabase/server'

export async function updatePasswordAction(password: string) {
  const supabase = await createClient()

  // Verify that the user is logged in
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (userError || !user) {
    return { success: false, error: 'Usuário não autenticado.' }
  }

  // Update the password in Supabase Auth
  const { error } = await supabase.auth.updateUser({
    password: password
  })

  if (error) {
    console.error('Erro ao atualizar senha:', error.message)
    return { success: false, error: error.message }
  }

  return { success: true }
}
