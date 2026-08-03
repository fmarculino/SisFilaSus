'use server'

import nodemailer from 'nodemailer'
import { createAdminClient } from '@/utils/supabase/admin'

export interface CommunicationConfig {
  smtp_host?: string
  smtp_port?: string
  smtp_user?: string
  smtp_pass?: string
  smtp_from_name?: string
  smtp_from_email?: string
  smtp_secure?: boolean
  wacalls_url?: string
  wacalls_api_key?: string
  wacalls_session?: string
  whatsapp_enabled?: boolean
  email_enabled?: boolean
}

/**
 * Obtém a configuração de comunicação.
 * Prioridade: Banco de Dados (tabela configuracoes -> chave 'comunicacao') com fallback para Variáveis de Ambiente (.env).
 */
export async function getCommunicationConfig(): Promise<CommunicationConfig> {
  let dbConfig: CommunicationConfig = {}

  try {
    const supabase = createAdminClient()
    const { data } = await supabase
      .from('configuracoes')
      .select('valor')
      .eq('chave', 'comunicacao')
      .single()

    if (data?.valor && typeof data.valor === 'object') {
      dbConfig = data.valor as CommunicationConfig
    }
  } catch (err) {
    console.warn('Não foi possível carregar configurações de comunicação do banco:', err)
  }

  return {
    smtp_host: dbConfig.smtp_host || process.env.SMTP_HOST || '',
    smtp_port: dbConfig.smtp_port || process.env.SMTP_PORT || '587',
    smtp_user: dbConfig.smtp_user || process.env.SMTP_USER || '',
    smtp_pass: dbConfig.smtp_pass || process.env.SMTP_PASS || '',
    smtp_from_name: dbConfig.smtp_from_name || process.env.SMTP_FROM_NAME || 'SisFilaSUS - Regulação de Saúde',
    smtp_from_email: dbConfig.smtp_from_email || process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || '',
    smtp_secure: dbConfig.smtp_secure !== undefined ? dbConfig.smtp_secure : process.env.SMTP_SECURE === 'true',
    
    wacalls_url: dbConfig.wacalls_url || process.env.WACALLS_URL || 'https://astracall.atb.app.br',
    wacalls_api_key: dbConfig.wacalls_api_key || process.env.WACALLS_API_KEY || 'CotEnKV5ykYG5HKiSQizExXnmVnCYFXM',
    wacalls_session: dbConfig.wacalls_session || process.env.WACALLS_SESSION || 'inbox3_acc6',
    
    whatsapp_enabled: dbConfig.whatsapp_enabled !== undefined ? dbConfig.whatsapp_enabled : true,
    email_enabled: dbConfig.email_enabled !== undefined ? dbConfig.email_enabled : true,
  }
}

/**
 * Retorna as variações válidas de formato de telefone para WhatsApp no Brasil.
 * Para DDDs >= 31, o WhatsApp registra o número sem o nono dígito (12 dígitos).
 * Esta função tenta primeiro o formato de 12 dígitos e, em seguida, o de 13 dígitos.
 */
export async function getWhatsAppPhoneVariants(phoneRaw: string): Promise<string[]> {
  const digitsOnly = phoneRaw.replace(/\D/g, '')
  if (!digitsOnly) return []

  let phone = digitsOnly.startsWith('55') ? digitsOnly : `55${digitsOnly}`

  // Se for número do Brasil com 13 dígitos (55 + 2 DDD + 9 dígito celular)
  if (phone.length === 13 && phone.startsWith('55')) {
    const ddd = parseInt(phone.substring(2, 4), 10)
    // Para DDDs >= 31, a conta WhatsApp usa a versão de 12 dígitos (sem o 9º dígito inicial)
    if (ddd >= 31 && phone[4] === '9') {
      const variant12 = `55${phone.substring(2, 4)}${phone.substring(5)}`
      return [variant12, phone]
    }
  }

  return [phone]
}

/**
 * Gera URL para envio manual via WhatsApp Web (fallback)
 */
export async function getWhatsAppWebUrl(phoneRaw: string, message: string): Promise<string> {
  const digitsOnly = phoneRaw.replace(/\D/g, '')
  const phone = digitsOnly.startsWith('55') ? digitsOnly : `55${digitsOnly}`
  return `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(message)}`
}

/**
 * Envia mensagem direta via API AstraCalls com retry nas variações de formato do número.
 */
export async function sendWhatsAppMessageAction(params: {
  phone: string
  message: string
}): Promise<{ success: boolean; phoneUsed?: string; error?: string }> {
  const { phone, message } = params

  if (!phone || !message) {
    return { success: false, error: 'Telefone e mensagem são obrigatórios.' }
  }

  const config = await getCommunicationConfig()

  if (!config.whatsapp_enabled) {
    return { success: false, error: 'Envio de mensagens por WhatsApp está desativado nas configurações do sistema.' }
  }

  if (!config.wacalls_session) {
    return { success: false, error: 'Sessão do WhatsApp (AstraCalls) não configurada.' }
  }

  const baseUrl = (config.wacalls_url || 'https://astracall.atb.app.br').replace(/\/$/, '')
  const apiKey = config.wacalls_api_key || ''
  const session = config.wacalls_session

  const phoneVariants = await getWhatsAppPhoneVariants(phone)
  let lastError = ''

  for (const targetPhone of phoneVariants) {
    const chatId = `${targetPhone}@s.whatsapp.net`
    try {
      const response = await fetch(`${baseUrl}/message/text`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey,
        },
        body: JSON.stringify({
          session,
          chatId,
          text: message,
        }),
      })

      if (response.ok) {
        return { success: true, phoneUsed: targetPhone }
      }

      const errText = await response.text()
      lastError = `HTTP ${response.status}: ${errText}`
    } catch (err: any) {
      lastError = err.message || 'Erro de conexão com o servidor AstraCalls'
    }
  }

  return { success: false, error: lastError }
}

/**
 * Envia e-mail transacional usando Nodemailer SMTP.
 */
export async function sendEmailAction(params: {
  to: string
  subject: string
  html: string
}): Promise<{ success: boolean; error?: string }> {
  const { to, subject, html } = params

  if (!to || !subject || !html) {
    return { success: false, error: 'Destinatário, assunto e conteúdo HTML são obrigatórios.' }
  }

  const config = await getCommunicationConfig()

  if (!config.email_enabled) {
    return { success: false, error: 'Envio de e-mails transacionais está desativado nas configurações do sistema.' }
  }

  if (!config.smtp_host || !config.smtp_user) {
    return { success: false, error: 'Servidor SMTP não configurado. Verifique as configurações do sistema.' }
  }

  const port = parseInt(config.smtp_port || '587', 10)
  const isSecure = config.smtp_secure || port === 465

  const transporter = nodemailer.createTransport({
    host: config.smtp_host,
    port,
    secure: isSecure,
    auth: {
      user: config.smtp_user,
      pass: config.smtp_pass || '',
    },
    tls: {
      rejectUnauthorized: false // Para compatibilidade com servidores locais ou auto-assinados
    }
  })

  try {
    const fromName = config.smtp_from_name || 'SisFilaSUS'
    const fromEmail = config.smtp_from_email || config.smtp_user

    await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to,
      subject,
      html,
    })

    return { success: true }
  } catch (error: any) {
    console.error('Erro ao enviar e-mail via SMTP:', error)
    return { success: false, error: error.message || 'Falha ao enviar e-mail.' }
  }
}
