'use client'

import React, { useState, useMemo } from 'react'
import { DashboardShell } from '@/components/layout/DashboardShell'
import { 
  Plus, Edit2, X, Stethoscope, Check, 
  Search, ShieldCheck, ShieldAlert
} from 'lucide-react'
import { Portal } from '@/components/ui/Portal'
import { saveEspecialidade, toggleEspecialidadeStatus } from './actions'
import { useSystemModal } from '@/components/ui/SystemModal'

interface EspecialidadesClientProps {
  role: string
  email: string
  initialEspecialidades: any[]
}

export function EspecialidadesClient({ role, email, initialEspecialidades }: EspecialidadesClientProps) {
  const { showAlert } = useSystemModal()
  const [especialidades, setEspecialidades] = useState(initialEspecialidades)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | undefined>(undefined)

  // Form states
  const [nome, setNome] = useState('')
  const [descricao, setDescricao] = useState('')
  const [active, setActive] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // Filtro em tempo real
  const filteredEspecialidades = useMemo(() => {
    if (!search.trim()) return especialidades
    const q = search.toLowerCase()
    return especialidades.filter(e => 
      e.nome.toLowerCase().includes(q) || 
      (e.descricao && e.descricao.toLowerCase().includes(q))
    )
  }, [especialidades, search])

  const handleOpenCreate = () => {
    setEditingId(undefined)
    setNome('')
    setDescricao('')
    setActive(true)
    setModalOpen(true)
  }

  const handleOpenEdit = (esp: any) => {
    setEditingId(esp.id)
    setNome(esp.nome || '')
    setDescricao(esp.descricao || '')
    setActive(esp.active)
    setModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!nome.trim()) {
      await showAlert({
        title: 'Nome Obrigatório',
        message: 'O nome da especialidade médica é obrigatório.',
        type: 'warning'
      })
      return
    }

    setSubmitting(true)
    try {
      await saveEspecialidade(editingId, nome, descricao, active)
      await showAlert({
        title: 'Sucesso',
        message: editingId ? 'Especialidade atualizada com sucesso!' : 'Especialidade cadastrada com sucesso!',
        type: 'success'
      })

      // Atualizar localmente
      if (editingId) {
        setEspecialidades(prev => prev.map(esp => 
          esp.id === editingId ? { ...esp, nome: nome.trim().toUpperCase(), descricao, active } : esp
        ))
      } else {
        setEspecialidades(prev => [
          ...prev, 
          { id: crypto.randomUUID(), nome: nome.trim().toUpperCase(), descricao, active, created_at: new Date().toISOString() }
        ])
      }
      setModalOpen(false)
    } catch (err: any) {
      await showAlert({
        title: 'Erro ao Salvar',
        message: err.message || 'Falha ao salvar especialidade.',
        type: 'error'
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleToggleStatus = async (esp: any) => {
    const nextStatus = !esp.active
    try {
      await toggleEspecialidadeStatus(esp.id, nextStatus)
      setEspecialidades(prev => prev.map(item => 
        item.id === esp.id ? { ...item, active: nextStatus } : item
      ))
    } catch (err: any) {
      await showAlert({
        title: 'Erro',
        message: err.message || 'Falha ao alterar status.',
        type: 'error'
      })
    }
  }

  return (
    <DashboardShell role={role} email={email}>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-3xl font-black text-foreground tracking-tighter uppercase">
              Especialidades <span className="text-primary italic">Médicas</span>
            </h2>
            <p className="text-sm text-muted-foreground mt-2">
              Padronize e gerencie o catálogo de especialidades clínicas e cirúrgicas.
            </p>
          </div>

          <button
            onClick={handleOpenCreate}
            className="flex items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3.5 text-xs font-black uppercase tracking-widest text-primary-foreground shadow-lg shadow-primary/20 hover:opacity-90 active:scale-95 transition-all cursor-pointer"
          >
            <Plus className="h-4 w-4 stroke-[3]" />
            <span>Nova Especialidade</span>
          </button>
        </div>

        {/* Bento Search & Summary */}
        <div className="bento-card p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar especialidade por nome ou descrição..."
                className="w-full rounded-2xl border border-border/50 bg-background/50 py-3.5 pl-11 pr-4 text-xs text-foreground outline-none focus:border-primary transition-all placeholder:text-muted-foreground/50"
              />
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-muted-foreground/40" />
            </div>

            <div className="flex items-center gap-4 text-xs font-mono text-muted-foreground">
              <span>Total: <strong className="text-foreground font-black">{filteredEspecialidades.length}</strong></span>
              <span>Ativas: <strong className="text-emerald-500 font-black">{filteredEspecialidades.filter(e => e.active).length}</strong></span>
            </div>
          </div>
        </div>

        {/* Tabela de Especialidades */}
        <div className="bento-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border/40 bg-muted/30 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                <tr>
                  <th className="py-4 px-6">Especialidade</th>
                  <th className="py-4 px-6">Descrição / Observações</th>
                  <th className="py-4 px-6 text-center">Status</th>
                  <th className="py-4 px-6 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {filteredEspecialidades.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-muted-foreground">
                      Nenhuma especialidade médica encontrada.
                    </td>
                  </tr>
                ) : (
                  filteredEspecialidades.map((esp) => (
                    <tr key={esp.id} className="hover:bg-muted/10 transition-colors">
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-black">
                            <Stethoscope className="h-4.5 w-4.5" />
                          </div>
                          <span className="font-bold text-foreground tracking-wide text-xs">
                            {esp.nome}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-muted-foreground max-w-md truncate">
                        {esp.descricao || '—'}
                      </td>
                      <td className="py-4 px-6 text-center">
                        <button
                          onClick={() => handleToggleStatus(esp)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${
                            esp.active 
                              ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500/20' 
                              : 'bg-zinc-500/10 text-zinc-500 border border-zinc-500/20 hover:bg-zinc-500/20'
                          }`}
                        >
                          {esp.active ? <ShieldCheck className="h-3.5 w-3.5" /> : <ShieldAlert className="h-3.5 w-3.5" />}
                          <span>{esp.active ? 'Ativa' : 'Inativa'}</span>
                        </button>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <button
                          onClick={() => handleOpenEdit(esp)}
                          className="p-2 rounded-xl text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all cursor-pointer"
                          title="Editar Especialidade"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal de Criação / Edição */}
        {modalOpen && (
          <Portal>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="relative w-full max-w-lg rounded-3xl border border-border/80 bg-card text-card-foreground p-6 md:p-8 shadow-[0_25px_70px_rgba(0,0,0,0.3)] space-y-6 animate-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between border-b border-border/10 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                      <Stethoscope className="h-5 w-5" />
                    </div>
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Catálogo Médico</span>
                      <h3 className="text-base font-black text-foreground uppercase">
                        {editingId ? 'Editar Especialidade' : 'Nova Especialidade'}
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
                      Nome da Especialidade *
                    </label>
                    <input
                      type="text"
                      required
                      value={nome}
                      onChange={e => setNome(e.target.value)}
                      placeholder="Ex: CARDIOLOGIA, UROLOGIA..."
                      className="w-full rounded-2xl border border-border/50 bg-background/50 py-3 px-4 text-xs font-bold text-foreground uppercase outline-none focus:border-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5">
                      Descrição / Observações
                    </label>
                    <textarea
                      rows={3}
                      value={descricao}
                      onChange={e => setDescricao(e.target.value)}
                      placeholder="Detalhes ou procedimentos comuns atendidos nesta área..."
                      className="w-full rounded-2xl border border-border/50 bg-background/50 py-3 px-4 text-xs text-foreground outline-none focus:border-primary resize-none"
                    />
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setActive(!active)}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-bold transition-all ${
                        active 
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500' 
                          : 'bg-muted/30 border-border/40 text-muted-foreground'
                      }`}
                    >
                      <div className={`h-3 w-3 rounded-full ${active ? 'bg-emerald-500' : 'bg-muted-foreground'}`} />
                      <span>{active ? 'Especialidade Ativa' : 'Especialidade Inativa'}</span>
                    </button>
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
                      <span>{submitting ? 'Salvando...' : 'Salvar Especialidade'}</span>
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
