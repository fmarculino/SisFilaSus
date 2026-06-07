'use client'

import React, { useState } from 'react'
import { DashboardShell } from '@/components/layout/DashboardShell'
import { 
  Check, AlertTriangle, Search, Activity, User, FileText, 
  HelpCircle, RefreshCw
} from 'lucide-react'
import { resolveDivergenciaAction } from './actions'

interface Divergencia {
  id: string
  tipo_divergencia: string
  status_sisreg_importado: string | null
  status_interno_local: string
  created_at: string
  solicitacao: {
    cod_solicitacao: number
    posicao_fila: number | null
    pacientes: {
      nome_usuario: string
      cns_usuario: string
      cpf_usuario: string | null
    }
    procedimentos: {
      cod_sigtap: string
      desc_sigtap: string
    }
  }
}

interface SincronizacaoClientProps {
  role: string
  email: string
  initialDivergencias: Divergencia[]
}

export function SincronizacaoClient({
  role,
  email,
  initialDivergencias
}: SincronizacaoClientProps) {
  const [divergencias, setDivergencias] = useState<Divergencia[]>(initialDivergencias)
  const [search, setSearch] = useState('')
  const [filterTipo, setFilterTipo] = useState('')
  const [resolvingId, setResolvingId] = useState<string | null>(null)

  const handleResolve = async (id: string, codSol: number) => {
    if (!confirm(`Confirmar que a solicitação Nº ${codSol} foi atualizada no SISREG III e marcar esta divergência como resolvida?`)) {
      return
    }

    setResolvingId(id)
    try {
      const res = await resolveDivergenciaAction(id)
      if (res.success) {
        alert('Divergência marcada como resolvida com sucesso!')
        setDivergencias(prev => prev.filter(d => d.id !== id))
      } else {
        alert(res.error || 'Erro ao resolver divergência.')
      }
    } catch (err: any) {
      alert(err.message || 'Erro inesperado ao resolver.')
    } finally {
      setResolvingId(null)
    }
  }

  // Contadores
  const totalObitos = divergencias.filter(d => d.tipo_divergencia === 'OBITO_ATIVO').length
  const totalDesistencias = divergencias.filter(d => d.tipo_divergencia === 'DESISTENCIA_ATIVA').length
  const totalRecusas = divergencias.filter(d => d.tipo_divergencia === 'RECUSA_ATIVA').length
  const totalInternados = divergencias.filter(d => d.tipo_divergencia === 'INTERNADO_ATIVO').length

  // Filtragem
  const filtered = divergencias.filter(d => {
    const nome = d.solicitacao.pacientes.nome_usuario.toLowerCase()
    const cod = d.solicitacao.cod_solicitacao.toString()
    const matchesSearch = nome.includes(search.toLowerCase()) || cod.includes(search)
    const matchesTipo = filterTipo === '' || d.tipo_divergencia === filterTipo
    return matchesSearch && matchesTipo
  })

  const getDivergenciaBadge = (tipo: string) => {
    switch (tipo) {
      case 'OBITO_ATIVO':
        return (
          <div className="flex flex-col gap-1">
            <span className="px-2.5 py-1 text-[9px] font-black uppercase rounded-lg bg-rose-500/10 text-rose-500 border border-rose-500/20 w-fit">Óbito Ativo no SISREG</span>
            <span className="text-[10px] text-muted-foreground/80 font-bold">Solicitação deve ser cancelada por Óbito.</span>
          </div>
        )
      case 'DESISTENCIA_ATIVA':
        return (
          <div className="flex flex-col gap-1">
            <span className="px-2.5 py-1 text-[9px] font-black uppercase rounded-lg bg-amber-500/10 text-amber-500 border border-amber-500/20 w-fit">Desistência Ativa no SISREG</span>
            <span className="text-[10px] text-muted-foreground/80 font-bold">Solicitação deve ser cancelada por Desistência.</span>
          </div>
        )
      case 'RECUSA_ATIVA':
        return (
          <div className="flex flex-col gap-1">
            <span className="px-2.5 py-1 text-[9px] font-black uppercase rounded-lg bg-purple-500/10 text-purple-500 border border-purple-500/20 w-fit">Recusa Ativa no SISREG</span>
            <span className="text-[10px] text-muted-foreground/80 font-bold">Paciente recusou ou já realizou de forma particular.</span>
          </div>
        )
      case 'INTERNADO_ATIVO':
        return (
          <div className="flex flex-col gap-1">
            <span className="px-2.5 py-1 text-[9px] font-black uppercase rounded-lg bg-blue-500/10 text-blue-500 border border-blue-500/20 w-fit">Internado Ativo no SISREG</span>
            <span className="text-[10px] text-muted-foreground/80 font-bold">Paciente internado localmente, mas ativo na fila de espera.</span>
          </div>
        )
      default:
        return <span className="px-2.5 py-1 text-[9px] font-black uppercase rounded-lg bg-muted text-muted-foreground">Conflito de Status</span>
    }
  }

  const getStatusLocalBadge = (status: string) => {
    switch (status) {
      case 'OBITO': return <span className="px-2 py-0.5 rounded bg-rose-500 text-white font-bold text-[9px] uppercase">Óbito</span>
      case 'DESISTENCIA': return <span className="px-2 py-0.5 rounded bg-gray-500 text-white font-bold text-[9px] uppercase">Desistência</span>
      case 'CONVOCADO_RECUSOU': return <span className="px-2 py-0.5 rounded bg-zinc-500 text-white font-bold text-[9px] uppercase">Recusou</span>
      case 'INTERNADO': return <span className="px-2 py-0.5 rounded bg-indigo-500 text-white font-bold text-[9px] uppercase">Internado</span>
      case 'ENCAMINHADO': return <span className="px-2 py-0.5 rounded bg-sky-500 text-white font-bold text-[9px] uppercase">Encaminhado</span>
      default: return <span className="px-2 py-0.5 rounded bg-muted text-muted-foreground font-bold text-[9px] uppercase">{status}</span>
    }
  }

  return (
    <DashboardShell role={role} email={email}>
      <div className="space-y-8">
        
        {/* Header */}
        <div>
          <h2 className="text-3xl font-black text-foreground tracking-tighter uppercase">
            Sincronização <span className="text-primary italic">SISREG III</span>
          </h2>
          <p className="text-sm text-muted-foreground mt-2">
            Compare e saneie divergências críticas entre o SisFilaSus e a base oficial do SISREG.
          </p>
        </div>

        {/* Bento Cards de Indicadores */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          
          <div className="bento-card p-5 border-l-4 border-rose-500 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Óbitos Ativos</span>
              <p className="text-2xl font-black text-foreground mt-1">{totalObitos}</p>
            </div>
            <div className="h-10 w-10 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </div>

          <div className="bento-card p-5 border-l-4 border-amber-500 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Desistências</span>
              <p className="text-2xl font-black text-foreground mt-1">{totalDesistencias}</p>
            </div>
            <div className="h-10 w-10 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </div>

          <div className="bento-card p-5 border-l-4 border-purple-500 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Recusas na Fila</span>
              <p className="text-2xl font-black text-foreground mt-1">{totalRecusas}</p>
            </div>
            <div className="h-10 w-10 rounded-2xl bg-purple-500/10 text-purple-500 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </div>

          <div className="bento-card p-5 border-l-4 border-blue-500 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Internados Ativos</span>
              <p className="text-2xl font-black text-foreground mt-1">{totalInternados}</p>
            </div>
            <div className="h-10 w-10 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
              <Activity className="h-5 w-5" />
            </div>
          </div>

        </div>

        {/* Bento de Filtros */}
        <div className="bento-card p-6 md:p-8">
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="group">
              <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2 px-1">Buscar Paciente</label>
              <div className="relative">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="block w-full rounded-2xl border border-border/50 bg-background/50 py-3.5 px-4 pr-10 text-xs text-foreground outline-none focus:border-primary transition-all placeholder:text-muted-foreground/50"
                  placeholder="Nome ou Nº Solicitação..."
                />
                <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-muted-foreground/40" />
              </div>
            </div>

            <div className="group">
              <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2 px-1">Tipo de Divergência</label>
              <select
                value={filterTipo}
                onChange={(e) => setFilterTipo(e.target.value)}
                className="block w-full rounded-2xl border border-border/50 bg-background/50 py-3.5 px-4 text-xs text-foreground outline-none focus:border-primary transition-all"
              >
                <option value="">Todas as Divergências</option>
                <option value="OBITO_ATIVO">Óbitos Ativos</option>
                <option value="DESISTENCIA_ATIVA">Desistências Ativas</option>
                <option value="RECUSA_ATIVA">Recusas Ativas</option>
                <option value="INTERNADO_ATIVO">Internados Ativos</option>
              </select>
            </div>
          </div>
        </div>

        {/* Tabela de Divergências */}
        <div className="bento-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border/20 bg-muted/20 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                  <th className="py-5 px-6">Solicitação</th>
                  <th className="py-5 px-6">Paciente</th>
                  <th className="py-5 px-6">Procedimento</th>
                  <th className="py-5 px-6">Divergência Detectada</th>
                  <th className="py-5 px-6">Status (Local vs SISREG)</th>
                  <th className="py-5 px-6 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/10 text-xs font-semibold">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-muted-foreground font-bold">
                      Nenhuma divergência de sincronização pendente encontrada.
                    </td>
                  </tr>
                ) : (
                  filtered.map((d) => (
                    <tr key={d.id} className="hover:bg-muted/5 transition-colors">
                      <td className="py-4 px-6 font-mono text-muted-foreground">{d.solicitacao.cod_solicitacao}</td>
                      <td className="py-4 px-6">
                        <div className="flex flex-col">
                          <span className="font-bold text-foreground text-sm uppercase">{d.solicitacao.pacientes.nome_usuario}</span>
                          <span className="text-[10px] text-muted-foreground/60 font-mono mt-0.5">
                            CNS: {d.solicitacao.pacientes.cns_usuario}
                            {d.solicitacao.pacientes.cpf_usuario && ` | CPF: ${d.solicitacao.pacientes.cpf_usuario}`}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-6 max-w-xs truncate">
                        <div className="flex flex-col">
                          <span className="truncate">{d.solicitacao.procedimentos.desc_sigtap.trim()}</span>
                          <span className="text-[9px] text-muted-foreground/60 font-mono">SIGTAP: {d.solicitacao.procedimentos.cod_sigtap}</span>
                        </div>
                      </td>
                      <td className="py-4 px-6">{getDivergenciaBadge(d.tipo_divergencia)}</td>
                      <td className="py-4 px-6">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground">
                            <span>Local:</span>
                            {getStatusLocalBadge(d.status_interno_local)}
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground">
                            <span>SISREG:</span>
                            <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20 text-[9px] font-bold uppercase">
                              {d.status_sisreg_importado || 'ATIVO'} {d.solicitacao.posicao_fila && `(${d.solicitacao.posicao_fila}º)`}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <button
                          onClick={() => handleResolve(d.id, d.solicitacao.cod_solicitacao)}
                          disabled={resolvingId === d.id}
                          className="px-4 py-2.5 rounded-xl bg-emerald-500 text-white hover:bg-emerald-600 transition-all font-black uppercase text-[9px] tracking-wider disabled:opacity-40 flex items-center gap-1.5 ml-auto cursor-pointer"
                        >
                          {resolvingId === d.id ? (
                            <>
                              <RefreshCw className="h-3 w-3 animate-spin" />
                              <span>Salvando...</span>
                            </>
                          ) : (
                            <>
                              <Check className="h-3.5 w-3.5" />
                              <span>Sincronizado</span>
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </DashboardShell>
  )
}
