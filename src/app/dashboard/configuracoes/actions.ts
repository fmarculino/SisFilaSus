'use server'

import { createAdminClient } from '@/utils/supabase/admin'
import { revalidatePath } from 'next/cache'
import {
  CommunicationConfig,
  getCommunicationConfig,
  sendEmailAction,
  sendWhatsAppMessageAction
} from '@/lib/communication'
import { createClient } from '@/utils/supabase/server'

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
    console.error('Erro ao salvar configurações gerais:', error.message)
    return { success: false, error: error.message }
  }

  revalidatePath('/dashboard/configuracoes')
  return { success: true }
}

export async function updateCommunicationConfigAction(valor: CommunicationConfig) {
  const supabase = createAdminClient()

  const { error } = await supabase
    .from('configuracoes')
    .upsert(
      {
        chave: 'comunicacao',
        valor,
        updated_at: new Date().toISOString()
      },
      { onConflict: 'chave' }
    )

  if (error) {
    console.error('Erro ao salvar configurações de comunicação:', error.message)
    return { success: false, error: error.message }
  }

  revalidatePath('/dashboard/configuracoes')
  return { success: true }
}

export async function testSmtpAction(targetEmail?: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const recipient = targetEmail || user?.email

  if (!recipient) {
    return { success: false, error: 'Endereço de e-mail de teste não informado.' }
  }

  const testSubject = 'SisFilaSUS - Teste de Configuração SMTP'
  const testHtml = `
    <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
      <h2 style="color: #0284c7;">SisFilaSUS • Teste de E-mail SMTP</h2>
      <p>Olá,</p>
      <p>Este é um e-mail de teste enviado para confirmar que o servidor SMTP do <strong>SisFilaSUS</strong> está configurado e operando corretamente.</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
      <p style="font-size: 11px; color: #777;">Data/Hora do teste: ${new Date().toLocaleString('pt-BR')}</p>
    </div>
  `

  return await sendEmailAction({
    to: recipient,
    subject: testSubject,
    html: testHtml
  })
}

export async function testWhatsAppAction(targetPhone: string) {
  if (!targetPhone) {
    return { success: false, error: 'Por favor, informe o número de telefone/WhatsApp para o teste.' }
  }

  const message = `*SisFilaSUS - Teste de Integração WhatsApp AstraCalls*\n\nOlá! Esta é uma mensagem de teste enviada a partir do painel de administração do SisFilaSUS.\n\n_Data/Hora: ${new Date().toLocaleString('pt-BR')}_`

  return await sendWhatsAppMessageAction({
    phone: targetPhone,
    message
  })
}
