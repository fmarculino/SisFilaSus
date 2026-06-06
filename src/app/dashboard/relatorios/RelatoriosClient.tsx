'use client'

import React, { useState } from 'react'
import { DashboardShell } from '@/components/layout/DashboardShell'
import { 
  BarChart3, Clock, Users, Activity, CheckCircle2, AlertTriangle, 
  Search, ShieldAlert, PhoneCall, HeartPulse, RefreshCw
} from 'lucide-react'

interface RelatoriosClientProps {
  role: string
  email: string
  esperaProcedimento: any[]
  esperaRisco: any[]
  produtividadeOperador: any[]
  statusDistribuicao: any[]
}

type TabType = 'resumo' | 'procedimento' | 'risco' | 'produtividade' | 'status'

export function RelatoriosClient({
  role,
  email,
  esperaProcedimento,
  esperaRisco,
  produtividadeOperador,
  statusDistribuicao,
}: RelatoriosClientProps) {
  const [activeTab, setActiveTab] = useState<TabType>('resumo')
  const [searchQuery, setSearchQuery] = useState('')

  // 1. Cálculos de KPIs gerais
  const totalPacientesFila = statusDistribuicao.reduce((acc, curr) => acc + (curr.total || 0), 0)
  
  // Total de contatos na equipe
  const totalContatos = produtividadeOperador.reduce((acc, curr) => acc + (curr.total_contatos || 0), 0)
  const totalSucessos = produtividadeOperador.reduce((acc, curr) => acc + (curr.contatos_sucesso || 0), 0)
  const taxaSucessoEquipe = totalContatos > 0 ? ((totalSucessos / totalContatos) * 100) : 0

  // Média de tempo de espera ponderada (procedimentos)
  const totalPacientesComTempo = esperaProcedimento.reduce((acc, curr) => acc + (curr.total_pacientes || 0), 0)
  const somaPonderadaEspera = esperaProcedimento.reduce((acc, curr) => acc + ((curr.media_espera_anos || 0) * (curr.total_pacientes || 0)), 0)
  const mediaEsperaGeralAnos = totalPacientesComTempo > 0 ? (somaPonderadaEspera / totalPacientesComTempo) : 0

  const formatYears = (years: number) => {
    if (years === 0) return '0 dias'
    const totalDays = Math.round(years * 365.25)
    if (totalDays < 30) {
      return `${totalDays} ${totalDays === 1 ? 'dia' : 'dias'}`
    }
    const months = Math.floor(totalDays / 30.4375)
    const remainingDays = Math.round(totalDays % 30.4375)
    
    if (months < 12) {
      return `${months} ${months === 1 ? 'mês' : 'meses'}${remainingDays > 0 ? ` e ${remainingDays}d` : ''}`
    }
    
    const displayYears = Math.floor(months / 12)
    const remainingMonths = months % 12
    return `${displayYears} ${displayYears === 1 ? 'ano' : 'anos'}${remainingMonths > 0 ? ` e ${remainingMonths}m` : ''}`
  }

  // Controle de Ordenação e Paginação (Espera por Procedimento)
  const [procedSortBy, setProcedSortBy] = useState<'cod_sigtap' | 'desc_sigtap' | 'total_pacientes' | 'media_espera_anos'>('total_pacientes')
  const [procedSortOrder, setProcedSortOrder] = useState<'asc' | 'desc'>('desc')
  const [procedPage, setProcedPage] = useState(1)
  const [procedLimit, setProcedLimit] = useState(15)

  const handleSort = (column: 'cod_sigtap' | 'desc_sigtap' | 'total_pacientes' | 'media_espera_anos') => {
    if (procedSortBy === column) {
      setProcedSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setProcedSortBy(column)
      setProcedSortOrder('desc')
    }
    setProcedPage(1)
  }

  // Filtragem local para os procedimentos
  const filteredProcedimentos = esperaProcedimento.filter(p => 
    p.desc_sigtap.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.cod_sigtap.includes(searchQuery)
  )

  // Ordenação local
  const sortedProcedimentos = [...filteredProcedimentos].sort((a, b) => {
    let valA = a[procedSortBy]
    let valB = b[procedSortBy]

    if (valA === undefined || valA === null) return 1
    if (valB === undefined || valB === null) return -1

    if (typeof valA === 'string') {
      return procedSortOrder === 'asc'
        ? valA.localeCompare(valB)
        : valB.localeCompare(valA)
    } else {
      return procedSortOrder === 'asc'
        ? valA - valB
        : valB - valA
    }
  })

  // Paginação local
  const totalProcedItems = sortedProcedimentos.length
  const totalProcedPages = Math.ceil(totalProcedItems / procedLimit)
  const startIndex = (procedPage - 1) * procedLimit
  const paginatedProcedimentos = sortedProcedimentos.slice(startIndex, startIndex + procedLimit)

  const getPageNumbers = () => {
    const pages = []
    const range = 1
    for (let i = 1; i <= totalProcedPages; i++) {
      if (i === 1 || i === totalProcedPages || (i >= procedPage - range && i <= procedPage + range)) {
        pages.push(i)
      } else if (pages[pages.length - 1] !== '...') {
        pages.push('...')
      }
    }
    return pages
  }

  const getRiskLabel = (risco: number) => {
    switch (risco) {
      case 0: return { label: 'Emergência', color: 'bg-rose-500 text-white border-rose-600', barBg: 'bg-rose-500' }
      case 1: return { label: 'Urgência', color: 'bg-red-500/10 text-red-500 border-red-500/20', barBg: 'bg-red-500' }
      case 2: return { label: 'Prioridade', color: 'bg-amber-500/10 text-amber-500 border-amber-500/20', barBg: 'bg-amber-500' }
      case 3: return { label: 'Eletivo', color: 'bg-teal-500/10 text-teal-500 border-teal-500/20', barBg: 'bg-teal-500' }
      case 4: return { label: 'Especial', color: 'bg-purple-500/10 text-purple-500 border-purple-500/20', barBg: 'bg-purple-500' }
      default: return { label: 'Eletivo', color: 'bg-muted/10 text-muted-foreground border-muted/20', barBg: 'bg-muted' }
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'NA_FILA': return { label: 'Na Fila', color: 'bg-muted text-muted-foreground border-border' }
      case 'EM_CONVOCACAO': return { label: 'Em Convocação', color: 'bg-blue-500/10 text-blue-500 border-blue-500/20' }
      case 'CONVOCADO_CONFIRMADO': return { label: 'Confirmado', color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' }
      case 'CONVOCADO_RECUSOU': return { label: 'Recusou', color: 'bg-rose-500/10 text-rose-500 border-rose-500/20' }
      case 'SEM_CONTATO': return { label: 'Sem Contato', color: 'bg-amber-500/10 text-amber-500 border-amber-500/20' }
      case 'ABSENTEISMO': return { label: 'Absenteísmo', color: 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20' }
      case 'INTERNADO': return { label: 'Internado', color: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20' }
      case 'PROCEDIMENTO_REALIZADO': return { label: 'Realizado', color: 'bg-teal-500/10 text-teal-500 border-teal-500/20' }
      case 'ALTA': return { label: 'Alta', color: 'bg-emerald-500 text-white' }
      case 'DESISTENCIA': return { label: 'Desistência', color: 'bg-gray-500/10 text-gray-500 border-gray-500/20' }
      case 'OBITO': return { label: 'Óbito', color: 'bg-black text-white' }
      case 'NAO_ENCONTRADO_SISREG': return { label: 'Fora do SISREG', color: 'bg-amber-500 text-white border-amber-600' }
      default: return { label: 'Desconhecido', color: 'bg-muted text-muted-foreground border-border' }
    }
  }

  return (
    <DashboardShell role={role} email={email}>
      <div className="space-y-8">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-3xl font-black text-foreground tracking-tighter uppercase">
              Relatórios <span className="text-primary italic">Gerenciais</span>
            </h2>
            <p className="text-sm text-muted-foreground mt-2">
              Métricas agregadas em tempo real para tomada de decisão e auditoria de produtividade.
            </p>
          </div>
        </div>

        {/* Row de KPIs Gerais */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          
          <div className="bento-card p-6 flex items-center justify-between border-l-4 border-l-primary">
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Pacientes Regulados</span>
              <p className="text-2xl font-black text-foreground">{totalPacientesFila.toLocaleString('pt-BR')}</p>
              <p className="text-[10px] text-muted-foreground font-semibold">Total na base ativa da fila</p>
            </div>
            <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
              <Activity className="h-6 w-6" />
            </div>
          </div>

          <div className="bento-card p-6 flex items-center justify-between border-l-4 border-l-amber-500">
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Espera Média Geral</span>
              <p className="text-2xl font-black text-foreground">{formatYears(mediaEsperaGeralAnos)}</p>
              <p className="text-[10px] text-muted-foreground font-semibold">Ponderado por volume de fila</p>
            </div>
            <div className="h-12 w-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500">
              <Clock className="h-6 w-6" />
            </div>
          </div>

          <div className="bento-card p-6 flex items-center justify-between border-l-4 border-l-teal-500">
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Contatos Realizados</span>
              <p className="text-2xl font-black text-foreground">{totalContatos.toLocaleString('pt-BR')}</p>
              <p className="text-[10px] text-muted-foreground font-semibold">Histórico acumulado de contatos</p>
            </div>
            <div className="h-12 w-12 rounded-2xl bg-teal-500/10 flex items-center justify-center text-teal-500">
              <PhoneCall className="h-6 w-6" />
            </div>
          </div>

          <div className="bento-card p-6 flex items-center justify-between border-l-4 border-l-emerald-500">
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Taxa de Confirmação</span>
              <p className="text-2xl font-black text-foreground">{taxaSucessoEquipe.toFixed(1)}%</p>
              <p className="text-[10px] text-muted-foreground font-semibold">Sucesso nas buscas ativas</p>
            </div>
            <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
              <CheckCircle2 className="h-6 w-6" />
            </div>
          </div>

        </div>

        {/* Tabs de Navegação */}
        <div className="flex border-b border-border/15 overflow-x-auto pb-px gap-2">
          <button
            onClick={() => setActiveTab('resumo')}
            className={`px-5 py-3 border-b-2 text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'resumo'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Resumo Geral
          </button>
          <button
            onClick={() => setActiveTab('procedimento')}
            className={`px-5 py-3 border-b-2 text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'procedimento'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Espera por Procedimento
          </button>
          <button
            onClick={() => setActiveTab('risco')}
            className={`px-5 py-3 border-b-2 text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'risco'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Espera por Risco
          </button>
          <button
            onClick={() => setActiveTab('produtividade')}
            className={`px-5 py-3 border-b-2 text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'produtividade'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Produtividade da Equipe
          </button>
          <button
            onClick={() => setActiveTab('status')}
            className={`px-5 py-3 border-b-2 text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'status'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Status da Fila
          </button>
        </div>

        {/* Conteúdo da Tab */}
        <div className="space-y-6">
          
          {/* TAB 1: RESUMO GERAL */}
          {activeTab === 'resumo' && (
            <div className="grid gap-6 md:grid-cols-2">
              
              {/* Card de Informações/Gráfico Risco */}
              <div className="bento-card p-6 md:p-8 space-y-6">
                <div className="flex items-center gap-2 text-foreground">
                  <ShieldAlert className="h-5 w-5 text-primary" />
                  <h3 className="text-sm font-black uppercase tracking-wider">Distribuição Operacional por Risco</h3>
                </div>
                <div className="space-y-4">
                  {esperaRisco.length === 0 ? (
                    <p className="text-xs text-muted-foreground font-bold">Nenhum dado cadastrado.</p>
                  ) : (
                    esperaRisco.map(r => {
                      const riskCfg = getRiskLabel(r.classificacao_risco)
                      const pct = totalPacientesFila > 0 ? ((r.total_pacientes / totalPacientesFila) * 100) : 0
                      return (
                        <div key={r.classificacao_risco} className="space-y-2">
                          <div className="flex items-center justify-between text-xs font-semibold">
                            <span className={`px-2 py-0.5 text-[9px] font-black uppercase rounded-lg border ${riskCfg.color}`}>
                              {riskCfg.label}
                            </span>
                            <span className="text-foreground">
                              {r.total_pacientes.toLocaleString('pt-BR')} pac. ({pct.toFixed(1)}%)
                            </span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${riskCfg.barBg}`} 
                              style={{ width: `${pct}%` }} 
                            />
                          </div>
                          <div className="flex justify-between text-[9px] text-muted-foreground font-semibold">
                            <span>Espera Média:</span>
                            <span className="text-foreground font-bold">{formatYears(r.media_espera_anos)}</span>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>

              {/* Card de Resumo Status */}
              <div className="bento-card p-6 md:p-8 space-y-6">
                <div className="flex items-center gap-2 text-foreground">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  <h3 className="text-sm font-black uppercase tracking-wider">Status das Solicitações Ativas</h3>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {statusDistribuicao.length === 0 ? (
                    <p className="text-xs text-muted-foreground font-bold col-span-2">Nenhum dado cadastrado.</p>
                  ) : (
                    statusDistribuicao.map(s => {
                      const statusCfg = getStatusLabel(s.status_interno)
                      return (
                        <div key={s.status_interno} className="p-4 border border-border/20 bg-muted/10 rounded-2xl flex items-center justify-between">
                          <div className="space-y-1">
                            <span className={`px-2.5 py-1 text-[9px] font-bold uppercase rounded-lg border ${statusCfg.color}`}>
                              {statusCfg.label}
                            </span>
                            <p className="text-xs text-muted-foreground font-medium pt-1">Total</p>
                          </div>
                          <span className="text-xl font-black text-foreground">{s.total}</span>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: ESPERA POR PROCEDIMENTO */}
          {activeTab === 'procedimento' && (
            <div className="bento-card overflow-hidden">
              <div className="p-6 md:p-8 border-b border-border/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-foreground">Procedimentos com Maior Tempo de Espera</h3>
                  <p className="text-xs text-muted-foreground mt-1">Clique nas colunas para ordenar a tabela.</p>
                </div>
                <div className="relative max-w-xs w-full">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value)
                      setProcedPage(1)
                    }}
                    className="block w-full rounded-xl border border-border/50 bg-background/50 py-2.5 px-4 pr-10 text-xs text-foreground outline-none focus:border-primary transition-all placeholder:text-muted-foreground/50"
                    placeholder="Filtrar por nome ou código..."
                  />
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40" />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border/20 bg-muted/20 text-[10px] font-black uppercase tracking-wider text-muted-foreground select-none">
                      <th 
                        className="py-4 px-6 cursor-pointer hover:text-foreground hover:bg-muted/30 transition-colors"
                        onClick={() => handleSort('cod_sigtap')}
                      >
                        <div className="flex items-center gap-1.5">
                          <span>Código SIGTAP</span>
                          {procedSortBy === 'cod_sigtap' && (procedSortOrder === 'asc' ? '▲' : '▼')}
                        </div>
                      </th>
                      <th 
                        className="py-4 px-6 cursor-pointer hover:text-foreground hover:bg-muted/30 transition-colors"
                        onClick={() => handleSort('desc_sigtap')}
                      >
                        <div className="flex items-center gap-1.5">
                          <span>Procedimento</span>
                          {procedSortBy === 'desc_sigtap' && (procedSortOrder === 'asc' ? '▲' : '▼')}
                        </div>
                      </th>
                      <th 
                        className="py-4 px-6 cursor-pointer hover:text-foreground hover:bg-muted/30 transition-colors text-center"
                        onClick={() => handleSort('total_pacientes')}
                      >
                        <div className="flex items-center justify-center gap-1.5">
                          <span>Pacientes na Fila</span>
                          {procedSortBy === 'total_pacientes' && (procedSortOrder === 'asc' ? '▲' : '▼')}
                        </div>
                      </th>
                      <th 
                        className="py-4 px-6 cursor-pointer hover:text-foreground hover:bg-muted/30 transition-colors text-right"
                        onClick={() => handleSort('media_espera_anos')}
                      >
                        <div className="flex items-center justify-end gap-1.5">
                          <span>Espera Média</span>
                          {procedSortBy === 'media_espera_anos' && (procedSortOrder === 'asc' ? '▲' : '▼')}
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/10 text-xs font-semibold">
                    {paginatedProcedimentos.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-12 text-center text-muted-foreground font-bold">
                          Nenhum procedimento encontrado.
                        </td>
                      </tr>
                    ) : (
                      paginatedProcedimentos.map((p) => (
                        <tr key={p.cod_sigtap} className="hover:bg-muted/10 transition-colors">
                          <td className="py-4 px-6 font-mono text-muted-foreground">{p.cod_sigtap}</td>
                          <td className="py-4 px-6 text-foreground uppercase">{p.desc_sigtap}</td>
                          <td className="py-4 px-6 text-center font-bold text-foreground">
                            {p.total_pacientes.toLocaleString('pt-BR')}
                          </td>
                          <td className="py-4 px-6 text-right text-primary font-black">
                            {formatYears(p.media_espera_anos)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Controles de Paginação */}
              {totalProcedPages > 1 && (
                <div className="p-6 md:p-8 border-t border-border/10 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    Exibindo {startIndex + 1} - {Math.min(startIndex + procedLimit, totalProcedItems)} de {totalProcedItems} procedimentos
                  </span>
                  
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={procedPage === 1}
                      onClick={() => setProcedPage(prev => Math.max(prev - 1, 1))}
                      className="px-4 py-2 border border-border/40 text-foreground hover:bg-muted/50 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed cursor-pointer"
                    >
                      Anterior
                    </button>
                    
                    {getPageNumbers().map((pageNum, idx) => {
                      if (pageNum === '...') {
                        return <span key={`dots-${idx}`} className="px-1 text-muted-foreground">...</span>
                      }
                      return (
                        <button
                          key={pageNum}
                          type="button"
                          onClick={() => setProcedPage(pageNum as number)}
                          className={`w-9 h-9 flex items-center justify-center rounded-xl text-[10px] font-black transition-all cursor-pointer ${
                            procedPage === pageNum 
                              ? 'bg-primary text-primary-foreground shadow-md shadow-primary/15' 
                              : 'border border-border/40 hover:bg-muted/50 text-foreground'
                          }`}
                        >
                          {pageNum}
                        </button>
                      )
                    })}

                    <button
                      type="button"
                      disabled={procedPage === totalProcedPages}
                      onClick={() => setProcedPage(prev => Math.min(prev + 1, totalProcedPages))}
                      className="px-4 py-2 border border-border/40 text-foreground hover:bg-muted/50 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed cursor-pointer"
                    >
                      Próximo
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: ESPERA POR RISCO */}
          {activeTab === 'risco' && (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {esperaRisco.length === 0 ? (
                <div className="bento-card p-8 text-center text-muted-foreground font-bold col-span-full">
                  Sem dados estatísticos de classificação de risco.
                </div>
              ) : (
                esperaRisco.map(r => {
                  const riskCfg = getRiskLabel(r.classificacao_risco)
                  return (
                    <div key={r.classificacao_risco} className="bento-card p-6 space-y-6 flex flex-col justify-between">
                      <div className="flex justify-between items-start">
                        <span className={`px-3 py-1 text-[10px] font-black uppercase rounded-lg border ${riskCfg.color}`}>
                          {riskCfg.label}
                        </span>
                        <span className="text-[10px] font-black text-muted-foreground bg-muted/30 px-2.5 py-1.5 rounded-lg border border-border/10">
                          Código: {r.classificacao_risco}
                        </span>
                      </div>
                      
                      <div className="space-y-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block">Média de Espera do Risco</span>
                        <p className="text-2xl font-black text-primary">{formatYears(r.media_espera_anos)}</p>
                      </div>

                      <div className="border-t border-border/10 pt-4 flex justify-between items-center text-xs font-semibold text-muted-foreground">
                        <span>Total de Pacientes:</span>
                        <span className="text-foreground font-black">{r.total_pacientes.toLocaleString('pt-BR')}</span>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          )}

          {/* TAB 4: PRODUTIVIDADE DA EQUIPE */}
          {activeTab === 'produtividade' && (
            <div className="bento-card overflow-hidden">
              <div className="p-6 md:p-8 border-b border-border/10">
                <h3 className="text-sm font-black uppercase tracking-wider text-foreground">Relatório de Produtividade dos Operadores</h3>
                <p className="text-xs text-muted-foreground mt-1">Buscas ativas de convocação registradas por operador regulador.</p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border/20 bg-muted/20 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                      <th className="py-4 px-6">Operador</th>
                      <th className="py-4 px-6 text-center">Total Contatos</th>
                      <th className="py-4 px-6 text-center text-emerald-500">Confirmados</th>
                      <th className="py-4 px-6 text-center text-rose-500">Recusados</th>
                      <th className="py-4 px-6 text-center text-amber-500">Sem Resposta</th>
                      <th className="py-4 px-6 text-right">Taxa de Sucesso</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/10 text-xs font-semibold">
                    {produtividadeOperador.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-muted-foreground font-bold">
                          Nenhum registro de contato efetuado pelos operadores.
                        </td>
                      </tr>
                    ) : (
                      produtividadeOperador.map((op, idx) => {
                        const successRate = op.total_contatos > 0 
                          ? ((op.contatos_sucesso / op.total_contatos) * 100)
                          : 0
                        return (
                          <tr key={idx} className="hover:bg-muted/10 transition-colors">
                            <td className="py-4 px-6">
                              <div className="flex flex-col">
                                <span className="font-bold text-foreground text-sm">{op.operador_nome}</span>
                                <span className="text-[10px] text-muted-foreground/60 font-mono">{op.operador_email}</span>
                              </div>
                            </td>
                            <td className="py-4 px-6 text-center text-foreground font-bold">
                              {op.total_contatos.toLocaleString('pt-BR')}
                            </td>
                            <td className="py-4 px-6 text-center text-emerald-500 font-bold">
                              {op.contatos_sucesso.toLocaleString('pt-BR')}
                            </td>
                            <td className="py-4 px-6 text-center text-rose-500 font-bold">
                              {op.contatos_recusa.toLocaleString('pt-BR')}
                            </td>
                            <td className="py-4 px-6 text-center text-amber-500 font-bold">
                              {op.contatos_sem_resposta.toLocaleString('pt-BR')}
                            </td>
                            <td className="py-4 px-6 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <span className="font-black text-foreground">{successRate.toFixed(1)}%</span>
                                <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                                  <div 
                                    className="h-full bg-emerald-500 rounded-full" 
                                    style={{ width: `${successRate}%` }}
                                  />
                                </div>
                              </div>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 5: STATUS DA FILA */}
          {activeTab === 'status' && (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {statusDistribuicao.length === 0 ? (
                <div className="bento-card p-8 text-center text-muted-foreground font-bold col-span-full">
                  Sem dados estatísticos de status.
                </div>
              ) : (
                statusDistribuicao.map(s => {
                  const statusCfg = getStatusLabel(s.status_interno)
                  const pct = totalPacientesFila > 0 ? ((s.total / totalPacientesFila) * 100) : 0
                  return (
                    <div key={s.status_interno} className="bento-card p-6 space-y-6">
                      <div className="flex justify-between items-center">
                        <span className={`px-3 py-1 text-[10px] font-black uppercase rounded-lg border ${statusCfg.color}`}>
                          {statusCfg.label}
                        </span>
                        <span className="text-[10px] font-mono text-muted-foreground uppercase">{s.status_interno}</span>
                      </div>

                      <div className="space-y-1">
                        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Pacientes</span>
                        <div className="flex items-baseline gap-2">
                          <p className="text-3xl font-black text-foreground">{s.total.toLocaleString('pt-BR')}</p>
                          <span className="text-xs text-muted-foreground font-bold">({pct.toFixed(1)}%)</span>
                        </div>
                      </div>

                      <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                        <div 
                          className="h-full bg-primary rounded-full" 
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          )}

        </div>

      </div>
    </DashboardShell>
  )
}
