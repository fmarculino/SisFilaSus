'use client'

import React, { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { DashboardShell } from '@/components/layout/DashboardShell'
import { Pagination } from '@/components/ui/Pagination'
import { 
  Search, Filter, Eye, X, Calendar, User, 
  Database, Activity, ArrowRight, ShieldCheck, ShieldAlert
} from 'lucide-react'

interface AuditoriaClientProps {
  role: string
  email: string
  logs: any[]
  totalItems: number
  itemsPerPage: number
  currentPage: number
  usersList: any[]
  appliedFilters: {
    tabela: string
    acao: string
    usuario: string
    search: string
  }
}

export function AuditoriaClient({
  role,
  email,
  logs,
  totalItems,
  itemsPerPage,
  currentPage,
  usersList,
  appliedFilters,
}: AuditoriaClientProps) {
  const router = useRouter()
  const pathname = usePathname()

  // Filtros locais
  const [tabela, setTabela] = useState(appliedFilters.tabela)
  const [acao, setAcao] = useState(appliedFilters.acao)
  const [usuario, setUsuario] = useState(appliedFilters.usuario)
  const [search, setSearch] = useState(appliedFilters.search)

  // Modal de Detalhamento
  const [selectedLog, setSelectedLog] = useState<any | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  const handleApplyFilters = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const params = new URLSearchParams()
    
    if (tabela) params.set('tabela', tabela)
    if (acao) params.set('acao', acao)
    if (usuario) params.set('usuario', usuario)
    if (search) params.set('search', search)
    
    params.set('page', '1')
    params.set('limit', itemsPerPage.toString())

    router.push(`${pathname}?${params.toString()}`)
  }

  const handleClearFilters = () => {
    setTabela('')
    setAcao('')
    setUsuario('')
    setSearch('')
    router.push(`${pathname}?page=1&limit=${itemsPerPage}`)
  }

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'INSERT': 
        return <span className="px-2 py-0.5 text-[8px] font-black uppercase rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">Inserção</span>
      case 'UPDATE': 
        return <span className="px-2 py-0.5 text-[8px] font-black uppercase rounded bg-blue-500/10 text-blue-500 border border-blue-500/20">Edição</span>
      case 'DELETE': 
        return <span className="px-2 py-0.5 text-[8px] font-black uppercase rounded bg-rose-500/10 text-rose-500 border border-rose-500/20">Exclusão</span>
      case 'IMPORT': 
        return <span className="px-2 py-0.5 text-[8px] font-black uppercase rounded bg-purple-500/10 text-purple-500 border border-purple-500/20">Importação</span>
      default: 
        return <span className="px-2 py-0.5 text-[8px] font-black uppercase rounded bg-muted text-muted-foreground">{action}</span>
    }
  }

  const getTableLabel = (table: string) => {
    switch (table) {
      case 'pacientes': return 'Pacientes'
      case 'fila_solicitacoes': return 'Fila de Espera'
      case 'contatos': return 'Logs de Contato'
      case 'movimentacoes_fila': return 'Movimentações da Fila'
      case 'importacoes': return 'Lotes de Importação'
      case 'templates_mensagem': return 'Modelos de Mensagem'
      case 'configuracoes': return 'Configurações'
      default: return table
    }
  }

  // Compara os dados anteriores e novos de forma amigável
  const renderDiff = (log: any) => {
    const oldData = log.dados_anteriores || {}
    const newData = log.dados_novos || {}
    
    if (log.acao === 'INSERT') {
      return (
        <div className="space-y-3">
          <span className="text-[9px] font-black uppercase tracking-widest text-emerald-500 block">Dados Inseridos</span>
          <div className="grid gap-2.5 sm:grid-cols-2 text-xs font-semibold">
            {Object.keys(newData).map((key) => {
              if (newData[key] === null || newData[key] === undefined) return null
              return (
                <div key={key} className="p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-xl">
                  <span className="text-[8px] text-muted-foreground uppercase font-black tracking-wider block">{key}</span>
                  <span className="text-emerald-500 mt-1 break-all block">{typeof newData[key] === 'object' ? JSON.stringify(newData[key]) : String(newData[key])}</span>
                </div>
              )
            })}
          </div>
        </div>
      )
    }

    if (log.acao === 'DELETE') {
      return (
        <div className="space-y-3">
          <span className="text-[9px] font-black uppercase tracking-widest text-rose-500 block">Dados Excluídos</span>
          <div className="grid gap-2.5 sm:grid-cols-2 text-xs font-semibold">
            {Object.keys(oldData).map((key) => {
              if (oldData[key] === null || oldData[key] === undefined) return null
              return (
                <div key={key} className="p-3 bg-rose-500/5 border border-rose-500/10 rounded-xl">
                  <span className="text-[8px] text-muted-foreground uppercase font-black tracking-wider block">{key}</span>
                  <span className="text-rose-500 mt-1 break-all block">{typeof oldData[key] === 'object' ? JSON.stringify(oldData[key]) : String(oldData[key])}</span>
                </div>
              )
            })}
          </div>
        </div>
      )
    }

    if (log.acao === 'UPDATE') {
      // Filtrar chaves modificadas
      const changedKeys = Object.keys(newData).filter(key => {
        const oldVal = JSON.stringify(oldData[key])
        const newVal = JSON.stringify(newData[key])
        return oldVal !== newVal
      })

      if (changedKeys.length === 0) {
        return <p className="text-xs text-muted-foreground font-bold">Nenhum campo foi modificado.</p>
      }

      return (
        <div className="space-y-4">
          <span className="text-[9px] font-black uppercase tracking-widest text-primary block">Campos Modificados</span>
          <div className="space-y-3">
            {changedKeys.map((key) => {
              // Não exibir chaves desnecessárias
              if (key === 'updated_at') return null

              const oldVal = oldData[key] !== null && oldData[key] !== undefined ? String(oldData[key]) : 'Vazio'
              const newVal = newData[key] !== null && newData[key] !== undefined ? String(newData[key]) : 'Vazio'

              return (
                <div key={key} className="p-4 bg-muted/20 border border-border/10 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs font-semibold">
                  <div className="sm:w-1/4">
                    <span className="text-[8px] text-muted-foreground uppercase font-black tracking-wider block">Propriedade</span>
                    <span className="text-foreground uppercase font-bold mt-1 block">{key}</span>
                  </div>
                  <div className="sm:w-1/3 p-3 bg-rose-500/5 border border-rose-500/10 rounded-xl">
                    <span className="text-[8px] text-rose-500 uppercase font-black tracking-wider block">Antes</span>
                    <span className="text-rose-500 mt-1 break-all block">{oldVal}</span>
                  </div>
                  <ArrowRight className="hidden sm:block h-4.5 w-4.5 text-muted-foreground/45 shrink-0" />
                  <div className="sm:w-1/3 p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-xl">
                    <span className="text-[8px] text-emerald-500 uppercase font-black tracking-wider block">Depois</span>
                    <span className="text-emerald-500 mt-1 break-all block">{newVal}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )
    }

    // Fallback: mostrar JSON
    return (
      <div className="grid gap-4 sm:grid-cols-2 font-mono text-[10px]">
        <div>
          <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest block mb-2">JSON Anterior</span>
          <pre className="p-4 bg-muted/30 border border-border/15 rounded-2xl overflow-x-auto max-h-72">{JSON.stringify(oldData, null, 2)}</pre>
        </div>
        <div>
          <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest block mb-2">JSON Novo</span>
          <pre className="p-4 bg-muted/30 border border-border/15 rounded-2xl overflow-x-auto max-h-72">{JSON.stringify(newData, null, 2)}</pre>
        </div>
      </div>
    )
  }

  return (
    <DashboardShell role={role} email={email}>
      <div className="space-y-8">
        <div>
          <h2 className="text-3xl font-black text-foreground tracking-tighter uppercase">
            Auditoria de <span className="text-primary italic">Sistema</span>
          </h2>
          <p className="text-sm text-muted-foreground mt-2">
            Rastreabilidade e histórico detalhado de todas as inserções, exclusões e edições executadas nos pacientes e na fila.
          </p>
        </div>

        {/* Filtros */}
        <div className="bento-card p-6 md:p-8">
          <form onSubmit={handleApplyFilters} className="space-y-6">
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {/* Tabela */}
              <div className="group">
                <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2 px-1">Tabela</label>
                <select
                  value={tabela}
                  onChange={(e) => setTabela(e.target.value)}
                  className="block w-full rounded-2xl border border-border/50 bg-background/50 py-3.5 px-4 text-xs text-foreground outline-none focus:border-primary transition-all"
                >
                  <option value="">Todas as Tabelas</option>
                  <option value="pacientes">Pacientes</option>
                  <option value="fila_solicitacoes">Fila de Espera</option>
                  <option value="contatos">Logs de Contato</option>
                  <option value="movimentacoes_fila">Movimentações da Fila</option>
                  <option value="importacoes">Lotes de Importação</option>
                </select>
              </div>

              {/* Ação */}
              <div className="group">
                <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2 px-1">Ação</label>
                <select
                  value={acao}
                  onChange={(e) => setAcao(e.target.value)}
                  className="block w-full rounded-2xl border border-border/50 bg-background/50 py-3.5 px-4 text-xs text-foreground outline-none focus:border-primary transition-all"
                >
                  <option value="">Todas as Ações</option>
                  <option value="INSERT">Inserção</option>
                  <option value="UPDATE">Edição</option>
                  <option value="DELETE">Exclusão</option>
                  <option value="IMPORT">Importação</option>
                </select>
              </div>

              {/* Usuário / Operador */}
              <div className="group">
                <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2 px-1">Operador</label>
                <select
                  value={usuario}
                  onChange={(e) => setUsuario(e.target.value)}
                  className="block w-full rounded-2xl border border-border/50 bg-background/50 py-3.5 px-4 text-xs text-foreground outline-none focus:border-primary transition-all"
                >
                  <option value="">Todos os Operadores</option>
                  {usersList.map(u => (
                    <option key={u.id} value={u.id}>{u.nome || u.email}</option>
                  ))}
                </select>
              </div>

              {/* Busca rápida */}
              <div className="group">
                <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2 px-1">Registro ID</label>
                <div className="relative">
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="block w-full rounded-2xl border border-border/50 bg-background/50 py-3.5 px-4 pr-10 text-xs text-foreground outline-none focus:border-primary transition-all placeholder:text-muted-foreground/50"
                    placeholder="Código ou Nome da tabela"
                  />
                  <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-muted-foreground/40" />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={handleClearFilters}
                className="px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-all cursor-pointer"
              >
                Limpar
              </button>
              <button
                type="submit"
                className="px-6 py-3 rounded-2xl bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-widest hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer shadow-md shadow-primary/10 flex items-center gap-2"
              >
                <Filter className="h-3.5 w-3.5" />
                Filtrar Auditoria
              </button>
            </div>
          </form>
        </div>

        {/* Resultados */}
        <div className="bento-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border/20 bg-muted/20 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                  <th className="py-5 px-6">Data / Hora</th>
                  <th className="py-5 px-6">Ação</th>
                  <th className="py-5 px-6">Tabela</th>
                  <th className="py-5 px-6">Registro ID</th>
                  <th className="py-5 px-6">Operador</th>
                  <th className="py-5 px-6 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/10 text-xs font-semibold">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-muted-foreground font-bold">
                      Nenhum registro de auditoria encontrado.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr 
                      key={log.id} 
                      className="hover:bg-muted/10 transition-colors cursor-pointer group"
                      onClick={() => {
                        setSelectedLog(log)
                        setModalOpen(true)
                      }}
                    >
                      <td className="py-4 px-6 text-muted-foreground font-mono">
                        {new Date(log.created_at).toLocaleString('pt-BR')}
                      </td>
                      <td className="py-4 px-6">{getActionBadge(log.acao)}</td>
                      <td className="py-4 px-6 text-foreground font-bold">{getTableLabel(log.tabela)}</td>
                      <td className="py-4 px-6 font-mono text-muted-foreground">{log.registro_id}</td>
                      <td className="py-4 px-6 text-muted-foreground font-semibold">
                        {log.users?.nome || log.users?.email || 'Sistema / Importador'}
                      </td>
                      <td className="py-4 px-6 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedLog(log)
                            setModalOpen(true)
                          }}
                          className="p-2.5 rounded-xl hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors cursor-pointer"
                          title="Detalhar Alterações"
                        >
                          <Eye className="h-4.5 w-4.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          <Pagination
            totalItems={totalItems}
            itemsPerPage={itemsPerPage}
            currentPage={currentPage}
          />
        </div>
      </div>

      {/* Modal Lateral (Details Drawer) */}
      {modalOpen && selectedLog && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div 
            className="absolute inset-0 bg-background/80 backdrop-blur-sm transition-opacity duration-300"
            onClick={() => setModalOpen(false)}
          />
          <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-3xl bg-card border-l border-border/40 shadow-2xl flex flex-col h-full overflow-y-auto animate-in slide-in-from-right duration-350">
              
              {/* Header */}
              <div className="p-6 md:p-8 border-b border-border/10 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                    <Database className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Detalhes da Auditoria</span>
                    <h3 className="text-lg font-black text-foreground uppercase mt-1">Alteração em {getTableLabel(selectedLog.tabela)}</h3>
                  </div>
                </div>
                <button 
                  onClick={() => setModalOpen(false)}
                  className="p-2 rounded-full hover:bg-muted/50 transition-colors cursor-pointer"
                >
                  <X className="h-5 w-5 text-muted-foreground" />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 p-6 md:p-8 space-y-6">
                {/* Info do Log */}
                <div className="grid gap-4 sm:grid-cols-3 p-4 bg-muted/20 border border-border/10 rounded-2xl text-xs font-semibold">
                  <div>
                    <span className="text-[8px] text-muted-foreground uppercase font-black tracking-widest block mb-0.5">Operação</span>
                    {getActionBadge(selectedLog.acao)}
                  </div>
                  <div>
                    <span className="text-[8px] text-muted-foreground uppercase font-black tracking-widest block mb-0.5">Registro ID</span>
                    <span className="font-mono text-foreground">{selectedLog.registro_id}</span>
                  </div>
                  <div>
                    <span className="text-[8px] text-muted-foreground uppercase font-black tracking-widest block mb-0.5">Operador</span>
                    <span className="text-foreground">{selectedLog.users?.nome || selectedLog.users?.email || 'Sistema (Importação)'}</span>
                  </div>
                </div>

                {/* Diff Viewer */}
                <div className="border-t border-border/10 pt-6">
                  {renderDiff(selectedLog)}
                </div>
              </div>

            </div>
          </div>
        </div>
      )}
    </DashboardShell>
  )
}
