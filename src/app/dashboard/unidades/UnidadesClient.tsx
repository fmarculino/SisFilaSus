'use client'

import React, { useState, useMemo } from 'react'
import { DashboardShell } from '@/components/layout/DashboardShell'
import { 
  Plus, Edit2, X, Building2, Check, 
  Search, Trash2, MapPin
} from 'lucide-react'
import { Portal } from '@/components/ui/Portal'
import { saveUnidade, deleteUnidade } from './actions'
import { useSystemModal } from '@/components/ui/SystemModal'
import { SearchableSelect } from '@/components/ui/SearchableSelect'
import { Pagination } from '@/components/ui/Pagination'

interface UnidadesClientProps {
  role: string
  email: string
  initialUnidades: any[]
  municipios: { codigo_ibge: string; nome: string }[]
}

const TIPOS_UNIDADE = [
  'CENTRO DE SAUDE / UNIDADE BASICA',
  'ESTRATEGIA DE SAUDE DA FAMILIA (ESF)',
  'POLICLINICA / CENTRO DE ESPECIALIDADES',
  'HOSPITAL GERAL',
  'HOSPITAL ESPECIALIZADO',
  'CENTRAL DE REGULACAO',
  'CAPS / SAUDE MENTAL',
  'SECRETARIA MUNICIPAL DE SAUDE',
  'OUTROS'
]

