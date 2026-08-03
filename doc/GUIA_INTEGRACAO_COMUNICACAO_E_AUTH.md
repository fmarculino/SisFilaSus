# 📘 Guia Técnico: Motor de Comunicação (WhatsApp AstraCalls & E-mail SMTP) e Autenticação (Supabase Auth SSR) no SisFilaSUS

Este documento detalha a arquitetura, parâmetros de configuração, funções de serviço e fluxos operacionais implementados no **SisFilaSUS** para os módulos de **Comunicação (WhatsApp AstraCalls & E-mail Transacional SMTP)** e **Recuperação de Senha (Supabase Auth SSR)**.

---

## 📑 Índice
1. [Visão Geral e Arquitetura](#1-visão-geral-e-arquitetura)
2. [Motor de Envio por WhatsApp (AstraCalls REST API)](#2-motor-de-envio-por-whatsapp-astracalls-rest-api)
   - [Tratamento Automático do 9º Dígito no Brasil (DDDs >= 31)](#tratamento-automático-do-9º-dígito-no-brasil-ddds--31)
   - [Fallback e Envio Manual via WhatsApp Web](#fallback-e-envio-manual-via-whatsapp-web)
3. [Motor de E-mail Transacional (Nodemailer SMTP)](#3-motor-de-e-mail-transacional-nodemailer-smtp)
4. [Armazenamento no Banco de Dados (Tabela `configuracoes`)](#4-armazenamento-no-banco-de-dados-tabela-configuracoes)
5. [Fluxo Completo de Recuperação de Senha (Supabase Auth SSR)](#5-fluxo-completo-de-recuperação-de-senha-supabase-auth-ssr)
6. [Painel de Gerenciamento (`/dashboard/configuracoes`)](#6-painel-de-gerenciamento-dashboardconfiguracoes)

---

## 1. Visão Geral e Arquitetura

O SisFilaSUS conta com um motor centralizado de comunicação em `src/lib/communication.ts` construído sobre o **Next.js (App Router)** usando **Server Actions** em TypeScript, integração nativa com o **Supabase Auth (SSR)** e a biblioteca **Nodemailer**.

### Diagrama do Fluxo de Comunicação
```
┌─────────────────────────────────────────────────────────────┐
│                    Requisição de Disparo                    │
└──────────────────────────────┬──────────────────────────────┘
                               │
               ┌───────────────┴───────────────┐
               ▼                               ▼
    [ Canal: WhatsApp ]               [ Canal: E-mail ]
               │                               │
               ▼                               ▼
  Verifica DDD (>= 31?)              Resolve Config (Banco / .env)
  Gera variantes (12 e 13 dígitos)             │
               │                               ▼
               ├──────────────────────► Dispara SMTP Nodemailer
               ▼
  POST /message/text (AstraCalls)
               │
      ┌────────┴────────┐
      ▼                 ▼
   Sucesso?          Falhou?
   [ OK ]        Retry com 13 dígitos
                        │
                        ▼
                Link WhatsApp Web (Fallback)
```

---

## 2. Motor de Envio por WhatsApp (AstraCalls REST API)

O disparo direto de mensagens é realizado através do serviço **AstraCalls** utilizando requisições HTTP REST autenticadas via cabeçalho `X-API-Key`.

### Especificações Técnicas:
- **Base URL Padrão**: `https://astracall.atb.app.br` (editável no painel)
- **Session Name Padrão**: `inbox3_acc6` (editável no painel)
- **X-API-Key Padrão**: `CotEnKV5ykYG5HKiSQizExXnmVnCYFXM` (editável no painel)
- **Endpoint**: `POST /message/text`

### Tratamento Automático do 9º Dígito no Brasil (DDDs >= 31)

Números do Brasil com DDD maiores ou iguais a 31 (ex: Pará `94`, Pernambuco `81`, Bahia `71`, MG `31`) são registrados nos servidores do WhatsApp **sem o nono dígito** (12 dígitos no total: `55` + `DDD` + `8 dígitos`).

#### Algoritmo de Normalização (`src/lib/communication.ts`):
```typescript
export async function getWhatsAppPhoneVariants(phoneRaw: string): Promise<string[]> {
  const digitsOnly = phoneRaw.replace(/\D/g, '')
  if (!digitsOnly) return []

  let phone = digitsOnly.startsWith('55') ? digitsOnly : `55${digitsOnly}`

  if (phone.length === 13 && phone.startsWith('55')) {
    const ddd = parseInt(phone.substring(2, 4), 10)
    if (ddd >= 31 && phone[4] === '9') {
      const variant12 = `55${phone.substring(2, 4)}${phone.substring(5)}`
      return [variant12, phone]
    }
  }

  return [phone]
}
```

---

## 3. Motor de E-mail Transacional (Nodemailer SMTP)

O envio de e-mails transacionais (como links de recuperação de senha e testes de infraestrutura) utiliza a biblioteca `nodemailer`.

### Função de Envio (`sendEmailAction`):
```typescript
export async function sendEmailAction(params: {
  to: string
  subject: string
  html: string
})
```

A resolução de credenciais segue o padrão de **Arquitetura Híbrida**:
1. Busca primeiro no banco de dados em `public.configuracoes(chave='comunicacao')`.
2. Caso algum campo esteja em branco, utiliza o fallback das variáveis de ambiente (`.env.local` / `.env`).

---

## 4. Armazenamento no Banco de Dados (Tabela `configuracoes`)

Os dados de comunicação são mantidos de forma segura e dinâmica na tabela `public.configuracoes`:

```sql
INSERT INTO public.configuracoes (chave, valor)
VALUES (
    'comunicacao',
    '{
        "smtp_host": "smtp.gmail.com",
        "smtp_port": "587",
        "smtp_user": "",
        "smtp_pass": "",
        "smtp_from_name": "SisFilaSUS - Regulação de Saúde Marabá",
        "smtp_from_email": "",
        "smtp_secure": false,
        "wacalls_url": "https://astracall.atb.app.br",
        "wacalls_session": "inbox3_acc6",
        "wacalls_api_key": "CotEnKV5ykYG5HKiSQizExXnmVnCYFXM",
        "whatsapp_enabled": true,
        "email_enabled": true
    }'::jsonb
)
ON CONFLICT (chave) DO NOTHING;
```

---

## 5. Fluxo Completo de Recuperação de Senha (Supabase Auth SSR)

1. **Solicitação (`/esqueci-a-senha`)**: O usuário informa o e-mail cadastrado e a Server Action `requestPasswordResetAction` dispara `supabase.auth.resetPasswordForEmail`.
2. **Callback Handler (`/auth/callback/route.ts`)**: Valida o código com `exchangeCodeForSession`. Se o parâmetro `type === 'recovery'`, redireciona para `/auth/update-password`.
3. **Redefinição (`/auth/update-password`)**: O usuário atualiza sua palavra-chave utilizando `supabase.auth.updateUser({ password })`.

---

## 6. Painel de Gerenciamento (`/dashboard/configuracoes`)

A tela de configurações permite que administradores e coordenadores da regulação:
- Alternem entre as abas **Regras Gerais**, **E-mail Transacional (SMTP)** e **WhatsApp (AstraCalls)**.
- Ativem ou desativem individualmente cada módulo de disparo.
- Testem a conexão SMTP e enviem mensagens de verificação por WhatsApp em tempo real.
