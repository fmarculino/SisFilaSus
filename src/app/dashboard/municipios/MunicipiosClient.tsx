'use client'

import React, { useState, useMemo } from 'react'
import { DashboardShell } from '@/components/layout/DashboardShell'
import { 
  Plus, Edit2, X, MapPin, Check, 
  Search, Trash2, Globe
} from 'lucide-react'
import { Portal } from '@/components/ui/Portal'
import { saveMunicipio, deleteMunicipio } from './actions'
import { useSystemModal } from '@/components/ui/SystemModal'
import { Pagination } from '@/components/ui/Pagination'

interface MunicipiosClientProps {
  role: string
  email: string
  initialMunicipios: any[]
}

export function MunicipiosClient({
  role,
  email,
  initialMunicipios
}: MunicipiosClientProps) {
  const { showAlert, showConfirm } = useSystemModal()
  const [municipios, setMunicipios] = useState(initialMunicipios)
  const [search, setSearch] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 20

  const [modalOpen, setModalOpen] = useState(false)
  const [editingIbge, setEditingIbge] = useState<string | undefined>(undefined)

  // Form states
  const [codigoIbge, setCodigoIbge] = useState('')
  const [nome, setNome] = useState('')
  const [centralReguladora, setCentralReguladora] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Filtragem
  const filteredMunicipios = useMemo(() => {
    return municipios.filter(m => {
      const q = search.toLowerCase().trim()
      return !q || 
        m.codigo_ibge.includes(q) || 
        m.nome.toLowerCase().includes(q) ||
        (m.central_reguladora_nome && m.central_reguladora_nome.toLowerCase().includes(q))
    })
  }, [municipios, search])

  // Paginação
  const paginatedMunicipios = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return filteredMunicipios.slice(start, start + itemsPerPage)
  }, [filteredMunicipios, currentPage])

  const totalPages = Math.ceil(filteredMunicipios.length / itemsPerPage)

  const handleOpenCreate = () => {
    setEditingIbge(undefined)
    setCodigoIbge('')
    setNome('')
    setCentralReguladora('')
    setModalOpen(true)
  }

  const handleOpenEdit = (m: any) => {
    setEditingIbge(m.codigo_ibge)
    setCodigoIbge(m.codigo_ibge)
    setNome(m.nome)
    setCentralReguladora(m.central_reguladora_nome || '')
    setModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!codigoIbge.trim()) {
      await showAlert({ title: 'Código IBGE Obrigatório', message: 'O código IBGE é obrigatório (ex: 150420).', type: 'warning' })
      return
    }

    if (!nome.trim()) {
      await showAlert({ title: 'Nome Obrigatório', message: 'O nome do município é obrigatório.', type: 'warning' })
      return
    }

    setSubmitting(true)
    try {
      await saveMunicipio(editingIbge, {
        codigo_ibge: codigoIbge,
        nome,
        central_reguladora_nome: centralReguladora || null
      })

      await showAlert({
        title: 'Sucesso',
        message: editingIbge ? 'Município atualizado com sucesso!' : 'Município cadastrado com sucesso!',
        type: 'success'
      })

      const updatedObj = {
        codigo_ibge: codigoIbge.trim(),
        nome: nome.trim().toUpperCase(),
        central_reguladora_nome: centralReguladora ? centralReguladora.trim().toUpperCase() : null
      }

      if (editingIbge) {
        setMunicipios(prev => prev.map(m => m.codigo_ibge === editingIbge ? { ...m, ...updatedObj } : m))
      } else {
        setMunicipios(prev => [updatedObj, ...prev])
      }

      setModalOpen(false)
    } catch (err: any) {
      await showAlert({
        title: 'Erro ao Salvar',
        message: err.message || 'Falha ao salvar município.',
        type: 'error'
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (m: any) => {
    const confirmed = await showConfirm({
      title: 'Excluir Município?',
      message: `Tem certeza que deseja excluir o município "${m.nome}" (IBGE: ${m.codigo_ibge})? Esta ação falhará se houver solicitações, pacientes ou unidades vinculadas.`,
      confirmText: 'Sim, Excluir',
      cancelText: 'Cancelar',
      variant: 'danger'
    })

    if (!confirmed) return

    try {
      await deleteMunicipio(m.codigo_ibge)
      setMunicipios(prev => prev.filter(item => item.codigo_ibge !== m.codigo_ibge))
      await showAlert({ title: 'Excluído', message: 'Município removido com sucesso.', type: 'success' })
    } catch (err: any) {
      await showAlert({ title: 'Erro ao Excluir', message: err.message, type: 'error' })
    }
  }

  return (
    <DashboardShell role={role} email={email}>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-3xl font-black text-foreground tracking-tighter uppercase">
              Municípios da <span className="text-primary italic">Região</span>
            </h2>
            <p className="text-sm text-muted-foreground mt-2">
              Gerencie a lista oficial de municípios pactuados e suas respectivas centrais reguladoras.
            </p>
          </div>

          <button
            onClick={handleOpenCreate}
            className="flex items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3.5 text-xs font-black uppercase tracking-widest text-primary-foreground shadow-lg shadow-primary/20 hover:opacity-90 active:scale-95 transition-all cursor-pointer"
          >
            <Plus className="h-4 w-4 stroke-[3]" />
            <span>Cadastrar Município</span>
          </button>
        </div>

        {/* Bento Busca */}
        <div className="bento-card p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <input
                type="text"
                value={search}
                onChange={e => {
                  setSearch(e.target.value)
                  setCurrentPage(1)
                }}
                placeholder="Buscar por nome, código IBGE ou central reguladora..."
                className="w-full rounded-2xl border border-border/50 bg-background/50 py-3.5 pl-11 pr-4 text-xs text-foreground outline-none focus:border-primary transition-all placeholder:text-muted-foreground/50"
              />
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-muted-foreground/40" />
            </div>

            <div className="text-xs font-mono text-muted-foreground">
              Total cadastrados: <strong className="text-foreground font-black">{filteredMunicipios.length}</strong>
            </div>
          </div>
        </div>

        {/* Tabela de Municípios */}
        <div className="bento-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border/40 bg-muted/30 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                <tr>
                  <th className="py-4 px-6">Código IBGE</th>
                  <th className="py-4 px-6">Nome do Município</th>
                  <th className="py-4 px-6">Central Reguladora de Referência</th>
                  <th className="py-4 px-6 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {paginatedMunicipios.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-muted-foreground">
                      Nenhum município encontrado.
                    </td>
                  </tr>
                ) : (
                  paginatedMunicipios.map((m) => (
                    <tr key={m.codigo_ibge} className="hover:bg-muted/10 transition-colors">
                      <td className="py-4 px-6 font-mono font-bold text-foreground">
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-mono text-[11px] font-black shrink-0">
                            <Globe className="h-4 w-4" />
                          </div>
                          <span>{m.codigo_ibge}</span>
                        </div>
                      </td>
                      <td className="py-4 px-6 font-bold text-foreground max-w-md">
                        <div className="flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                          <span>{m.nome}</span>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-muted-foreground">
                        {m.central_reguladora_nome || 'Central de Regulação de Marabá'}
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleOpenEdit(m)}
                            className="p-2 rounded-xl text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all cursor-pointer"
                            title="Editar Município"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          {['SMS_ADMIN', 'COORDENADOR'].includes(role) && (
                            <button
                              onClick={() => handleDelete(m)}
                              className="p-2 rounded-xl text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-all cursor-pointer"
                              title="Excluir Município"
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
                totalPages={totalPages}
                totalItems={filteredMunicipios.length}
                itemsPerPage={itemsPerPage}
                onPageChange={(page: number) => setCurrentPage(page)}
              />
            </div>
          )}
        </div>

        {/* Modal de Criação / Edição */}
        {modalOpen && (
          <Portal>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="relative w-full max-w-lg rounded-3xl border border-border/50 bg-card p-6 md:p-8 shadow-2xl space-y-6">
                <div className="flex items-center justify-between border-b border-border/10 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                      <MapPin className="h-5 w-5" />
                    </div>
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Território & Pactuação</span>
                      <h3 className="text-base font-black text-foreground uppercase">
                        {editingIbge ? 'Editar Município' : 'Novo Município'}
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
                      Código IBGE (6 ou 7 Dígitos) *
                    </label>
                    <input
                      type="text"
                      required
                      disabled={!!editingIbge}
                      value={codigoIbge}
                      onChange={e => setCodigoIbge(e.target.value)}
                      placeholder="Ex: 1504208"
                      className="w-full rounded-2xl border border-border/50 bg-background/50 py-3 px-4 text-xs font-mono font-bold text-foreground outline-none focus:border-primary disabled:opacity-50"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5">
                      Nome do Município *
                    </label>
                    <input
                      type="text"
                      required
                      value={nome}
                      onChange={e => setNome(e.target.value)}
                      placeholder="Ex: MARABÁ, PARAUAPEBAS, ITUPIRANGA..."
                      className="w-full rounded-2xl border border-border/50 bg-background/50 py-3 px-4 text-xs font-bold text-foreground uppercase outline-none focus:border-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5">
                      Central Reguladora de Referência
                    </label>
                    <input
                      type="text"
                      value={centralReguladora}
                      onChange={e => setCentralReguladora(e.target.value)}
                      placeholder="Ex: CENTRAL DE REGULAÇÃO DE MARABÁ"
                      className="w-full rounded-2xl border border-border/50 bg-background/50 py-3 px-4 text-xs text-foreground uppercase outline-none focus:border-primary"
                    />
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
                      <span>{submitting ? 'Salvando...' : 'Salvar Município'}</span>
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