export function UnidadesClient({
  role,
  email,
  initialUnidades,
  municipios
}: UnidadesClientProps) {
  const { showAlert, showConfirm } = useSystemModal()
  const [unidades, setUnidades] = useState(initialUnidades)
  const [search, setSearch] = useState('')
  const [selectedMunicipioFilter, setSelectedMunicipioFilter] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 20

  const [modalOpen, setModalOpen] = useState(false)
  const [editingCnes, setEditingCnes] = useState<string | undefined>(undefined)

  // Form states
  const [cnes, setCnes] = useState('')
  const [nome, setNome] = useState('')
  const [municipioIbge, setMunicipioIbge] = useState('')
  const [tipo, setTipo] = useState('CENTRO DE SAUDE / UNIDADE BASICA')
  const [submitting, setSubmitting] = useState(false)

  // Opções para SearchableSelect de Municípios
  const municipioOptions = useMemo(() => {
    return municipios.map(m => ({
      value: m.codigo_ibge,
      label: m.nome,
      subLabel: `IBGE: ${m.codigo_ibge}`
    }))
  }, [municipios])

  // Filtragem
  const filteredUnidades = useMemo(() => {
    return unidades.filter(u => {
      const q = search.toLowerCase().trim()
      const matchSearch = !q || 
        u.cnes.includes(q) || 
        u.nome.toLowerCase().includes(q) ||
        (u.tipo && u.tipo.toLowerCase().includes(q)) ||
        (u.municipios?.nome && u.municipios.nome.toLowerCase().includes(q))

      const matchMun = !selectedMunicipioFilter || u.municipio_ibge === selectedMunicipioFilter

      return matchSearch && matchMun
    })
  }, [unidades, search, selectedMunicipioFilter])

  // Paginação
  const paginatedUnidades = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return filteredUnidades.slice(start, start + itemsPerPage)
  }, [filteredUnidades, currentPage])

  const totalPages = Math.ceil(filteredUnidades.length / itemsPerPage)

  const handleOpenCreate = () => {
    setEditingCnes(undefined)
    setCnes('')
    setNome('')
    setMunicipioIbge('')
    setTipo('CENTRO DE SAUDE / UNIDADE BASICA')
    setModalOpen(true)
  }

  const handleOpenEdit = (u: any) => {
    setEditingCnes(u.cnes)
    setCnes(u.cnes)
    setNome(u.nome)
    setMunicipioIbge(u.municipio_ibge || '')
    setTipo(u.tipo || 'CENTRO DE SAUDE / UNIDADE BASICA')
    setModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!cnes.trim()) {
      await showAlert({ title: 'CNES Obrigatório', message: 'O código CNES da unidade é obrigatório.', type: 'warning' })
      return
    }

    if (!nome.trim()) {
      await showAlert({ title: 'Nome Obrigatório', message: 'O nome da unidade solicitante é obrigatório.', type: 'warning' })
      return
    }

    setSubmitting(true)
    try {
      await saveUnidade(editingCnes, {
        cnes,
        nome,
        municipio_ibge: municipioIbge || null,
        tipo
      })

      await showAlert({
        title: 'Sucesso',
        message: editingCnes ? 'Unidade atualizada com sucesso!' : 'Unidade cadastrada com sucesso!',
        type: 'success'
      })

      const munObj = municipios.find(m => m.codigo_ibge === municipioIbge)

      const updatedObj = {
        cnes: cnes.trim(),
        nome: nome.trim().toUpperCase(),
        municipio_ibge: municipioIbge || null,
        tipo: tipo.trim().toUpperCase(),
        municipios: munObj ? { codigo_ibge: munObj.codigo_ibge, nome: munObj.nome } : null
      }

      if (editingCnes) {
        setUnidades(prev => prev.map(u => u.cnes === editingCnes ? { ...u, ...updatedObj } : u))
      } else {
        setUnidades(prev => [updatedObj, ...prev])
      }

      setModalOpen(false)
    } catch (err: any) {
      await showAlert({
        title: 'Erro ao Salvar',
        message: err.message || 'Falha ao salvar unidade.',
        type: 'error'
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (u: any) => {
    const confirmed = await showConfirm({
      title: 'Excluir Unidade?',
      message: `Tem certeza que deseja excluir a unidade "${u.nome}" (CNES: ${u.cnes})? Esta ação falhará caso ela possua solicitações na fila.`,
      confirmText: 'Sim, Excluir',
      cancelText: 'Cancelar',
      variant: 'danger'
    })

    if (!confirmed) return

    try {
      await deleteUnidade(u.cnes)
      setUnidades(prev => prev.filter(item => item.cnes !== u.cnes))
      await showAlert({ title: 'Excluído', message: 'Unidade removida com sucesso.', type: 'success' })
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
              Unidades <span className="text-primary italic">Solicitantes</span>
            </h2>
            <p className="text-sm text-muted-foreground mt-2">
              Gerencie postos de saúde, UBSs, hospitais e unidades que inserem pacientes na fila.
            </p>
          </div>

          <button
            onClick={handleOpenCreate}
            className="flex items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3.5 text-xs font-black uppercase tracking-widest text-primary-foreground shadow-lg shadow-primary/20 hover:opacity-90 active:scale-95 transition-all cursor-pointer"
          >
            <Plus className="h-4 w-4 stroke-[3]" />
            <span>Cadastrar Unidade</span>
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
                placeholder="Buscar por CNES, nome da unidade, tipo ou município..."
                className="w-full rounded-2xl border border-border/50 bg-background/50 py-3.5 pl-11 pr-4 text-xs text-foreground outline-none focus:border-primary transition-all placeholder:text-muted-foreground/50"
              />
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-muted-foreground/40" />
            </div>

            <div>
              <SearchableSelect
                options={municipioOptions}
                value={selectedMunicipioFilter}
                onChange={val => {
                  setSelectedMunicipioFilter(val)
                  setCurrentPage(1)
                }}
                placeholder="Filtrar Município..."
                searchPlaceholder="Buscar município..."
                buttonClassName="rounded-2xl py-3.5"
              />
            </div>
          </div>
        </div>

        {/* Tabela de Unidades */}
        <div className="bento-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border/40 bg-muted/30 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                <tr>
                  <th className="py-4 px-6">CNES</th>
                  <th className="py-4 px-6">Nome da Unidade</th>
                  <th className="py-4 px-6">Tipo de Estabelecimento</th>
                  <th className="py-4 px-6">Município</th>
                  <th className="py-4 px-6 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {paginatedUnidades.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-muted-foreground">
                      Nenhuma unidade solicitante encontrada.
                    </td>
                  </tr>
                ) : (
                  paginatedUnidades.map((u) => (
                    <tr key={u.cnes} className="hover:bg-muted/10 transition-colors">
                      <td className="py-4 px-6 font-mono font-bold text-foreground">
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-mono text-[11px] font-black shrink-0">
                            <Building2 className="h-4 w-4" />
                          </div>
                          <span>{u.cnes}</span>
                        </div>
                      </td>
                      <td className="py-4 px-6 font-bold text-foreground max-w-md">
                        {u.nome}
                      </td>
                      <td className="py-4 px-6 text-muted-foreground">
                        <span className="text-[10px] font-bold uppercase bg-muted/40 px-2.5 py-1 rounded-lg border border-border/30">
                          {u.tipo || 'UBS'}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-1.5 text-foreground font-medium">
                          <MapPin className="h-3.5 w-3.5 text-primary" />
                          <span>{u.municipios?.nome || 'Marabá (Sede)'}</span>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleOpenEdit(u)}
                            className="p-2 rounded-xl text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all cursor-pointer"
                            title="Editar Unidade"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          {['SMS_ADMIN', 'COORDENADOR'].includes(role) && (
                            <button
                              onClick={() => handleDelete(u)}
                              className="p-2 rounded-xl text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-all cursor-pointer"
                              title="Excluir Unidade"
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
                totalItems={filteredUnidades.length}
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
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Rede de Saúde</span>
                      <h3 className="text-base font-black text-foreground uppercase">
                        {editingCnes ? 'Editar Unidade Solicitante' : 'Nova Unidade Solicitante'}
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
                      Código CNES (7 a 10 Dígitos) *
                    </label>
                    <input
                      type="text"
                      required
                      disabled={!!editingCnes}
                      value={cnes}
                      onChange={e => setCnes(e.target.value)}
                      placeholder="Ex: 2314567"
                      className="w-full rounded-2xl border border-border/50 bg-background/50 py-3 px-4 text-xs font-mono font-bold text-foreground outline-none focus:border-primary disabled:opacity-50"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5">
                      Nome Oficial da Unidade *
                    </label>
                    <input
                      type="text"
                      required
                      value={nome}
                      onChange={e => setNome(e.target.value)}
                      placeholder="Ex: UBS ENFERMEIRA ZEZINHA"
                      className="w-full rounded-2xl border border-border/50 bg-background/50 py-3 px-4 text-xs font-bold text-foreground uppercase outline-none focus:border-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5">
                      Tipo de Estabelecimento
                    </label>
                    <select
                      value={tipo}
                      onChange={e => setTipo(e.target.value)}
                      className="w-full rounded-2xl border border-border/50 bg-background/50 py-3 px-4 text-xs text-foreground outline-none focus:border-primary"
                    >
                      {TIPOS_UNIDADE.map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5">
                      Município de Localização
                    </label>
                    <SearchableSelect
                      options={municipioOptions}
                      value={municipioIbge}
                      onChange={val => setMunicipioIbge(val)}
                      placeholder="Selecione o Município..."
                      searchPlaceholder="Buscar município por nome ou IBGE..."
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
                      <span>{submitting ? 'Salvando...' : 'Salvar Unidade'}</span>
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
