'use server'

import { createAdminClient } from '@/utils/supabase/admin'
import { revalidatePath } from 'next/cache'

export async function updateConfigAction(valor: {
  limite_tentativas_contato: number
  anos_limpeza_fila: number
  municipio_sede: string
  omitir_fora_sisreg_padrao: boolean
}) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Erro de Configuração: SUPABASE_SERVICE_ROLE_KEY não está configurado.')
    return { success: false, error: 'Erro de Configuração: A variável de ambiente SUPABASE_SERVICE_ROLE_KEY não está configurada no servidor.' }
  }

  const supabase = createAdminClient()

  const { error } = await supabase
    .from('configuracoes')
    .upsert(
      {
        chave: 'geral',
        valor,
        updated_at: new Date().toISOString()
      },
      { onConflict: 'chave' }
    )

  if (error) {
    console.error('Erro ao salvar configurações:', error.message)
    return { success: false, error: error.message }
  }

  revalidatePath('/dashboard/configuracoes')
  return { success: true }
}
