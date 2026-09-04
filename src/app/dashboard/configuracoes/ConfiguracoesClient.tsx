'use client'

import React, { useState } from 'react'
import { DashboardShell } from '@/components/layout/DashboardShell'
import {
  Settings,
  Save,
  PhoneCall,
  Trash2,
  Building,
  EyeOff,
  Info,
  Mail,
  MessageSquare,
  Send,
  CheckCircle2,
  AlertCircle,
  Server,
  Key,
  Globe,
  Sliders
} from 'lucide-react'
import {
  updateConfigAction,
  updateCommunicationConfigAction,
  testSmtpAction,
  testWhatsAppAction
} from './actions'
import { CommunicationConfig } from '@/lib/communication'
import { useSystemModal } from '@/components/ui/SystemModal'

interface ConfigValue {
  limite_tentativas_contato: number
  anos_limpeza_fila: number
  municipio_sede: string
  omitir_fora_sisreg_padrao: boolean
}

interface ConfiguracoesClientProps {
  role: string
  email: string
  config: ConfigValue
  communicationConfig: CommunicationConfig
}

export function ConfiguracoesClient({
  role,
  email,
  config: initialConfig,
  communicationConfig: initialCommConfig
}: ConfiguracoesClientProps) {
  const { showAlert } = useSystemModal()
  const [activeTab, setActiveTab] = useState<'GERAL' | 'SMTP' | 'WHATSAPP'>('GERAL')

  // Estado das configurações gerais
  const [limiteContato, setLimiteContato] = useState(initialConfig.limite_tentativas_contato)
  const [anosLimpeza, setAnosLimpeza] = useState(initialConfig.anos_limpeza_fila)
  const [municipio, setMunicipio] = useState(initialConfig.municipio_sede)
  const [omitirForaSisreg, setOmitirForaSisreg] = useState(initialConfig.omitir_fora_sisreg_padrao)

  // Estado das configurações de comunicação
  const [commConfig, setCommConfig] = useState<CommunicationConfig>(initialCommConfig)

  // Estados de submissão e mensagens
  const [submitting, setSubmitting] = useState(false)
  const [testingSmtp, setTestingSmtp] = useState(false)
  const [testSmtpEmail, setTestSmtpEmail] = useState('')
  const [showSmtpTestModal, setShowSmtpTestModal] = useState(false)

  const [testingWa, setTestingWa] = useState(false)
  const [testWaPhone, setTestWaPhone] = useState('')
  const [showWaTestModal, setShowWaTestModal] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Salvar Parâmetros Gerais
  const handleSaveGeral = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setMessage(null)

    try {
      const res = await updateConfigAction({
        limite_tentativas_contato: Number(limiteContato),
        anos_limpeza_fila: Number(anosLimpeza),
        municipio_sede: municipio.trim().toUpperCase(),
        omitir_fora_sisreg_padrao: omitirForaSisreg
      })

      if (!res.success) throw new Error(res.error)
      setMessage({ type: 'success', text: 'Parâmetros gerais salvos com sucesso!' })
      setTimeout(() => setMessage(null), 4000)
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Erro ao salvar parâmetros.' })
    } finally {
      setSubmitting(false)
    }
  }

  // Salvar Comunicação (SMTP ou WhatsApp)
  const handleSaveCommunication = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setMessage(null)

    try {
      const res = await updateCommunicationConfigAction(commConfig)
      if (!res.success) throw new Error(res.error)
      setMessage({ type: 'success', text: 'Configurações de comunicação salvas no banco de dados!' })
      setTimeout(() => setMessage(null), 4000)
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Erro ao salvar configurações de comunicação.' })
    } finally {
      setSubmitting(false)
    }
  }

  // Testar SMTP
  const handleTestSmtp = async () => {
    if (!testSmtpEmail.trim()) {
      await showAlert({
        title: 'E-mail Ausente',
        message: 'Por favor, informe o e-mail de destino para receber o teste.',
        type: 'warning'
      })
      return
    }

    setTestingSmtp(true)
    setMessage(null)

    try {
      const res = await testSmtpAction(testSmtpEmail.trim())
      if (!res.success) throw new Error(res.error)
      setMessage({ type: 'success', text: `E-mail de teste enviado com sucesso para ${testSmtpEmail.trim()}!` })
      setShowSmtpTestModal(false)
    } catch (err: any) {
      setMessage({ type: 'error', text: `Falha no teste SMTP: ${err.message}` })
    } finally {
      setTestingSmtp(false)
    }
  }

  // Testar WhatsApp API
  const handleTestWhatsApp = async () => {
    if (!testWaPhone.trim()) {
      await showAlert({
        title: 'Número Ausente',
        message: 'Por favor, informe o número de WhatsApp com DDD para realizar o teste.',
        type: 'warning'
      })
      return
    }

    setTestingWa(true)
    setMessage(null)

    try {
      const res = await testWhatsAppAction(testWaPhone.trim())
      if (!res.success) throw new Error(res.error)
      setMessage({
        type: 'success',
        text: `Mensagem enviada com sucesso para ${res.phoneUsed || testWaPhone}!`
      })
      setShowWaTestModal(false)
    } catch (err: any) {
      setMessage({ type: 'error', text: `Falha no teste WhatsApp API: ${err.message}` })
    } finally {
      setTestingWa(false)
    }
  }

  return (
    <DashboardShell role={role} email={email}>
      <div className="space-y-8 max-w-5xl">
        
        {/* Header */}
        <div>
          <h2 className="text-3xl font-black text-foreground tracking-tighter uppercase">
            Configurações do <span className="text-primary italic">Sistema</span>
          </h2>
          <p className="text-sm text-muted-foreground mt-2">
            Gerencie os parâmetros operacionais, credenciais de e-mail SMTP e API do WhatsApp (AstraCalls).
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-border/20 pb-4 overflow-x-auto">
          <button
            type="button"
            onClick={() => { setActiveTab('GERAL'); setMessage(null); }}
            className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === 'GERAL'
                ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-105'
                : 'bg-background/50 border border-border/40 text-muted-foreground hover:text-foreground hover:bg-accent/10'
            }`}
          >
            <Sliders className="h-4 w-4" />
            <span>Regras Gerais</span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab('SMTP'); setMessage(null); }}
            className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === 'SMTP'
                ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-105'
                : 'bg-background/50 border border-border/40 text-muted-foreground hover:text-foreground hover:bg-accent/10'
            }`}
          >
            <Mail className="h-4 w-4" />
            <span>E-mail Transacional (SMTP)</span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab('WHATSAPP'); setMessage(null); }}
            className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === 'WHATSAPP'
                ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-105'
                : 'bg-background/50 border border-border/40 text-muted-foreground hover:text-foreground hover:bg-accent/10'
            }`}
          >
            <MessageSquare className="h-4 w-4" />
            <span>WhatsApp (AstraCalls)</span>
          </button>
        </div>

        {/* Feedback Alert */}
        {message && (
          <div className={`p-4 rounded-2xl border text-xs font-bold uppercase tracking-wide animate-in fade-in slide-in-from-top-2 duration-300 ${
            message.type === 'success' 
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' 
              : 'bg-rose-500/10 border-rose-500/20 text-rose-500'
          }`}>
            <div className="flex items-center gap-2">
              {message.type === 'success' ? (
                <CheckCircle2 className="h-4 w-4 shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0" />
              )}
              <span>{message.text}</span>
            </div>
          </div>
        )}

        {/* TAB 1: PARÂMETROS GERAIS */}
        {activeTab === 'GERAL' && (
          <form onSubmit={handleSaveGeral} className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              {/* Bento Card: Regulação Operacional */}
              <div className="bento-card p-6 md:p-8 space-y-6">
                <div className="flex items-center gap-3 border-b border-border/10 pb-4">
                  <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                    <PhoneCall className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-foreground uppercase tracking-wider">Regulação Operacional</h3>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Parâmetros de contatos e buscas ativas.</p>
                  </div>
                </div>

                <div className="group">
                  <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2 px-1">
                    Limite de Tentativas de Contato
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    required
                    value={limiteContato}
                    onChange={(e) => setLimiteContato(Number(e.target.value))}
                    className="block w-full rounded-2xl border border-border/50 bg-background/50 py-3.5 px-4 text-xs text-foreground outline-none focus:border-primary transition-all"
                  />
                </div>

                <div className="group">
                  <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2 px-1">
                    Município Sede da Regulação
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      value={municipio}
                      onChange={(e) => setMunicipio(e.target.value)}
                      className="block w-full rounded-2xl border border-border/50 bg-background/50 py-3.5 px-4 pr-10 text-xs text-foreground outline-none focus:border-primary transition-all uppercase"
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/30">
                      <Building className="h-4 w-4" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Bento Card: Configurações da Fila */}
              <div className="bento-card p-6 md:p-8 space-y-6">
                <div className="flex items-center gap-3 border-b border-border/10 pb-4">
                  <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                    <Trash2 className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-foreground uppercase tracking-wider">Fila e Triagem</h3>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Parâmetros de limpeza e exibição da fila.</p>
                  </div>
                </div>

                <div className="group">
                  <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2 px-1">
                    Tempo Limite para Limpeza de Fila (Anos)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    required
                    value={anosLimpeza}
                    onChange={(e) => setAnosLimpeza(Number(e.target.value))}
                    className="block w-full rounded-2xl border border-border/50 bg-background/50 py-3.5 px-4 text-xs text-foreground outline-none focus:border-primary transition-all"
                  />
                </div>

                <div className="flex items-center justify-between p-4 bg-muted/20 border border-border/10 rounded-2xl">
                  <div className="flex flex-col pr-4">
                    <span className="text-xs font-bold text-foreground">Omitir Fora do SISREG por Padrão</span>
                    <span className="text-[9px] text-muted-foreground mt-0.5">
                      Oculta registros ausentes nos novos arquivos de importação.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOmitirForaSisreg(!omitirForaSisreg)}
                    className={`p-1.5 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                      omitirForaSisreg 
                        ? 'bg-primary/10 border-primary/30 text-primary' 
                        : 'bg-zinc-500/10 border-zinc-500/30 text-zinc-500'
                    }`}
                  >
                    <EyeOff className="h-4 w-4" />
                    <span>{omitirForaSisreg ? 'Sim' : 'Não'}</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-4 bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-widest rounded-2xl hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer disabled:opacity-50 shadow-lg shadow-primary/20 flex items-center gap-2"
              >
                <Save className="h-4.5 w-4.5" />
                <span>{submitting ? 'Salvando...' : 'Salvar Parâmetros Gerais'}</span>
              </button>
            </div>
          </form>
        )}

        {/* TAB 2: E-MAIL TRANSACIONAL (SMTP) */}
        {activeTab === 'SMTP' && (
          <form onSubmit={handleSaveCommunication} className="space-y-6">
            <div className="bento-card p-6 md:p-8 space-y-6">
              <div className="flex items-center justify-between border-b border-border/10 pb-4">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                    <Mail className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-foreground uppercase tracking-wider">Servidor SMTP de E-mail</h3>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Usado para envio de e-mails de recuperação de senha e notificações.
                    </p>
                  </div>
                </div>

                {/* Status Toggle */}
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-muted-foreground">Módulo E-mail:</span>
                  <button
                    type="button"
                    onClick={() => setCommConfig(prev => ({ ...prev, email_enabled: !prev.email_enabled }))}
                    className={`px-3 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer ${
                      commConfig.email_enabled
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500'
                        : 'bg-zinc-500/10 border-zinc-500/30 text-zinc-500'
                    }`}
                  >
                    {commConfig.email_enabled ? 'Ativo' : 'Inativo'}
                  </button>
                </div>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                {/* SMTP Host */}
                <div className="group">
                  <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2 px-1">
                    Servidor SMTP (Host)
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="ex: smtp.gmail.com ou mail.maraba.pa.gov.br"
                      value={commConfig.smtp_host || ''}
                      onChange={(e) => setCommConfig(prev => ({ ...prev, smtp_host: e.target.value }))}
                      className="block w-full rounded-2xl border border-border/50 bg-background/50 py-3.5 px-4 pr-10 text-xs text-foreground outline-none focus:border-primary transition-all"
                    />
                    <Server className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/30" />
                  </div>
                </div>

                {/* SMTP Port */}
                <div className="group">
                  <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2 px-1">
                    Porta SMTP
                  </label>
                  <input
                    type="text"
                    placeholder="587 ou 465"
                    value={commConfig.smtp_port || ''}
                    onChange={(e) => setCommConfig(prev => ({ ...prev, smtp_port: e.target.value }))}
                    className="block w-full rounded-2xl border border-border/50 bg-background/50 py-3.5 px-4 text-xs text-foreground outline-none focus:border-primary transition-all"
                  />
                </div>

                {/* SMTP User */}
                <div className="group">
                  <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2 px-1">
                    Usuário SMTP / E-mail de Autenticação
                  </label>
                  <input
                    type="email"
                    placeholder="notificacoes@maraba.pa.gov.br"
                    value={commConfig.smtp_user || ''}
                    onChange={(e) => setCommConfig(prev => ({ ...prev, smtp_user: e.target.value }))}
                    className="block w-full rounded-2xl border border-border/50 bg-background/50 py-3.5 px-4 text-xs text-foreground outline-none focus:border-primary transition-all"
                  />
                </div>

                {/* SMTP Pass */}
                <div className="group">
                  <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2 px-1">
                    Senha do SMTP / Senha de Aplicativo
                  </label>
                  <div className="relative">
                    <input
                      type="password"
                      placeholder="••••••••••••"
                      value={commConfig.smtp_pass || ''}
                      onChange={(e) => setCommConfig(prev => ({ ...prev, smtp_pass: e.target.value }))}
                      className="block w-full rounded-2xl border border-border/50 bg-background/50 py-3.5 px-4 pr-10 text-xs text-foreground outline-none focus:border-primary transition-all"
                    />
                    <Key className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/30" />
                  </div>
                </div>

                {/* From Name */}
                <div className="group">
                  <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2 px-1">
                    Nome do Remetente
                  </label>
                  <input
                    type="text"
                    placeholder="SisFilaSUS - Regulação Marabá"
                    value={commConfig.smtp_from_name || ''}
                    onChange={(e) => setCommConfig(prev => ({ ...prev, smtp_from_name: e.target.value }))}
                    className="block w-full rounded-2xl border border-border/50 bg-background/50 py-3.5 px-4 text-xs text-foreground outline-none focus:border-primary transition-all"
                  />
                </div>

                {/* From Email */}
                <div className="group">
                  <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2 px-1">
                    E-mail do Remetente (From)
                  </label>
                  <input
                    type="email"
                    placeholder="nao-responda@maraba.pa.gov.br"
                    value={commConfig.smtp_from_email || ''}
                    onChange={(e) => setCommConfig(prev => ({ ...prev, smtp_from_email: e.target.value }))}
                    className="block w-full rounded-2xl border border-border/50 bg-background/50 py-3.5 px-4 text-xs text-foreground outline-none focus:border-primary transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Actions Footer */}
            <div className="flex items-center justify-between pt-4">
              <button
                type="button"
                onClick={() => {
                  if (!testSmtpEmail) {
                    setTestSmtpEmail(email && email !== 'admin@admin.com' ? email : commConfig.smtp_user || '')
                  }
                  setShowSmtpTestModal(true)
                }}
                className="px-5 py-3.5 bg-accent/20 border border-accent/40 text-foreground text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-accent/30 transition-all cursor-pointer flex items-center gap-2"
              >
                <Send className="h-4 w-4" />
                <span>Testar Conexão SMTP</span>
              </button>

              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-4 bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-widest rounded-2xl hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer disabled:opacity-50 shadow-lg shadow-primary/20 flex items-center gap-2"
              >
                <Save className="h-4.5 w-4.5" />
                <span>{submitting ? 'Salvando...' : 'Salvar Configuração SMTP'}</span>
              </button>
            </div>
          </form>
        )}

        {/* TAB 3: WHATSAPP (ASTRACALLS) */}
        {activeTab === 'WHATSAPP' && (
          <form onSubmit={handleSaveCommunication} className="space-y-6">
            <div className="bento-card p-6 md:p-8 space-y-6">
              <div className="flex items-center justify-between border-b border-border/10 pb-4">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                    <MessageSquare className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-foreground uppercase tracking-wider">API WhatsApp (AstraCalls)</h3>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Integração REST com AstraCalls para disparo direto de convocações e confirmações.
                    </p>
                  </div>
                </div>

                {/* Status Toggle */}
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-muted-foreground">Módulo WhatsApp:</span>
                  <button
                    type="button"
                    onClick={() => setCommConfig(prev => ({ ...prev, whatsapp_enabled: !prev.whatsapp_enabled }))}
                    className={`px-3 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer ${
                      commConfig.whatsapp_enabled
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500'
                        : 'bg-zinc-500/10 border-zinc-500/30 text-zinc-500'
                    }`}
                  >
                    {commConfig.whatsapp_enabled ? 'Ativo' : 'Inativo'}
                  </button>
                </div>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                {/* AstraCalls Base URL */}
                <div className="group md:col-span-2">
                  <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2 px-1">
                    Base URL da API AstraCalls
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="https://astracall.atb.app.br"
                      value={commConfig.wacalls_url || ''}
                      onChange={(e) => setCommConfig(prev => ({ ...prev, wacalls_url: e.target.value }))}
                      className="block w-full rounded-2xl border border-border/50 bg-background/50 py-3.5 px-4 pr-10 text-xs text-foreground outline-none focus:border-primary transition-all font-mono"
                    />
                    <Globe className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/30" />
                  </div>
                </div>

                {/* Session Name */}
                <div className="group">
                  <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2 px-1">
                    Nome da Sessão Pareada (Session)
                  </label>
                  <input
                    type="text"
                    placeholder="inbox3_acc6"
                    value={commConfig.wacalls_session || ''}
                    onChange={(e) => setCommConfig(prev => ({ ...prev, wacalls_session: e.target.value }))}
                    className="block w-full rounded-2xl border border-border/50 bg-background/50 py-3.5 px-4 text-xs text-foreground outline-none focus:border-primary transition-all font-mono"
                  />
                  <span className="block text-[9px] text-muted-foreground/60 mt-1.5 px-1">
                    Identificador da instância conectada via QR Code no AstraCalls.
                  </span>
                </div>

                {/* API Key */}
                <div className="group">
                  <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2 px-1">
                    Chave de API Global (X-API-Key)
                  </label>
                  <div className="relative">
                    <input
                      type="password"
                      placeholder="••••••••••••••••••••"
                      value={commConfig.wacalls_api_key || ''}
                      onChange={(e) => setCommConfig(prev => ({ ...prev, wacalls_api_key: e.target.value }))}
                      className="block w-full rounded-2xl border border-border/50 bg-background/50 py-3.5 px-4 pr-10 text-xs text-foreground outline-none focus:border-primary transition-all font-mono"
                    />
                    <Key className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/30" />
                  </div>
                  <span className="block text-[9px] text-muted-foreground/60 mt-1.5 px-1">
                    Cabeçalho de autenticação X-API-Key enviado nas requisições.
                  </span>
                </div>
              </div>
            </div>

            {/* Actions Footer */}
            <div className="flex items-center justify-between pt-4">
              <button
                type="button"
                onClick={() => setShowWaTestModal(true)}
                className="px-5 py-3.5 bg-accent/20 border border-accent/40 text-foreground text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-accent/30 transition-all cursor-pointer flex items-center gap-2"
              >
                <Send className="h-4 w-4" />
                <span>Testar Disparo WhatsApp API</span>
              </button>

              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-4 bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-widest rounded-2xl hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer disabled:opacity-50 shadow-lg shadow-primary/20 flex items-center gap-2"
              >
                <Save className="h-4.5 w-4.5" />
                <span>{submitting ? 'Salvando...' : 'Salvar Configuração WhatsApp'}</span>
              </button>
            </div>
          </form>
        )}

        {/* Modal de Teste SMTP */}
        {showSmtpTestModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="relative max-w-md w-full rounded-3xl bg-card text-card-foreground border border-border/80 shadow-[0_25px_70px_rgba(0,0,0,0.3)] p-6 md:p-8 space-y-5 animate-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between border-b border-border/20 pb-3">
                <h3 className="text-sm font-black text-foreground uppercase tracking-wider flex items-center gap-2">
                  <Mail className="h-4 w-4 text-primary" />
                  <span>Testar Conexão SMTP de E-mail</span>
                </h3>
                <button
                  onClick={() => setShowSmtpTestModal(false)}
                  className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-muted/80 transition-colors"
                  aria-label="Fechar"
                >
                  ✕
                </button>
              </div>

              <p className="text-xs text-foreground/80 dark:text-foreground/90 font-medium leading-relaxed">
                Insira o e-mail que receberá a mensagem de teste enviada através do servidor SMTP configurado.
              </p>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5">
                  E-mail de Destino do Teste
                </label>
                <input
                  type="email"
                  placeholder="ex: informatica.sms@maraba.pa.gov.br"
                  value={testSmtpEmail}
                  onChange={(e) => setTestSmtpEmail(e.target.value)}
                  className="block w-full rounded-2xl border border-border bg-background py-3.5 px-4 text-xs text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-mono"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSmtpTestModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-border/80 bg-muted/40 text-[10px] font-black uppercase tracking-wider text-foreground hover:bg-muted hover:border-border transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleTestSmtp}
                  disabled={testingSmtp}
                  className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-widest hover:brightness-110 active:scale-95 disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-primary/20 transition-all cursor-pointer"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>{testingSmtp ? 'Enviando...' : 'Enviar E-mail de Teste'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Teste WhatsApp */}
        {showWaTestModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="relative max-w-md w-full rounded-3xl bg-card text-card-foreground border border-border/80 shadow-[0_25px_70px_rgba(0,0,0,0.3)] p-6 md:p-8 space-y-5 animate-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between border-b border-border/20 pb-3">
                <h3 className="text-sm font-black text-foreground uppercase tracking-wider flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-primary" />
                  <span>Testar Disparo de WhatsApp</span>
                </h3>
                <button
                  onClick={() => setShowWaTestModal(false)}
                  className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-muted/80 transition-colors"
                  aria-label="Fechar"
                >
                  ✕
                </button>
              </div>

              <p className="text-xs text-foreground/80 dark:text-foreground/90 font-medium leading-relaxed">
                Insira um número de telefone celular com DDD (ex: 94981001122 ou 5594981001122) para receber a mensagem de teste.
              </p>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5">
                  Número do WhatsApp de Teste
                </label>
                <input
                  type="text"
                  placeholder="ex: 94981034808"
                  value={testWaPhone}
                  onChange={(e) => setTestWaPhone(e.target.value)}
                  className="block w-full rounded-2xl border border-border bg-background py-3.5 px-4 text-xs text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-mono"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowWaTestModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-border/80 bg-muted/40 text-[10px] font-black uppercase tracking-wider text-foreground hover:bg-muted hover:border-border transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleTestWhatsApp}
                  disabled={testingWa}
                  className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-widest hover:brightness-110 active:scale-95 disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-primary/20 transition-all cursor-pointer"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>{testingWa ? 'Enviando...' : 'Enviar Mensagem'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </DashboardShell>
  )
}
