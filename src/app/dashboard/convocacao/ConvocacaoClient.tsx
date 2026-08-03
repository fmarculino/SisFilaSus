'use client'

import React, { useState, useEffect } from 'react'
import { DashboardShell } from '@/components/layout/DashboardShell'
import { Phone, MessageSquare, Check, X, Calendar, User, FileText, AlertCircle, Send, ExternalLink, Loader2 } from 'lucide-react'
import { createContactLog, fetchSolicitacaoExtraData } from '../fila/actions'
import { sendWhatsAppMessageAction, getWhatsAppWebUrl } from '@/lib/communication'
import { useSystemModal } from '@/components/ui/SystemModal'

interface ConvocacaoClientProps {
  role: string
  email: string
  solicitacoes: any[]
  templates: any[]
}

export function ConvocacaoClient({ role, email, solicitacoes: initialSols, templates }: ConvocacaoClientProps) {
  const { showAlert } = useSystemModal()
  const [solicitacoes, setSolicitacoes] = useState(initialSols)
  const [activeTab, setActiveTab] = useState<'ALL' | 'EM_CONVOCACAO' | 'SEM_CONTATO'>('ALL')
  const [selectedSol, setSelectedSol] = useState<any | null>(null)
  
  // Registrar Contato Rápido
  const [outcome, setOutcome] = useState('SUCESSO_CONFIRMOU')
  const [obs, setObs] = useState('')
  const [saving, setSaving] = useState(false)
  const [sendingWa, setSendingWa] = useState(false)

  // Controle de templates e customização de WhatsApp
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [customMsgText, setCustomMsgText] = useState('')

  // Atualiza o texto customizado da mensagem com base no template selecionado e nos dados da solicitação
  useEffect(() => {
    if (!selectedSol) {
      setCustomMsgText('')
      return
    }

    const defaultFallbackText = 'Olá, {nome_usuario}. Entramos em contato da Regulação da Saúde de Marabá referente à sua solicitação de {desc_sigtap}. Por favor, responda a esta mensagem.'
    let baseText = defaultFallbackText

    if (selectedTemplateId) {
      const activeTemplate = templates.find(t => t.id === selectedTemplateId)
      if (activeTemplate) {
        baseText = activeTemplate.corpo
      }
    }

    // Processar substituições
    let dataExecStr = 'Não agendado'
    if (selectedSol.data_execucao) {
      try {
        dataExecStr = new Date(selectedSol.data_execucao).toLocaleDateString('pt-BR')
      } catch (e) {
        console.error(e)
      }
    }
    const posicaoFilaStr = selectedSol.posicao_fila ? `${selectedSol.posicao_fila}º` : 'Agendado'

    const processedText = baseText
      .replace(/{nome_usuario}/g, selectedSol.pacientes?.nome_usuario || '')
      .replace(/{desc_sigtap}/g, selectedSol.procedimentos?.desc_sigtap || '')
      .replace(/{posicao_fila}/g, posicaoFilaStr)
      .replace(/{data_execucao}/g, dataExecStr)
      .replace(/{nome_executante}/g, selectedSol.nome_executante || 'Não definido')
      .replace(/{chave_confirmacao}/g, selectedSol.chave_confirmacao || 'Não gerada')

    setCustomMsgText(processedText)
  }, [selectedTemplateId, selectedSol, templates])

  // Filtrar lista com base na Tab ativa
  const filteredSols = solicitacoes.filter(s => {
    if (activeTab === 'EM_CONVOCACAO') return s.status_interno === 'EM_CONVOCACAO'
    if (activeTab === 'SEM_CONTATO') return s.status_interno === 'SEM_CONTATO'
    return true
  })

  const handleRegisterOutcome = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedSol) return

    setSaving(true)
    try {
      const activePhone = selectedSol.pacientes.telefone_1 || selectedSol.pacientes.telefone_2 || 'N/I'
      await createContactLog(selectedSol.cod_solicitacao, 'WHATSAPP', outcome, activePhone, obs)
      
      // Remover da lista de pendentes local se o resultado indica desfecho final
      if (['SUCESSO_CONFIRMOU', 'SUCESSO_RECUSOU'].includes(outcome)) {
        setSolicitacoes(prev => prev.filter(s => s.cod_solicitacao !== selectedSol.cod_solicitacao))
      } else {
        // Apenas atualizar status local
        setSolicitacoes(prev => prev.map(s => {
          if (s.cod_solicitacao === selectedSol.cod_solicitacao) {
            return {
              ...s,
              status_interno: outcome === 'SEM_RESPOSTA' ? 'SEM_CONTATO' : s.status_interno
            }
          }
          return s
        }))
      }

      await showAlert({
        title: 'Contato Registrado',
        message: 'O log de contato foi gravado com sucesso e a lista foi atualizada.',
        type: 'success'
      })
      setSelectedSol(null)
      setObs('')
    } catch (err: any) {
      await showAlert({
        title: 'Erro ao Registrar Contato',
        message: err.message || 'Erro ao registrar contato.',
        type: 'error'
      })
    } finally {
      setSaving(false)
    }
  }

  const handleSendDirectWhatsApp = async () => {
    if (!selectedSol) return
    const tel = selectedSol.pacientes.telefone_1 || selectedSol.pacientes.telefone_2
    if (!tel) {
      await showAlert({
        title: 'Telefone Ausente',
        message: 'O paciente selecionado não possui telefone/WhatsApp cadastrado.',
        type: 'warning'
      })
      return
    }

    const text = customMsgText || `Olá, ${selectedSol.pacientes.nome_usuario}. Entramos em contato da Regulação de Saúde de Marabá referente à sua solicitação de ${selectedSol.procedimentos.desc_sigtap}. Por favor, responda esta mensagem.`

    setSendingWa(true)
    try {
      const res = await sendWhatsAppMessageAction({ phone: tel, message: text })

      if (res.success) {
        await showAlert({
          title: 'WhatsApp Enviado',
          message: `Mensagem enviada com sucesso para ${res.phoneUsed || tel} via AstraCalls API!`,
          type: 'success'
        })
        // Registrar log de contato automaticamente
        await createContactLog(
          selectedSol.cod_solicitacao,
          'WHATSAPP',
          'SUCESSO_CONFIRMOU',
          res.phoneUsed || tel,
          `WhatsApp enviado via AstraCalls API:\n"${text}"`
        )
        setOutcome('SUCESSO_CONFIRMOU')
        setObs(`WhatsApp enviado via AstraCalls API:\n"${text}"`)
      } else {
        await showAlert({
          title: 'Falha no Disparo API',
          message: `Falha no envio via API AstraCalls: ${res.error}\n\nUtilize o botão "WhatsApp Web (Fallback)" para abrir e enviar manualmente.`,
          type: 'error'
        })
      }
    } catch (err: any) {
      await showAlert({
        title: 'Erro na API WhatsApp',
        message: `Erro ao comunicar com a API do WhatsApp: ${err.message}`,
        type: 'error'
      })
    } finally {
      setSendingWa(false)
    }
  }

  const handleTriggerWhatsAppWeb = async () => {
    if (!selectedSol) return
    const tel = selectedSol.pacientes.telefone_1 || selectedSol.pacientes.telefone_2
    if (!tel) {
      await showAlert({
        title: 'Telefone Ausente',
        message: 'O paciente selecionado não possui telefone/WhatsApp cadastrado.',
        type: 'warning'
      })
      return
    }

    const text = customMsgText || `Olá, ${selectedSol.pacientes.nome_usuario}. Entramos em contato da Regulação de Saúde de Marabá sobre seu procedimento de ${selectedSol.procedimentos.desc_sigtap}. Por favor, responda esta mensagem.`
    const url = await getWhatsAppWebUrl(tel, text)
    window.open(url, '_blank')

    setOutcome('SUCESSO_CONFIRMOU')
    setObs(`WhatsApp Web aberto manualmente:\n"${text}"`)
  }

  const getRiskColor = (risco: number) => {
    switch (risco) {
      case 0: return 'bg-rose-500 text-white'
      case 1: return 'bg-red-500/10 text-red-500 border border-red-500/20'
      case 2: return 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
      case 3: return 'bg-teal-500/10 text-teal-500 border border-teal-500/20'
      default: return 'bg-purple-500/10 text-purple-500 border border-purple-500/20'
    }
  }

  const getRiskLabel = (risco: number) => {
    switch (risco) {
      case 0: return 'Emergência'
      case 1: return 'Urgência'
      case 2: return 'Prioridade'
      case 3: return 'Eletivo'
      default: return 'Especial'
    }
  }

  return (
    <DashboardShell role={role} email={email}>
      <div className="space-y-8 max-w-6xl">
        <div>
          <h2 className="text-3xl font-black text-foreground tracking-tighter uppercase">
            Lista de <span className="text-primary italic">Convocação</span>
          </h2>
          <p className="text-sm text-muted-foreground mt-2">
            Lista de trabalho diária de busca ativa. Foco em pacientes com contato pendente ou em andamento.
          </p>
        </div>

        {/* Tab Selector */}
        <div className="flex gap-2 p-1.5 bg-muted/40 backdrop-blur-md rounded-2xl border border-border/30 w-fit">
          <button
            onClick={() => setActiveTab('ALL')}
            className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${
              activeTab === 'ALL' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Todos PENDENTES ({solicitacoes.length})
          </button>
          <button
            onClick={() => setActiveTab('EM_CONVOCACAO')}
            className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${
              activeTab === 'EM_CONVOCACAO' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Em Convocação Ativa ({solicitacoes.filter(s => s.status_interno === 'EM_CONVOCACAO').length})
          </button>
          <button
            onClick={() => setActiveTab('SEM_CONTATO')}
            className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${
              activeTab === 'SEM_CONTATO' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Sem Contato / Retentar ({solicitacoes.filter(s => s.status_interno === 'SEM_CONTATO').length})
          </button>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Tabela/Listagem principal */}
          <div className="lg:col-span-2 space-y-4">
            {filteredSols.length === 0 ? (
              <div className="bento-card p-12 text-center text-muted-foreground font-bold">
                Nenhum paciente na lista de trabalho com este status.
              </div>
            ) : (
              <div className="space-y-4">
                {filteredSols.map((sol) => (
                  <div 
                    key={sol.cod_solicitacao}
                    className={`bento-card p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-6 cursor-pointer hover:bg-card/60 transition-all border ${
                      selectedSol?.cod_solicitacao === sol.cod_solicitacao ? 'border-primary/55 bg-card/60 shadow-lg shadow-primary/5' : 'border-border/30'
                    }`}
                    onClick={() => setSelectedSol(sol)}
                  >
                    <div className="space-y-3 flex-1">
                      <div className="flex items-center gap-3">
                        <span className={`px-2 py-0.5 text-[8px] font-black uppercase rounded ${getRiskColor(sol.classificacao_risco)}`}>
                          {getRiskLabel(sol.classificacao_risco)}
                        </span>
                        <span className="text-[10px] font-black text-muted-foreground/50 font-mono">SOL: {sol.cod_solicitacao}</span>
                        {sol.posicao_fila ? (
                          <span className="text-[10px] font-black text-primary uppercase tracking-wider">Fila: {sol.posicao_fila}º</span>
                        ) : (
                          <span className="text-[9px] font-black text-emerald-500 uppercase tracking-wider">Agendado</span>
                        )}
                      </div>
                      
                      <div>
                        <h4 className="text-base font-black text-foreground uppercase">{sol.pacientes.nome_usuario}</h4>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">
                          {sol.procedimentos.desc_sigtap.trim()}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-4 text-[10px] font-bold text-muted-foreground uppercase pt-1">
                        <span className="flex items-center gap-1"><User className="h-3.5 w-3.5" /> CNS: {sol.pacientes.cns_usuario}</span>
                        <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> Solicitado em: {new Date(sol.data_solicitacao).toLocaleDateString('pt-BR')}</span>
                      </div>
                    </div>

                    <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-4 border-t sm:border-t-0 border-border/10 pt-4 sm:pt-0 shrink-0">
                      <div className="text-right hidden sm:block">
                        <span className="text-[9px] text-muted-foreground/60 font-black uppercase tracking-widest">Status Local</span>
                        <p className="text-xs font-bold text-primary mt-1">{sol.status_interno === 'EM_CONVOCACAO' ? 'Em Convocação Ativa' : 'Sem Contato (Retentar)'}</p>
                      </div>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedSol(sol)
                          }}
                          className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md shadow-emerald-500/10 transition-all flex items-center gap-2 cursor-pointer border border-emerald-600"
                        >
                          <MessageSquare className="h-4 w-4" />
                          <span>Chamar WhatsApp</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Painel lateral de registro rápido de contato */}
          <div className="lg:col-span-1">
            {selectedSol ? (
              <div className="bento-card p-6 sticky top-28 border-primary/20 space-y-6 animate-in">
                <div>
                  <span className="text-[9px] font-black uppercase tracking-widest text-primary">Registrar Contato Rápido</span>
                  <h4 className="text-base font-black text-foreground mt-1 uppercase truncate">{selectedSol.pacientes.nome_usuario}</h4>
                  <p className="text-[10px] text-muted-foreground font-mono mt-0.5">Telefone: {selectedSol.pacientes.telefone_1 || selectedSol.pacientes.telefone_2 || 'N/I'}</p>
                </div>

                {/* Busca Ativa - WhatsApp */}
                <div className="bento-card p-4 border-teal-500/20 bg-teal-500/5 space-y-3">
                  <div className="flex items-center gap-2 text-teal-500">
                    <MessageSquare className="h-4 w-4" />
                    <span className="text-[9px] font-black uppercase tracking-widest">Busca Ativa — WhatsApp</span>
                  </div>

                  {!(selectedSol.pacientes.telefone_1 || selectedSol.pacientes.telefone_2) ? (
                    <div className="flex items-center gap-2 p-2 bg-amber-500/5 text-amber-500 rounded-xl text-[10px] font-bold leading-relaxed border border-amber-500/20">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      <span>Paciente sem telefone cadastrado.</span>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-[8px] font-black text-muted-foreground uppercase tracking-widest">Modelo de Mensagem</label>
                        <select
                          value={selectedTemplateId}
                          onChange={(e) => setSelectedTemplateId(e.target.value)}
                          className="block w-full rounded-xl border border-border/50 bg-background/50 py-2 px-2.5 text-xs outline-none focus:border-primary transition-all text-foreground"
                        >
                          <option value="">Mensagem Padrão (Sem Modelo)</option>
                          {templates.map(t => (
                            <option key={t.id} value={t.id}>{t.titulo}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[8px] font-black text-muted-foreground uppercase tracking-widest">Preview da Mensagem (Editável)</label>
                        <textarea
                          value={customMsgText}
                          onChange={(e) => setCustomMsgText(e.target.value)}
                          rows={4}
                          className="block w-full rounded-xl border border-border/50 bg-background/50 py-2 px-2.5 text-xs outline-none focus:border-primary transition-all font-sans leading-relaxed text-foreground"
                          placeholder="Processando mensagem..."
                        />
                      </div>

                      <div className="grid gap-2 sm:grid-cols-2">
                        <button
                          type="button"
                          onClick={handleSendDirectWhatsApp}
                          disabled={sendingWa}
                          className="flex items-center justify-center gap-2 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-md shadow-emerald-600/20 active:scale-[0.99] transition-all cursor-pointer border border-emerald-500 disabled:opacity-50"
                        >
                          {sendingWa ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                          <span>{sendingWa ? 'Enviando...' : 'Enviar API Direto'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleTriggerWhatsAppWeb}
                          className="flex items-center justify-center gap-2 py-2.5 bg-background/80 hover:bg-accent/20 border border-border/50 text-foreground rounded-xl text-[9px] font-black uppercase tracking-widest active:scale-[0.99] transition-all cursor-pointer"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          <span>WhatsApp Web</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <form onSubmit={handleRegisterOutcome} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold text-muted-foreground uppercase">Desfecho do Contato</label>
                    <select
                      value={outcome}
                      onChange={(e) => setOutcome(e.target.value)}
                      className="block w-full rounded-xl border border-border/50 bg-background/50 py-2.5 px-3 text-xs outline-none focus:border-primary transition-all text-foreground"
                    >
                      <option value="SUCESSO_CONFIRMOU">Sucesso: Confirmou Atendimento</option>
                      <option value="SUCESSO_RECUSOU">Sucesso: Recusou / Desistiu</option>
                      <option value="SEM_RESPOSTA">Sem Resposta / Não Atende</option>
                      <option value="NUMERO_INVALIDO">Número Inexistente / Inválido</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold text-muted-foreground uppercase">Breve Descrição</label>
                    <textarea
                      value={obs}
                      onChange={(e) => setObs(e.target.value)}
                      rows={4}
                      required
                      className="block w-full rounded-xl border border-border/50 bg-background/50 py-2.5 px-3 text-xs outline-none focus:border-primary transition-all text-foreground"
                      placeholder="Ex: Ligado e confirmado comparecimento dia 10."
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedSol(null)}
                      className="w-1/2 py-3 border border-border/40 text-muted-foreground hover:bg-muted/50 hover:text-foreground text-[10px] font-black uppercase tracking-widest rounded-xl transition-all cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="w-1/2 py-3 bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-widest rounded-xl hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer disabled:opacity-50"
                    >
                      {saving ? 'Registrando...' : 'Registrar'}
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <div className="bento-card p-8 border-dashed border-border/50 text-center text-muted-foreground flex flex-col items-center justify-center gap-4 py-16">
                <AlertCircle className="h-10 w-10 text-muted-foreground/30" />
                <div>
                  <p className="text-xs font-bold">Selecione um paciente da lista</p>
                  <p className="text-[10px] opacity-60 mt-1">Clique em qualquer item à esquerda para abrir o log de contato rápido.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardShell>
  )
}
