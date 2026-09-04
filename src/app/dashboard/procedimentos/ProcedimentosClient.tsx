'use client'

import React, { useState, useMemo } from 'react'
import { DashboardShell } from '@/components/layout/DashboardShell'
import { 
  Plus, Edit2, X, Activity, Check, 
  Search, Trash2, Layers
} from 'lucide-react'
import { Portal } from '@/components/ui/Portal'
import { saveProcedimento, deleteProcedimento } from './actions'
import { useSystemModal } from '@/components/ui/SystemModal'
import { SearchableSelect } from '@/components/ui/SearchableSelect'
import { Pagination } from '@/components/ui/Pagination'

interface ProcedimentosClientProps {
  role: string
  email: string
  initialProcedimentos: any[]
  especialidades: { id: string; nome: string }[]
}

const MODALIDADES = [
  { value: '0', label: 'Consulta Especializada' },
  { value: '1', label: 'Exame / Diagnóstico' },
  { value: '2', label: 'Cirurgia Eletiva / Ambulatorial' },
  { value: '3', label: 'Demais Procedimentos' }
]

export function ProcedimentosClient({
  role,
  email,
  initialProcedimentos,
  especialidades
}: ProcedimentosClientProps) {
  const { showAlert, showConfirm } = useSystemModal()
  const [procedimentos, setProcedimentos] = useState(initialProcedimentos)
  const [search, setSearch] = useState('')
  const [modalidadeFilter, setModalidadeFilter] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 20

  const [modalOpen, setModalOpen] = useState(false)
  const [editingCod, setEditingCod] = useState<string | undefined>(undefined)

  // Form states
  const [codSigtap, setCodSigtap] = useState('')
  const [descSigtap, setDescSigtap] = useState('')
  const [modalidadeFila, setModalidadeFila] = useState('0')
  const [grupoDescricao, setGrupoDescricao] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Especialidades options para SearchableSelect
  const especialidadeOptions = useMemo(() => {
    return especialidades.map(e => ({
      value: e.nome,
      label: e.nome
    }))
  }, [especialidades])

  // Filtragem
  const filteredProcedimentos = useMemo(() => {
    return procedimentos.filter(p => {
      const q = search.toLowerCase().trim()
      const matchSearch = !q || 
        p.cod_sigtap.includes(q) || 
        p.desc_sigtap.toLowerCase().includes(q) ||
        (p.grupo_descricao && p.grupo_descricao.toLowerCase().includes(q))

      const matchMod = !modalidadeFilter || String(p.modalidade_fila) === modalidadeFilter

      return matchSearch && matchMod
    })
  }, [procedimentos, search, modalidadeFilter])

  // Paginação
  const paginatedProcedimentos = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return filteredProcedimentos.slice(start, start + itemsPerPage)
  }, [filteredProcedimentos, currentPage])

  const totalPages = Math.ceil(filteredProcedimentos.length / itemsPerPage)

  const handleOpenCreate = () => {
    setEditingCod(undefined)
    setCodSigtap('')
    setDescSigtap('')
    setModalidadeFila('0')
    setGrupoDescricao('')
    setModalOpen(true)
  }

  const handleOpenEdit = (p: any) => {
    setEditingCod(p.cod_sigtap)
    setCodSigtap(p.cod_sigtap)
    setDescSigtap(p.desc_sigtap)
    setModalidadeFila(String(p.modalidade_fila ?? 0))
    setGrupoDescricao(p.grupo_descricao || '')
    setModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!codSigtap.trim()) {
      await showAlert({ title: 'Código Obrigatório', message: 'O código SIGTAP é obrigatório.', type: 'warning' })
      return
    }

    if (!descSigtap.trim()) {
      await showAlert({ title: 'Descrição Obrigatória', message: 'A descrição do procedimento é obrigatória.', type: 'warning' })
      return
    }

    setSubmitting(true)
    try {
      await saveProcedimento(editingCod, {
        cod_sigtap: codSigtap,
        desc_sigtap: descSigtap,
        modalidade_fila: parseInt(modalidadeFila, 10),
        grupo_descricao: grupoDescricao || null
      })

      await showAlert({
        title: 'Sucesso',
        message: editingCod ? 'Procedimento atualizado com sucesso!' : 'Procedimento cadastrado com sucesso!',
        type: 'success'
      })

      const updatedObj = {
        cod_sigtap: codSigtap.trim(),
        desc_sigtap: descSigtap.trim().toUpperCase(),
        modalidade_fila: parseInt(modalidadeFila, 10),
        grupo_descricao: grupoDescricao.trim().toUpperCase() || null
      }

      if (editingCod) {
        setProcedimentos(prev => prev.map(p => p.cod_sigtap === editingCod ? { ...p, ...updatedObj } : p))
      } else {
        setProcedimentos(prev => [updatedObj, ...prev])
      }

      setModalOpen(false)
    } catch (err: any) {
      await showAlert({
        title: 'Erro ao Salvar',
        message: err.message || 'Falha ao salvar procedimento.',
        type: 'error'
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (p: any) => {
    const confirmed = await showConfirm({
      title: 'Excluir Procedimento?',
      message: `Tem certeza que deseja excluir o procedimento "${p.desc_sigtap}" (${p.cod_sigtap})? Esta ação não poderá ser desfeita se não houver vínculos na fila.`,
      confirmText: 'Sim, Excluir',
      cancelText: 'Cancelar',
      variant: 'danger'
    })

    if (!confirmed) return

    try {
      await deleteProcedimento(p.cod_sigtap)
      setProcedimentos(prev => prev.filter(item => item.cod_sigtap !== p.cod_sigtap))
      await showAlert({ title: 'Excluído', message: 'Procedimento removido com sucesso.', type: 'success' })
    } catch (err: any) {
      await showAlert({ title: 'Erro ao Excluir', message: err.message, type: 'error' })
    }
  }

  const getModalidadeBadge = (mod: number | null) => {
    switch (mod) {
      case 0:
        return <span className="px-2.5 py-1 text-[9px] font-black uppercase rounded-lg bg-blue-500/10 text-blue-500 border border-blue-500/20">Consulta</span>
      case 1:
        return <span className="px-2.5 py-1 text-[9px] font-black uppercase rounded-lg bg-amber-500/10 text-amber-500 border border-amber-500/20">Exame</span>
      case 2:
        return <span className="px-2.5 py-1 text-[9px] font-black uppercase rounded-lg bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">Cirurgia</span>
      default:
        return <span className="px-2.5 py-1 text-[9px] font-black uppercase rounded-lg bg-purple-500/10 text-purple-500 border border-purple-500/20">Outros</span>
    }
  }

  return (
    <DashboardShell role={role} email={email}>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-3xl font-black text-foreground tracking-tighter uppercase">
              Tabela de <span className="text-primary italic">Procedimentos</span>
            </h2>
            <p className="text-sm text-muted-foreground mt-2">
              Gerencie os códigos SIGTAP, modalidades reguladas e especialidades vinculadas.
            </p>
          </div>

          <button
            onClick={handleOpenCreate}
            className="flex items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3.5 text-xs font-black uppercase tracking-widest text-primary-foreground shadow-lg shadow-primary/20 hover:opacity-90 active:scale-95 transition-all cursor-pointer"
          >
            <Plus className="h-4 w-4 stroke-[3]" />
            <span>Novo Procedimento</span>
          </button>
        </div>

        {/* Bento Filtros */}
        <div className="bento-card p-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="relative md:col-span-2">
              <input
                type="text"
                value={search}
                onChange={e => {
                  setSearch(e.target.value)
                  setCurrentPage(1)
                }}
                placeholder="Buscar por código SIGTAP, descrição ou especialidade..."
                className="w-full rounded-2xl border border-border/50 bg-background/50 py-3.5 pl-11 pr-4 text-xs text-foreground outline-none focus:border-primary transition-all placeholder:text-muted-foreground/50"
              />
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-muted-foreground/40" />
            </div>

            <div>
              <select
                value={modalidadeFilter}
                onChange={e => {
                  setModalidadeFilter(e.target.value)
                  setCurrentPage(1)
                }}
                className="w-full rounded-2xl border border-border/50 bg-background/50 py-3.5 px-4 text-xs text-foreground outline-none focus:border-primary transition-all font-medium"
              >
                <option value="">Todas as Modalidades</option>
                {MODALIDADES.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Tabela de Procedimentos */}
        <div className="bento-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border/40 bg-muted/30 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                <tr>
                  <th className="py-4 px-6">Código SIGTAP</th>
                  <th className="py-4 px-6">Descrição do Procedimento</th>
                  <th className="py-4 px-6">Modalidade</th>
                  <th className="py-4 px-6">Especialidade / Grupo</th>
                  <th className="py-4 px-6 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {paginatedProcedimentos.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-muted-foreground">
                      Nenhum procedimento encontrado com os critérios de busca.
                    </td>
                  </tr>
                ) : (
                  paginatedProcedimentos.map((p) => (
                    <tr key={p.cod_sigtap} className="hover:bg-muted/10 transition-colors">
                      <td className="py-4 px-6 font-mono font-bold text-foreground">
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-mono text-[11px] font-black shrink-0">
                            #
                          </div>
                          <span>{p.cod_sigtap}</span>
                        </div>
                      </td>
                      <td className="py-4 px-6 font-bold text-foreground max-w-md">
                        <span className="line-clamp-2">{p.desc_sigtap}</span>
                      </td>
                      <td className="py-4 px-6">
                        {getModalidadeBadge(p.modalidade_fila)}
                      </td>
                      <td className="py-4 px-6">
                        {p.grupo_descricao ? (
                          <span className="text-[10px] font-bold text-muted-foreground uppercase bg-muted/50 px-2.5 py-1 rounded-lg border border-border/30">
                            {p.grupo_descricao}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/50">Geral</span>
                        )}
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleOpenEdit(p)}
                            className="p-2 rounded-xl text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all cursor-pointer"
                            title="Editar Procedimento"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          {['SMS_ADMIN', 'COORDENADOR'].includes(role) && (
                            <button
                              onClick={() => handleDelete(p)}
                              className="p-2 rounded-xl text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-all cursor-pointer"
                              title="Excluir Procedimento"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Paginação */}
          {totalPages > 1 && (
            <div className="p-4 border-t border-border/20">
              <Pagination
                currentPage={currentPage}
                totalItems={filteredProcedimentos.length}
                itemsPerPage={itemsPerPage}
                onPageChange={(page: number) => setCurrentPage(page)}
              />
            </div>
          )}
        </div>

        {/* Modal de Criação / Edição */}
        {modalOpen && (
          <Portal>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="relative w-full max-w-lg rounded-3xl border border-border/80 bg-card text-card-foreground p-6 md:p-8 shadow-[0_25px_70px_rgba(0,0,0,0.3)] space-y-6 animate-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between border-b border-border/10 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                      <Activity className="h-5 w-5" />
                    </div>
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Catálogo SIGTAP</span>
                      <h3 className="text-base font-black text-foreground uppercase">
                        {editingCod ? 'Editar Procedimento' : 'Novo Procedimento'}
                      </h3>
                    </div>
                  </div>
                  <button
                    onClick={() => setModalOpen(false)}
                    className="p-2 rounded-full hover:bg-muted/50 transition-colors"
                  >
                    <X className="h-5 w-5 text-muted-foreground" />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5">
                      Código SIGTAP (10 Dígitos) *
                    </label>
                    <input
                      type="text"
                      required
                      disabled={!!editingCod}
                      value={codSigtap}
                      onChange={e => setCodSigtap(e.target.value)}
                      placeholder="Ex: 0301010072"
                      className="w-full rounded-2xl border border-border/50 bg-background/50 py-3 px-4 text-xs font-mono font-bold text-foreground outline-none focus:border-primary disabled:opacity-50"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5">
                      Descrição Completa do Procedimento *
                    </label>
                    <textarea
                      rows={3}
                      required
                      value={descSigtap}
                      onChange={e => setDescSigtap(e.target.value)}
                      placeholder="Ex: CONSULTA MEDICA EM ATENCAO ESPECIALIZADA..."
                      className="w-full rounded-2xl border border-border/50 bg-background/50 py-3 px-4 text-xs font-bold text-foreground uppercase outline-none focus:border-primary resize-none"
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5">
                        Modalidade da Fila
                      </label>
                      <select
                        value={modalidadeFila}
                        onChange={e => setModalidadeFila(e.target.value)}
                        className="w-full rounded-2xl border border-border/50 bg-background/50 py-3 px-4 text-xs text-foreground outline-none focus:border-primary"
                      >
                        {MODALIDADES.map(m => (
                          <option key={m.value} value={m.value}>{m.label}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5">
                        Especialidade / Grupo
                      </label>
                      <SearchableSelect
                        options={especialidadeOptions}
                        value={grupoDescricao}
                        onChange={val => setGrupoDescricao(val)}
                        placeholder="Vincular Especialidade..."
                        searchPlaceholder="Buscar especialidade..."
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-4 border-t border-border/10">
                    <button
                      type="button"
                      onClick={() => setModalOpen(false)}
                      className="px-5 py-3 rounded-xl border border-border/50 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:bg-muted/50"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-xs font-black uppercase tracking-wider text-primary-foreground hover:opacity-90 disabled:opacity-50"
                    >
                      <Check className="h-4 w-4" />
                      <span>{submitting ? 'Salvando...' : 'Salvar Procedimento'}</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </Portal>
        )}
      </div>
    </DashboardShell>
  )
}
