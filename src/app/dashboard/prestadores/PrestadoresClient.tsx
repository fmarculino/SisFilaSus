'use client'

import React, { useState } from 'react'
import { DashboardShell } from '@/components/layout/DashboardShell'
import { 
  Plus, Edit2, X, Building2, Check, 
  AlertCircle, ShieldCheck, ShieldAlert
} from 'lucide-react'
import { Portal } from '@/components/ui/Portal'
import { savePrestador } from './actions'
import { useSystemModal } from '@/components/ui/SystemModal'

interface PrestadoresClientProps {
  role: string
  email: string
  prestadores: any[]
}

const DISPONIVEIS_ESPECIALIDADES = [
  'CIRURGIA GERAL',
  'GINECOLOGIA E OBSTETRICIA',
  'ORTOPEDIA E TRAUMATOLOGIA',
  'OFTALMOLOGIA',
  'UROLOGIA',
  'CARDIOLOGIA',
  'PEDIATRIA',
  'OTORRINOLARINGOLOGIA',
  'CIRURGIA PLASTICA',
  'NEUROCIRURGIA',
  'CIRURGIA VASCULAR',
  'OUTRAS ESPECIALIDADES'
]

export function PrestadoresClient({ role, email, prestadores: initialPrestadores }: PrestadoresClientProps) {
  const { showAlert } = useSystemModal()
  const [prestadores, setPrestadores] = useState(initialPrestadores)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | undefined>(undefined)

  // Campos do Formulário
  const [cnes, setCnes] = useState('')
  const [nome, setNome] = useState('')
  const [active, setActive] = useState(true)
  const [selectedSpecs, setSelectedSpecs] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)

  const handleOpenCreate = () => {
    setEditingId(undefined)
    setCnes('')
    setNome('')
    setActive(true)
    setSelectedSpecs([])
    setModalOpen(true)
  }

  const handleOpenEdit = (p: any) => {
    setEditingId(p.id)
    setCnes(p.cnes || '')
    setNome(p.nome || '')
    setActive(p.active)
    setSelectedSpecs(p.especialidades || [])
    setModalOpen(true)
  }

  const handleToggleSpec = (spec: string) => {
    setSelectedSpecs(prev => 
      prev.includes(spec) ? prev.filter(s => s !== spec) : [...prev, spec]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (cnes.trim().length < 7 || cnes.trim().length > 10) {
      await showAlert({
        title: 'CNES Inválido',
        message: 'O código CNES deve possuir entre 7 e 10 caracteres numéricos.',
        type: 'warning'
      })
      return
    }

    if (!nome.trim()) {
      await showAlert({
        title: 'Nome Obrigatório',
        message: 'O nome do prestador é obrigatório.',
        type: 'warning'
      })
      return
    }

    setSubmitting(true)
    try {
      await savePrestador(editingId, cnes, nome, active, selectedSpecs)
      await showAlert({
        title: 'Sucesso',
        message: editingId ? 'Prestador atualizado com sucesso!' : 'Prestador cadastrado com sucesso!',
        type: 'success'
      })
      
      // Atualizar lista localmente
      if (editingId) {
        setPrestadores(prev => prev.map(p => {
          if (p.id === editingId) {
            return { ...p, cnes, nome: nome.toUpperCase(), active, especialidades: selectedSpecs }
          }
          return p
        }).sort((a, b) => a.nome.localeCompare(b.nome)))
      } else {
        // Recarregar a página para obter o novo UUID gerado no banco ou adicionar um mock local temporário
        window.location.reload()
      }
      
      setModalOpen(false)
    } catch (err: any) {
      await showAlert({
        title: 'Erro ao Salvar',
        message: err.message || 'Erro ao salvar prestador.',
        type: 'error'
      })
    } finally {
      setSubmitting(false)
    }
  }


  return (
    <DashboardShell role={role} email={email}>
      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-3xl font-black text-foreground tracking-tighter uppercase">
              Prestadores de <span className="text-primary italic">Saúde</span>
            </h2>
            <p className="text-sm text-muted-foreground mt-2">
              Cadastre e gerencie os hospitais e clínicas executantes credenciados na rede de saúde de Marabá.
            </p>
          </div>

          <button
            onClick={handleOpenCreate}
            className="px-5 py-3 rounded-2xl bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-widest hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer shadow-md shadow-primary/10 flex items-center gap-2 w-fit shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span>Cadastrar Prestador</span>
          </button>
        </div>

        {/* Listagem */}
        <div className="bento-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border/20 bg-muted/20 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                  <th className="py-5 px-6">Código CNES</th>
                  <th className="py-5 px-6">Nome do Hospital / Prestador</th>
                  <th className="py-5 px-6">Especialidades Atendidas</th>
                  <th className="py-5 px-6">Status</th>
                  <th className="py-5 px-6 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/10 text-xs font-semibold">
                {prestadores.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-muted-foreground font-bold">
                      Nenhum hospital prestador cadastrado no sistema.
                    </td>
                  </tr>
                ) : (
                  prestadores.map((p) => (
                    <tr key={p.id} className="hover:bg-muted/10 transition-colors">
                      <td className="py-4 px-6 font-mono text-muted-foreground">{p.cnes}</td>
                      <td className="py-4 px-6 font-bold text-foreground text-sm uppercase">{p.nome}</td>
                      <td className="py-4 px-6 max-w-xs">
                        <div className="flex flex-wrap gap-1">
                          {p.especialidades && p.especialidades.length > 0 ? (
                            p.especialidades.map((s: string) => (
                              <span key={s} className="px-1.5 py-0.5 text-[8px] font-bold uppercase rounded bg-muted text-muted-foreground border border-border/40">
                                {s}
                              </span>
                            ))
                          ) : (
                            <span className="text-[10px] text-muted-foreground/50 italic font-medium">Nenhuma cadastrada</span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        {p.active ? (
                          <span className="px-2 py-0.5 text-[8px] font-black uppercase rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">Ativo</span>
                        ) : (
                          <span className="px-2 py-0.5 text-[8px] font-black uppercase rounded bg-rose-500/10 text-rose-500 border border-rose-500/20">Inativo</span>
                        )}
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleOpenEdit(p)}
                            className="p-2 rounded-xl hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors cursor-pointer"
                            title="Editar"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>

                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal / Form Cadastro/Edição */}
      {modalOpen && (
        <Portal>
          <div className="fixed inset-0 z-50 overflow-hidden">
          <div 
            className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm transition-opacity duration-300"
            onClick={() => setModalOpen(false)}
          />
          <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-xl bg-card text-card-foreground border-l border-border/60 shadow-2xl flex flex-col h-full overflow-y-auto animate-in slide-in-from-right duration-350">
              
              {/* Header */}
              <div className="p-6 md:p-8 border-b border-border/10 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Cadastro de Rede</span>
                    <h3 className="text-lg font-black text-foreground uppercase mt-1">
                      {editingId ? 'Editar Prestador' : 'Cadastrar Novo Prestador'}
                    </h3>
                  </div>
                </div>
                <button 
                  onClick={() => setModalOpen(false)}
                  className="p-2 rounded-full hover:bg-muted/50 transition-colors cursor-pointer"
                >
                  <X className="h-5 w-5 text-muted-foreground" />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="flex-1 p-6 md:p-8 space-y-6">
                
                {/* CNES */}
                <div className="group">
                  <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2 px-1">Código CNES</label>
                  <input
                    type="text"
                    required
                    value={cnes}
                    onChange={(e) => setCnes(e.target.value)}
                    className="block w-full rounded-2xl border border-border/50 bg-background/50 py-3.5 px-4 text-xs text-foreground outline-none focus:border-primary transition-all font-mono"
                    placeholder="Ex: 2314567"
                    disabled={editingId !== undefined} // CNES não pode mudar após cadastro
                  />
                </div>

                {/* Nome */}
                <div className="group">
                  <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2 px-1">Nome do Prestador / Hospital</label>
                  <input
                    type="text"
                    required
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    className="block w-full rounded-2xl border border-border/50 bg-background/50 py-3.5 px-4 text-xs text-foreground outline-none focus:border-primary transition-all uppercase"
                    placeholder="Ex: HOSPITAL MUNICIPAL DE MARABA"
                  />
                </div>

                {/* Especialidades Checkbox Grid */}
                <div className="space-y-2.5">
                  <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Especialidades Habilitadas</label>
                  <div className="grid gap-2 sm:grid-cols-2 p-4 bg-muted/20 border border-border/10 rounded-2xl">
                    {DISPONIVEIS_ESPECIALIDADES.map((spec) => {
                      const isSelected = selectedSpecs.includes(spec)
                      return (
                        <button
                          key={spec}
                          type="button"
                          onClick={() => handleToggleSpec(spec)}
                          className={`p-3 rounded-xl border text-[10px] font-bold text-left uppercase transition-all flex items-center justify-between cursor-pointer ${
                            isSelected 
                              ? 'bg-primary/10 border-primary/40 text-primary shadow-sm' 
                              : 'bg-background/40 border-border/10 text-muted-foreground hover:text-foreground hover:bg-background/75'
                          }`}
                        >
                          <span className="truncate pr-2">{spec}</span>
                          {isSelected && <Check className="h-4 w-4 shrink-0" />}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Active Switch */}
                <div className="flex items-center justify-between p-4 bg-muted/20 border border-border/10 rounded-2xl">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-foreground">Disponibilidade do Prestador</span>
                    <span className="text-[10px] text-muted-foreground">Prestadores inativos não aparecem na triagem de encaminhamentos.</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={(e) => setActive(e.target.checked)}
                    className="h-5 w-5 accent-primary cursor-pointer"
                  />
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-6 border-t border-border/10">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="w-1/2 py-3 border border-border/40 text-muted-foreground hover:bg-muted/50 hover:text-foreground text-[10px] font-black uppercase tracking-widest rounded-xl transition-all cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-1/2 py-3 bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-widest rounded-xl hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer disabled:opacity-50"
                  >
                    {submitting ? 'Salvando...' : 'Salvar Registro'}
                  </button>
                </div>

              </form>

            </div>
          </div>
        </div>
        </Portal>
      )}
    </DashboardShell>
  )
}
