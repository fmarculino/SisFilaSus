'use client'

import React, { useState } from 'react'
import { searchCitizenWaitlist } from './actions'
import { 
  Search, Shield, ClipboardList, Info, AlertTriangle, 
  Loader2, ArrowLeft, Stethoscope, HeartHandshake, EyeOff, User
} from 'lucide-react'
import Link from 'next/link'

export default function PortalCidadaoPage() {
  const [identifier, setIdentifier] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<any | null>(null)

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!identifier.trim()) return

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const data = await searchCitizenWaitlist(identifier)
      setResult(data)
    } catch (err: any) {
      setError(err.message || 'Erro ao realizar a busca.')
    } finally {
      setLoading(false)
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'NA_FILA': return 'Aguardando na Fila'
      case 'EM_CONVOCACAO': return 'Convocado (Busca Ativa)'
      case 'CONVOCADO_CONFIRMADO': return 'Confirmado / Agendado'
      case 'CONVOCADO_RECUSOU': return 'Recusou Atendimento'
      case 'SEM_CONTATO': return 'Sem Contato (Nova Tentativa)'
      case 'ABSENTEISMO': return 'Faltou ao Agendamento'
      case 'INTERNADO': return 'Internado'
      case 'PROCEDIMENTO_REALIZADO': return 'Procedimento Realizado'
      case 'ALTA': return 'Alta da Regulação'
      case 'DESISTENCIA': return 'Desistência'
      case 'OBITO': return 'Óbito'
      case 'NAO_ENCONTRADO_SISREG': return 'Pendente de Atualização no SISREG'
      default: return 'Em Fila'
    }
  }

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'NA_FILA': return 'bg-muted text-muted-foreground border-border'
      case 'EM_CONVOCACAO': return 'bg-blue-500/10 text-blue-500 border-blue-500/20'
      case 'CONVOCADO_CONFIRMADO': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
      case 'CONVOCADO_RECUSOU': return 'bg-rose-500/10 text-rose-500 border-rose-500/20'
      case 'SEM_CONTATO': return 'bg-amber-500/10 text-amber-500 border-amber-500/20'
      default: return 'bg-muted text-muted-foreground'
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-muted/50 via-background to-background flex flex-col justify-between selection:bg-primary selection:text-primary-foreground">
      {/* Header */}
      <header className="max-w-6xl w-full mx-auto px-6 py-8 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-primary flex items-center justify-center text-primary-foreground shadow-lg shadow-primary/20">
            <Stethoscope className="h-5.5 w-5.5" />
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-black tracking-tighter leading-none">SisFilaSus</span>
            <span className="text-[9px] font-black text-primary uppercase tracking-widest mt-0.5">Portal do Cidadão</span>
          </div>
        </div>

        <Link 
          href="/login" 
          className="px-4 py-2 border border-border/40 hover:bg-muted/50 rounded-xl text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-foreground transition-all"
        >
          Área Restrita
        </Link>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-3xl w-full mx-auto px-6 py-12 flex flex-col justify-center gap-8">
        
        {/* Banner de Boas Vindas */}
        <div className="text-center space-y-4">
          <span className="px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 text-[9px] font-black uppercase tracking-widest">
            Transparência Pública
          </span>
          <h1 className="text-4xl md:text-5xl font-black text-foreground tracking-tighter uppercase leading-none">
            Consulte sua <span className="text-primary italic">Posição na Fila</span>
          </h1>
          <p className="text-sm text-muted-foreground max-w-lg mx-auto">
            Digite seu CPF ou Cartão Nacional de Saúde (CNS) para acompanhar o status e o andamento do seu procedimento cirúrgico ou consulta eletiva.
          </p>
        </div>

        {/* Caixa de Busca */}
        <div className="bento-card p-6 md:p-8 space-y-6">
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="group">
              <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2 px-1">CPF ou CNS</label>
              <div className="relative">
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="block w-full rounded-2xl border border-border/50 bg-background/50 py-4 px-5 pr-12 text-xs text-foreground outline-none focus:border-primary transition-all placeholder:text-muted-foreground/50 font-mono tracking-wider"
                  placeholder="Ex: 123.456.789-00 ou 898xxxxxxxxxxxx"
                  disabled={loading}
                />
                <button
                  type="submit"
                  disabled={loading || !identifier.trim()}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-2.5 rounded-xl bg-primary text-primary-foreground hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer shadow-md shadow-primary/10"
                >
                  {loading ? (
                    <Loader2 className="h-4.5 w-4.5 animate-spin" />
                  ) : (
                    <Search className="h-4.5 w-4.5" />
                  )}
                </button>
              </div>
            </div>
          </form>

          {/* Aviso sobre LGPD */}
          <div className="flex gap-3 p-4 bg-muted/20 border border-border/10 rounded-2xl text-[10px] font-semibold text-muted-foreground leading-relaxed">
            <EyeOff className="h-5 w-5 text-primary shrink-0" />
            <p>
              <strong>Privacidade e LGPD:</strong> Em conformidade com a Lei Geral de Proteção de Dados, os nomes e dados de identificação pessoal estão parcialmente ocultados. Não exibimos diagnósticos ou CIDs nesta consulta pública.
            </p>
          </div>
        </div>

        {/* Erro */}
        {error && (
          <div className="flex gap-3 p-4 bg-rose-500/5 text-rose-500 border border-rose-500/20 rounded-2xl text-xs font-semibold leading-relaxed">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Resultado */}
        {result && (
          <div className="space-y-6 animate-in">
            {/* Ficha do Cidadão */}
            <div className="bento-card p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-primary/5 border-primary/20">
              <div className="flex items-center gap-4">
                <div className="h-11 w-11 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                  <User className="h-5 w-5" />
                </div>
                <div>
                  <span className="text-[8px] font-black text-primary uppercase tracking-widest block leading-none">Paciente Identificado</span>
                  <h3 className="text-base font-black text-foreground uppercase mt-1.5">{result.patient.nome}</h3>
                </div>
              </div>

              <div className="flex gap-6 text-[10px] font-bold text-muted-foreground font-mono">
                <div>
                  <span className="text-[8px] text-muted-foreground/60 uppercase font-black tracking-widest block leading-none">CPF</span>
                  <span className="text-foreground block mt-1">{result.patient.cpf || 'Não Informado'}</span>
                </div>
                <div>
                  <span className="text-[8px] text-muted-foreground/60 uppercase font-black tracking-widest block leading-none">CNS</span>
                  <span className="text-foreground block mt-1">{result.patient.cns}</span>
                </div>
              </div>
            </div>

            {/* Lista de Procedimentos na Fila */}
            <div className="space-y-4">
              <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-1 block leading-none">Minhas Solicitações Ativas</span>
              
              {result.solicitacoes.length === 0 ? (
                <div className="bento-card p-8 text-center text-muted-foreground text-xs font-bold border-dashed">
                  Você não possui solicitações de cirurgias ou exames ativas na fila da regulação municipal no momento.
                </div>
              ) : (
                result.solicitacoes.map((sol: any) => (
                  <div key={sol.cod_solicitacao} className="bento-card p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 border border-border/30 hover:border-primary/20 transition-all duration-300">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-3">
                        <span className={`px-2 py-0.5 text-[8px] font-black uppercase rounded border ${getStatusBadgeClass(sol.status_interno)}`}>
                          {getStatusLabel(sol.status_interno)}
                        </span>
                        <span className="text-[9px] font-bold text-muted-foreground font-mono">Cod: {sol.cod_solicitacao}</span>
                      </div>
                      <h4 className="text-sm font-black text-foreground uppercase leading-tight">{sol.procedimento}</h4>
                      <p className="text-[10px] font-bold text-muted-foreground/75">
                        Solicitado em: {new Date(sol.data_solicitacao).toLocaleDateString('pt-BR')}
                      </p>
                    </div>

                    <div className="flex flex-row md:flex-col items-center md:items-end justify-between md:justify-center border-t md:border-t-0 border-border/10 pt-4 md:pt-0 shrink-0">
                      <div className="text-left md:text-right">
                        <span className="text-[8px] text-muted-foreground/60 font-black uppercase tracking-widest block leading-none">Posição na Fila</span>
                        {sol.posicao_fila ? (
                          <span className="text-3xl font-black text-primary tracking-tighter block mt-1">
                            {sol.posicao_fila}º
                          </span>
                        ) : (
                          <span className="text-xs font-black text-emerald-500 uppercase tracking-widest block mt-1.5">
                            Autorizado / Agendado
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="py-8 border-t border-border/20 text-center text-[10px] font-bold text-muted-foreground/60 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-1">
            <HeartHandshake className="h-4 w-4 text-primary shrink-0" />
            <span>Secretaria Municipal de Saúde — Prefeitura de Marabá, PA</span>
          </div>
          <span>Desenvolvido para Transparência no SUS © 2026</span>
        </div>
      </footer>
    </div>
  )
}
