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
 * Envia mensagem direta via API AstraCalls com suporte multi-endpoint REST e auto-discovery de sessões.
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
  const apiKey = (config.wacalls_api_key || '').trim()
  const session = (config.wacalls_session || 'default').trim()

  const phoneVariants = await getWhatsAppPhoneVariants(phone)
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (apiKey) {
    headers['X-API-Key'] = apiKey
  }

  // Função para testar disparo por múltiplos endpoints suportados pelo AstraCalls/WAHA
  const attemptSend = async (sessionSid: string, destinationPhone: string) => {
    // 1. Endpoint padrão AstraCalls REST API v2 (/api/sessions/:sid/messages/text)
    try {
      const res = await fetch(`${baseUrl}/api/sessions/${encodeURIComponent(sessionSid)}/messages/text`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ to: destinationPhone, text: message }),
      })
      if (res.ok) {
        return { ok: true, phoneUsed: destinationPhone }
      }
    } catch (e) {}

    // 2. Endpoint alternativo AstraCalls/WAHA (/api/sendText)
    try {
      const res = await fetch(`${baseUrl}/api/sendText`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          session: sessionSid,
          chatId: `${destinationPhone}@s.whatsapp.net`,
          text: message,
        }),
      })
      if (res.ok) {
        return { ok: true, phoneUsed: destinationPhone }
      }
    } catch (e) {}

    // 3. Endpoint alternativo simples (/message/text)
    try {
      const res = await fetch(`${baseUrl}/message/text`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          session: sessionSid,
          chatId: `${destinationPhone}@s.whatsapp.net`,
          text: message,
        }),
      })
      if (res.ok) {
        return { ok: true, phoneUsed: destinationPhone }
      }
    } catch (e) {}

    return { ok: false }
  }

  let lastError = ''

  // 1ª Passada: Tenta com a sessão configurada
  for (const targetPhone of phoneVariants) {
    const res = await attemptSend(session, targetPhone)
    if (res.ok) {
      return { success: true, phoneUsed: targetPhone }
    }
  }

  // 2ª Passada: Tenta auto-descobrir a sessão ativa no servidor AstraCalls caso o nome/ID divirja
  try {
    const sessionsRes = await fetch(`${baseUrl}/api/sessions`, { headers })
    if (sessionsRes.ok) {
      const sessionsJson = await sessionsRes.json()
      const sessionsList = Array.isArray(sessionsJson?.sessions)
        ? sessionsJson.sessions
        : Array.isArray(sessionsJson)
        ? sessionsJson
        : []

      const matchedSession = sessionsList.find(
        (s: any) =>
          s.id === session ||
          s.name === session ||
          (s.name && s.name.toLowerCase() === session.toLowerCase())
      ) || sessionsList.find(
        (s: any) =>
          (s.state === 'open' || s.status === 'WORKING' || s.paired === true) &&
          (s.name && (s.name.includes(session) || session.includes(s.name)))
      ) || sessionsList.find(
        (s: any) => s.state === 'open' || s.status === 'WORKING' || s.paired === true
      )

      if (matchedSession && matchedSession.id) {
        for (const targetPhone of phoneVariants) {
          const res = await attemptSend(matchedSession.id, targetPhone)
          if (res.ok) {
            return { success: true, phoneUsed: targetPhone }
          }
        }
      }
    } else {
      const errText = await sessionsRes.text()
      lastError = `HTTP ${sessionsRes.status}: ${errText}`
    }
  } catch (err: any) {
    lastError = err.message || 'Erro ao comunicar com o servidor AstraCalls'
  }

  if (!lastError) {
    lastError = 'HTTP 404: Não foi possível localizar um endpoint válido ou sessão conectada no AstraCalls.'
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
      rejectUnauthorized: false
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
