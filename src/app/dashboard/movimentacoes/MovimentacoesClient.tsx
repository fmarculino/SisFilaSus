'use client'

import React, { useState } from 'react'
import { DashboardShell } from '@/components/layout/DashboardShell'
import { 
  Check, X, AlertCircle, History, Calendar, 
  User, FileText, ArrowRight, ShieldCheck, ShieldAlert 
} from 'lucide-react'
import { approveMovement, rejectMovement } from './actions'
import { useSystemModal } from '@/components/ui/SystemModal'

interface MovimentacoesClientProps {
  role: string
  email: string
  movimentacoes: any[]
}

export function MovimentacoesClient({ role, email, movimentacoes: initialMovs }: MovimentacoesClientProps) {
  const [movs, setMovs] = useState(initialMovs)
  const [activeTab, setActiveTab] = useState<'PENDING' | 'HISTORY'>('PENDING')
  const { showAlert } = useSystemModal()
  
  // Decisão de aprovação/rejeição
  const [decisionNotes, setDecisionNotes] = useState<{ [key: string]: string }>({})
  const [submitting, setSubmitting] = useState<{ [key: string]: boolean }>({})

  // Roles que podem aprovar/rejeitar
  const canApprove = ['SMS_ADMIN', 'COORDENADOR', 'MEDICO_REGULADOR'].includes(role)

  const pendingMovs = movs.filter(m => m.status === 'PENDENTE')
  const historyMovs = movs.filter(m => m.status !== 'PENDENTE')

  const handleDecision = async (id: string, action: 'APPROVE' | 'REJECT') => {
    const note = decisionNotes[id] || ''
    
    setSubmitting(prev => ({ ...prev, [id]: true }))
    try {
      if (action === 'APPROVE') {
        await approveMovement(id, note)
        await showAlert({
          title: 'Sucesso',
          message: 'Movimentação aprovada com sucesso! As alterações foram aplicadas à fila.',
          type: 'success'
        })
      } else {
        await rejectMovement(id, note)
        await showAlert({
          title: 'Sucesso',
          message: 'Movimentação rejeitada com sucesso!',
          type: 'success'
        })
      }
      
      // Atualizar lista localmente
      setMovs(prev => prev.map(m => {
        if (m.id === id) {
          return {
            ...m,
            status: action === 'APPROVE' ? 'APROVADO' : 'REJEITADO',
            observacoes_decisao: note,
            aprovador: { nome: 'Você' }, // Nome mock local
            updated_at: new Date().toISOString()
          }
        }
        return m
      }))
    } catch (err: any) {
      await showAlert({
        title: 'Erro',
        message: err.message || 'Erro ao processar decisão.',
        type: 'error'
      })
    } finally {
      setSubmitting(prev => ({ ...prev, [id]: false }))
    }
  }

  const getRiskLabel = (risco: number | undefined | null) => {
    if (risco === undefined || risco === null) return 'Manter'
    switch (risco) {
      case 0: return 'Emergência'
      case 1: return 'Urgência'
      case 2: return 'Prioridade'
      case 3: return 'Eletivo'
      case 4: return 'Especial'
      default: return 'Outros'
    }
  }

  const getRiskColor = (risco: number) => {
    switch (risco) {
      case 0: return 'bg-rose-500 text-white'
      case 1: return 'bg-red-500/10 text-red-500 border border-red-500/20'
      case 2: return 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
      case 3: return 'bg-teal-500/10 text-teal-500 border border-teal-500/20'
      case 4: return 'bg-purple-500/10 text-purple-500 border border-purple-500/20'
      default: return 'bg-muted text-muted-foreground'
    }
  }

  const getMovementTypeLabel = (tipo: string) => {
    switch (tipo) {
      case 'MUDANCA_RISCO': return 'Mudança de Risco'
      case 'MUDANCA_POSICAO': return 'Mudança de Posição'
      case 'AGRAVAMENTO_CLINICO': return 'Agravamento Clínico'
      case 'DESISTENCIA': return 'Desistência do Paciente'
      case 'OBITO': return 'Óbito do Paciente'
      case 'TRANSFERENCIA': return 'Transferência Hospitalar'
      default: return tipo
    }
  }

  return (
    <DashboardShell role={role} email={email}>
      <div className="space-y-8 max-w-5xl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-3xl font-black text-foreground tracking-tighter uppercase">
              Operações de <span className="text-primary italic">Movimentação</span>
            </h2>
            <p className="text-sm text-muted-foreground mt-2">
              Analise e aprove propostas de alterações na classificação de risco ou posição de pacientes na fila.
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 p-1.5 bg-muted/40 backdrop-blur-md rounded-2xl border border-border/30 w-fit">
          <button
            onClick={() => setActiveTab('PENDING')}
            className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${
              activeTab === 'PENDING' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Pendentes de Análise ({pendingMovs.length})
          </button>
          <button
            onClick={() => setActiveTab('HISTORY')}
            className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${
              activeTab === 'HISTORY' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Histórico Processado ({historyMovs.length})
          </button>
        </div>

        {/* Content List */}
        <div className="space-y-6">
          {activeTab === 'PENDING' ? (
            pendingMovs.length === 0 ? (
              <div className="bento-card p-12 text-center text-muted-foreground font-bold">
                Nenhuma movimentação pendente de aprovação.
              </div>
            ) : (
              pendingMovs.map((mov) => (
                <div key={mov.id} className="bento-card p-6 md:p-8 space-y-6 border-l-4 border-l-amber-500">
                  {/* Header do Cartão */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/10 pb-4">
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="px-2.5 py-1 text-[9px] font-black uppercase rounded bg-amber-500 text-white">
                          {getMovementTypeLabel(mov.tipo)}
                        </span>
                        <span className="text-[10px] font-black text-muted-foreground/60 font-mono">SOL: {mov.cod_solicitacao}</span>
                        <span className="text-[10px] text-muted-foreground/50 font-bold">
                          Proposto em: {new Date(mov.created_at).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                      <h3 className="text-lg font-black text-foreground uppercase mt-1">
                        {mov.solicitacao?.pacientes?.nome_usuario || 'Paciente Não Identificado'}
                      </h3>
                      <p className="text-[10px] text-muted-foreground/85 font-black uppercase tracking-widest">
                        Procedimento: {mov.solicitacao?.procedimentos?.desc_sigtap || 'Procedimento Não Identificado'}
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-3 shrink-0 text-xs font-bold text-muted-foreground">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                        <User className="h-4 w-4" />
                      </div>
                      <div>
                        <span className="text-[9px] text-muted-foreground/60 block uppercase leading-none">Proposto por</span>
                        <span className="text-foreground">{mov.solicitante?.nome || 'Operador'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Alteração Proposta Visual */}
                  <div className="bg-muted/30 p-5 rounded-2xl border border-border/10 space-y-4">
                    <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest block leading-none">Alterações Propostas</span>
                    
                    <div className="grid gap-6 sm:grid-cols-2">
                      {/* Risco */}
                      {mov.valor_novo.classificacao_risco !== undefined && (
                        <div className="flex items-center gap-4 bg-background/40 p-3.5 rounded-xl border border-border/10">
                          <div>
                            <span className="text-[8px] text-muted-foreground uppercase font-black tracking-widest block">Risco Anterior</span>
                            <span className={`inline-block px-2 py-0.5 text-[8px] font-black uppercase rounded mt-1.5 ${getRiskColor(mov.valor_anterior.classificacao_risco)}`}>
                              {getRiskLabel(mov.valor_anterior.classificacao_risco)}
                            </span>
                          </div>
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <span className="text-[8px] text-muted-foreground uppercase font-black tracking-widest block">Risco Proposto</span>
                            <span className={`inline-block px-2 py-0.5 text-[8px] font-black uppercase rounded mt-1.5 ${getRiskColor(mov.valor_novo.classificacao_risco)}`}>
                              {getRiskLabel(mov.valor_novo.classificacao_risco)}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Posição */}
                      {mov.valor_novo.posicao_fila !== undefined && (
                        <div className="flex items-center gap-4 bg-background/40 p-3.5 rounded-xl border border-border/10">
                          <div>
                            <span className="text-[8px] text-muted-foreground uppercase font-black tracking-widest block">Posição Anterior</span>
                            <span className="text-sm font-black text-foreground block mt-1.5">
                              {mov.valor_anterior.posicao_fila ? `${mov.valor_anterior.posicao_fila}º` : 'Sem Fila'}
                            </span>
                          </div>
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <span className="text-[8px] text-muted-foreground uppercase font-black tracking-widest block">Posição Proposta</span>
                            <span className="text-sm font-black text-primary block mt-1.5">
                              {mov.valor_novo.posicao_fila ? `${mov.valor_novo.posicao_fila}º` : 'Sem Fila'}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Justificativa */}
                  <div className="space-y-1.5">
                    <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest block leading-none">Justificativa da Proposta</span>
                    <div className="p-4 bg-muted/20 border border-border/10 rounded-2xl text-xs text-foreground leading-relaxed font-semibold">
                      {mov.justificativa}
                    </div>
                  </div>

                  {/* Formulário de Decisão (Apenas gestores) */}
                  {canApprove ? (
                    <div className="border-t border-border/10 pt-6 space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest block leading-none">Observações de Decisão (Opcional)</label>
                        <textarea
                          value={decisionNotes[mov.id] || ''}
                          onChange={(e) => setDecisionNotes({ ...decisionNotes, [mov.id]: e.target.value })}
                          rows={2}
                          className="block w-full rounded-xl border border-border/50 bg-background/50 py-2.5 px-3 text-xs outline-none focus:border-primary transition-all text-foreground"
                          placeholder="Digite aqui observações adicionais sobre o deferimento ou indeferimento da solicitação..."
                        />
                      </div>

                      <div className="flex justify-end gap-3">
                        <button
                          onClick={() => handleDecision(mov.id, 'REJECT')}
                          disabled={submitting[mov.id]}
                          className="px-5 py-3 border border-red-500/20 text-red-500 hover:bg-red-500/10 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all cursor-pointer disabled:opacity-50 flex items-center gap-2"
                        >
                          <X className="h-4 w-4" />
                          <span>Negar Proposta</span>
                        </button>
                        <button
                          onClick={() => handleDecision(mov.id, 'APPROVE')}
                          disabled={submitting[mov.id]}
                          className="px-5 py-3 bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all cursor-pointer disabled:opacity-50 flex items-center gap-2"
                        >
                          <Check className="h-4 w-4" />
                          <span>Aprovar e Aplicar</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground bg-muted/30 p-4 rounded-xl border border-border/5">
                      <AlertCircle className="h-4 w-4 text-amber-500" />
                      <span>Sua conta de operador não possui privilégios para aprovar ou rejeitar movimentações na fila.</span>
                    </div>
                  )}
                </div>
              ))
            )
          ) : (
            historyMovs.length === 0 ? (
              <div className="bento-card p-12 text-center text-muted-foreground font-bold">
                Nenhuma movimentação no histórico.
              </div>
            ) : (
              historyMovs.map((mov) => (
                <div key={mov.id} className="bento-card p-6 md:p-8 space-y-6">
                  {/* Header do Cartão */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/10 pb-4">
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="px-2.5 py-1 text-[9px] font-black uppercase rounded bg-muted text-muted-foreground border border-border">
                          {getMovementTypeLabel(mov.tipo)}
                        </span>
                        <span className="text-[10px] font-black text-muted-foreground/60 font-mono">SOL: {mov.cod_solicitacao}</span>
                        {mov.status === 'APROVADO' ? (
                          <span className="px-2.5 py-1 text-[9px] font-black uppercase rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center gap-1">
                            <ShieldCheck className="h-3.5 w-3.5" />
                            Aprovado
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 text-[9px] font-black uppercase rounded bg-rose-500/10 text-rose-500 border border-rose-500/20 flex items-center gap-1">
                            <ShieldAlert className="h-3.5 w-3.5" />
                            Rejeitado
                          </span>
                        )}
                      </div>
                      <h3 className="text-lg font-black text-foreground uppercase mt-1">
                        {mov.solicitacao?.pacientes?.nome_usuario || 'Paciente Não Identificado'}
                      </h3>
                      <p className="text-[10px] text-muted-foreground/85 font-black uppercase tracking-widest">
                        Procedimento: {mov.solicitacao?.procedimentos?.desc_sigtap || 'Procedimento Não Identificado'}
                      </p>
                    </div>

                    <div className="flex items-center gap-6 shrink-0">
                      <div className="flex items-center gap-2.5 text-xs font-bold text-muted-foreground">
                        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                          <User className="h-4 w-4" />
                        </div>
                        <div>
                          <span className="text-[8px] text-muted-foreground/50 block uppercase leading-none">Proposto por</span>
                          <span>{mov.solicitante?.nome || 'Operador'}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 text-xs font-bold text-muted-foreground">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                          <User className="h-4 w-4" />
                        </div>
                        <div>
                          <span className="text-[8px] text-muted-foreground/50 block uppercase leading-none">Analisado por</span>
                          <span>{mov.aprovador?.nome || 'Regulador'}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Alteração Proposta Visual */}
                  <div className="bg-muted/10 p-5 rounded-2xl border border-border/10 space-y-4">
                    <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest block leading-none">Alterações Solicitadas</span>
                    
                    <div className="grid gap-6 sm:grid-cols-2">
                      {/* Risco */}
                      {mov.valor_novo.classificacao_risco !== undefined && (
                        <div className="flex items-center gap-4 bg-background/40 p-3.5 rounded-xl border border-border/10">
                          <div>
                            <span className="text-[8px] text-muted-foreground uppercase font-black tracking-widest block">Risco Anterior</span>
                            <span className={`inline-block px-2 py-0.5 text-[8px] font-black uppercase rounded mt-1.5 ${getRiskColor(mov.valor_anterior.classificacao_risco)}`}>
                              {getRiskLabel(mov.valor_anterior.classificacao_risco)}
                            </span>
                          </div>
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <span className="text-[8px] text-muted-foreground uppercase font-black tracking-widest block">Risco Proposto</span>
                            <span className={`inline-block px-2 py-0.5 text-[8px] font-black uppercase rounded mt-1.5 ${getRiskColor(mov.valor_novo.classificacao_risco)}`}>
                              {getRiskLabel(mov.valor_novo.classificacao_risco)}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Posição */}
                      {mov.valor_novo.posicao_fila !== undefined && (
                        <div className="flex items-center gap-4 bg-background/40 p-3.5 rounded-xl border border-border/10">
                          <div>
                            <span className="text-[8px] text-muted-foreground uppercase font-black tracking-widest block">Posição Anterior</span>
                            <span className="text-sm font-black text-foreground block mt-1.5">
                              {mov.valor_anterior.posicao_fila ? `${mov.valor_anterior.posicao_fila}º` : 'Sem Fila'}
                            </span>
                          </div>
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <span className="text-[8px] text-muted-foreground uppercase font-black tracking-widest block">Posição Proposta</span>
                            <span className="text-sm font-black text-primary block mt-1.5">
                              {mov.valor_novo.posicao_fila ? `${mov.valor_novo.posicao_fila}º` : 'Sem Fila'}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Justificativa e Observações de Decisão */}
                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest block leading-none">Justificativa</span>
                      <div className="p-4 bg-muted/20 border border-border/5 rounded-2xl text-xs text-muted-foreground leading-relaxed font-semibold">
                        {mov.justificativa}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest block leading-none">Observações de Decisão</span>
                      <div className="p-4 bg-muted/30 border border-border/10 rounded-2xl text-xs text-foreground leading-relaxed font-semibold">
                        {mov.observacoes_decisao || 'Nenhuma observação informada.'}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )
          )}
        </div>
      </div>
    </DashboardShell>
  )
}
