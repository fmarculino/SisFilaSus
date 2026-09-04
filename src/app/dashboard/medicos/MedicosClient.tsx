'use client'

import React, { useState, useMemo } from 'react'
import { DashboardShell } from '@/components/layout/DashboardShell'
import { 
  Plus, Edit2, X, UserCheck, Check, 
  Search, ShieldCheck, ShieldAlert, Phone, Mail, Building2, Stethoscope
} from 'lucide-react'
import { Portal } from '@/components/ui/Portal'
import { saveMedico, toggleMedicoStatus } from './actions'
import { useSystemModal } from '@/components/ui/SystemModal'
import { SearchableSelect } from '@/components/ui/SearchableSelect'

interface MedicosClientProps {
  role: string
  email: string
  initialMedicos: any[]
  especialidades: { id: string; nome: string }[]
  prestadores: { id: string; nome: string; cnes: string }[]
}

export function MedicosClient({ 
  role, 
  email, 
  initialMedicos,
  especialidades,
  prestadores
}: MedicosClientProps) {
  const { showAlert } = useSystemModal()
  const [medicos, setMedicos] = useState(initialMedicos)
  const [search, setSearch] = useState('')
  const [selectedSpecFilter, setSelectedSpecFilter] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | undefined>(undefined)

  // Form states
  const [nome, setNome] = useState('')
  const [crm, setCrm] = useState('')
  const [ufCrm, setUfCrm] = useState('PA')
  const [especialidadeId, setEspecialidadeId] = useState('')
  const [hospitalId, setHospitalId] = useState('')
  const [telefone, setTelefone] = useState('')
  const [medicoEmail, setMedicoEmail] = useState('')
  const [active, setActive] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // Opções para SearchableSelect de Especialidades
  const especialidadeOptions = useMemo(() => {
    return especialidades.map(esp => ({
      value: esp.id,
      label: esp.nome
    }))
  }, [especialidades])

  // Opções para SearchableSelect de Prestadores
  const prestadorOptions = useMemo(() => {
    return prestadores.map(p => ({
      value: p.id,
      label: p.nome,
      subLabel: `CNES: ${p.cnes}`
    }))
  }, [prestadores])

  // Filtro de listagem
  const filteredMedicos = useMemo(() => {
    return medicos.filter(m => {
      const q = search.toLowerCase()
      const matchSearch = !q || 
        m.nome.toLowerCase().includes(q) || 
        m.crm.toLowerCase().includes(q) ||
        (m.especialidades?.nome && m.especialidades.nome.toLowerCase().includes(q)) ||
        (m.especialidade_nome && m.especialidade_nome.toLowerCase().includes(q)) ||
        (m.hospitais_prestadores?.nome && m.hospitais_prestadores.nome.toLowerCase().includes(q))

      const matchSpec = !selectedSpecFilter || m.especialidade_id === selectedSpecFilter

      return matchSearch && matchSpec
    })
  }, [medicos, search, selectedSpecFilter])

  const handleOpenCreate = () => {
    setEditingId(undefined)
    setNome('')
    setCrm('')
    setUfCrm('PA')
    setEspecialidadeId('')
    setHospitalId('')
    setTelefone('')
    setMedicoEmail('')
    setActive(true)
    setModalOpen(true)
  }

  const handleOpenEdit = (m: any) => {
    setEditingId(m.id)
    setNome(m.nome || '')
    setCrm(m.crm || '')
    setUfCrm(m.uf_crm || 'PA')
    setEspecialidadeId(m.especialidade_id || '')
    setHospitalId(m.hospital_id || '')
    setTelefone(m.telefone || '')
    setMedicoEmail(m.email || '')
    setActive(m.active)
    setModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!nome.trim()) {
      await showAlert({ title: 'Nome Obrigatório', message: 'O nome do médico é obrigatório.', type: 'warning' })
      return
    }

    if (!crm.trim()) {
      await showAlert({ title: 'CRM Obrigatório', message: 'O CRM do médico é obrigatório.', type: 'warning' })
      return
    }

    const selectedSpecObj = especialidades.find(e => e.id === especialidadeId)

    setSubmitting(true)
    try {
      await saveMedico(editingId, {
        nome,
        crm,
        uf_crm: ufCrm,
        especialidade_id: especialidadeId || null,
        especialidade_nome: selectedSpecObj?.nome || null,
        hospital_id: hospitalId || null,
        telefone,
        email: medicoEmail,
        active
      })

      await showAlert({
        title: 'Sucesso',
        message: editingId ? 'Médico atualizado com sucesso!' : 'Médico cadastrado com sucesso!',
        type: 'success'
      })

      const prestadorObj = prestadores.find(p => p.id === hospitalId)

      if (editingId) {
        setMedicos(prev => prev.map(m => 
          m.id === editingId ? {
            ...m,
            nome: nome.trim().toUpperCase(),
            crm: crm.trim(),
            uf_crm: ufCrm,
            especialidade_id: especialidadeId,
            especialidade_nome: selectedSpecObj?.nome || null,
            especialidades: selectedSpecObj ? { id: selectedSpecObj.id, nome: selectedSpecObj.nome } : null,
            hospital_id: hospitalId,
            hospitais_prestadores: prestadorObj ? { id: prestadorObj.id, nome: prestadorObj.nome, cnes: prestadorObj.cnes } : null,
            telefone,
            email: medicoEmail,
            active
          } : m
        ))
      } else {
        setMedicos(prev => [
          ...prev,
          {
            id: crypto.randomUUID(),
            nome: nome.trim().toUpperCase(),
            crm: crm.trim(),
            uf_crm: ufCrm,
            especialidade_id: especialidadeId,
            especialidade_nome: selectedSpecObj?.nome || null,
            especialidades: selectedSpecObj ? { id: selectedSpecObj.id, nome: selectedSpecObj.nome } : null,
            hospital_id: hospitalId,
            hospitais_prestadores: prestadorObj ? { id: prestadorObj.id, nome: prestadorObj.nome, cnes: prestadorObj.cnes } : null,
            telefone,
            email: medicoEmail,
            active,
            created_at: new Date().toISOString()
          }
        ])
      }

      setModalOpen(false)
    } catch (err: any) {
      await showAlert({
        title: 'Erro ao Salvar',
        message: err.message || 'Falha ao salvar médico.',
        type: 'error'
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleToggleStatus = async (m: any) => {
    const nextStatus = !m.active
    try {
      await toggleMedicoStatus(m.id, nextStatus)
      setMedicos(prev => prev.map(item => 
        item.id === m.id ? { ...item, active: nextStatus } : item
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
              Corpo <span className="text-primary italic">Médico</span>
            </h2>
            <p className="text-sm text-muted-foreground mt-2">
              Cadastre e gerencie os médicos credenciados, CRM, especialidades e hospitais vinculados.
            </p>
          </div>

          <button
            onClick={handleOpenCreate}
            className="flex items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3.5 text-xs font-black uppercase tracking-widest text-primary-foreground shadow-lg shadow-primary/20 hover:opacity-90 active:scale-95 transition-all cursor-pointer"
          >
            <Plus className="h-4 w-4 stroke-[3]" />
            <span>Cadastrar Médico</span>
          </button>
        </div>

        {/* Bento Filtros */}
        <div className="bento-card p-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="relative md:col-span-2">
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar por nome, CRM, especialidade ou hospital..."
                className="w-full rounded-2xl border border-border/50 bg-background/50 py-3.5 pl-11 pr-4 text-xs text-foreground outline-none focus:border-primary transition-all placeholder:text-muted-foreground/50"
              />
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-muted-foreground/40" />
            </div>

            <div>
              <SearchableSelect
                options={especialidadeOptions}
                value={selectedSpecFilter}
                onChange={val => setSelectedSpecFilter(val)}
                placeholder="Filtrar Especialidade..."
                searchPlaceholder="Buscar especialidade..."
                buttonClassName="rounded-2xl py-3.5"
              />
            </div>
          </div>
        </div>

        {/* Tabela de Médicos */}
        <div className="bento-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border/40 bg-muted/30 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                <tr>
                  <th className="py-4 px-6">Médico / CRM</th>
                  <th className="py-4 px-6">Especialidade Principal</th>
                  <th className="py-4 px-6">Hospital / Prestador</th>
                  <th className="py-4 px-6">Contato</th>
                  <th className="py-4 px-6 text-center">Status</th>
                  <th className="py-4 px-6 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {filteredMedicos.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-muted-foreground">
                      Nenhum médico encontrado com os critérios pesquisados.
                    </td>
                  </tr>
                ) : (
                  filteredMedicos.map((m) => (
                    <tr key={m.id} className="hover:bg-muted/10 transition-colors">
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-black">
                            <UserCheck className="h-4.5 w-4.5" />
                          </div>
                          <div className="flex flex-col">
                            <span className="font-bold text-foreground tracking-wide text-xs">
                              {m.nome}
                            </span>
                            <span className="text-[10px] text-muted-foreground font-mono">
                              CRM: {m.crm}-{m.uf_crm}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        {m.especialidades?.nome || m.especialidade_nome ? (
                          <span className="px-2.5 py-1 text-[10px] font-black uppercase rounded-lg bg-primary/10 text-primary border border-primary/20">
                            {m.especialidades?.nome || m.especialidade_nome}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/60">Não especificada</span>
                        )}
                      </td>
                      <td className="py-4 px-6">
                        {m.hospitais_prestadores?.nome ? (
                          <div className="flex items-center gap-1.5 text-foreground font-medium">
                            <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                            <span>{m.hospitais_prestadores.nome}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground/60">Central de Regulação (Padrão)</span>
                        )}
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex flex-col gap-0.5 text-[10px] text-muted-foreground">
                          {m.telefone && (
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {m.telefone}
                            </span>
                          )}
                          {m.email && (
                            <span className="flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {m.email}
                            </span>
                          )}
                          {!m.telefone && !m.email && <span>—</span>}
                        </div>
                      </td>
                      <td className="py-4 px-6 text-center">
                        <button
                          onClick={() => handleToggleStatus(m)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${
                            m.active 
                              ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500/20' 
                              : 'bg-zinc-500/10 text-zinc-500 border border-zinc-500/20 hover:bg-zinc-500/20'
                          }`}
                        >
                          {m.active ? <ShieldCheck className="h-3.5 w-3.5" /> : <ShieldAlert className="h-3.5 w-3.5" />}
                          <span>{m.active ? 'Ativo' : 'Inativo'}</span>
                        </button>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <button
                          onClick={() => handleOpenEdit(m)}
                          className="p-2 rounded-xl text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all cursor-pointer"
                          title="Editar Médico"
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

        {/* Modal de Cadastro / Edição com Busca Incremental de Especialidade e Hospital */}
        {modalOpen && (
          <Portal>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="relative w-full max-w-xl rounded-3xl border border-border/80 bg-card text-card-foreground p-6 md:p-8 shadow-[0_25px_70px_rgba(0,0,0,0.3)] space-y-6 animate-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between border-b border-border/10 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                      <UserCheck className="h-5 w-5" />
                    </div>
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Corpo Clínico</span>
                      <h3 className="text-base font-black text-foreground uppercase">
                        {editingId ? 'Editar Médico' : 'Cadastrar Novo Médico'}
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
                      Nome Completo do Médico *
                    </label>
                    <input
                      type="text"
                      required
                      value={nome}
                      onChange={e => setNome(e.target.value)}
                      placeholder="Ex: DR. MARCOS VINÍCIUS SILVA"
                      className="w-full rounded-2xl border border-border/50 bg-background/50 py-3 px-4 text-xs font-bold text-foreground uppercase outline-none focus:border-primary"
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="sm:col-span-2">
                      <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5">
                        Número CRM *
                      </label>
                      <input
                        type="text"
                        required
                        value={crm}
                        onChange={e => setCrm(e.target.value)}
                        placeholder="Ex: 12345"
                        className="w-full rounded-2xl border border-border/50 bg-background/50 py-3 px-4 text-xs font-mono font-bold text-foreground outline-none focus:border-primary"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5">
                        UF CRM
                      </label>
                      <input
                        type="text"
                        maxLength={2}
                        value={ufCrm}
                        onChange={e => setUfCrm(e.target.value.toUpperCase())}
                        placeholder="PA"
                        className="w-full rounded-2xl border border-border/50 bg-background/50 py-3 px-4 text-xs font-mono font-bold text-foreground uppercase outline-none focus:border-primary text-center"
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5">
                        Especialidade Principal
                      </label>
                      <SearchableSelect
                        options={especialidadeOptions}
                        value={especialidadeId}
                        onChange={val => setEspecialidadeId(val)}
                        placeholder="Selecione a especialidade..."
                        searchPlaceholder="Buscar especialidade..."
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5">
                        Hospital / Prestador Vinculado
                      </label>
                      <SearchableSelect
                        options={prestadorOptions}
                        value={hospitalId}
                        onChange={val => setHospitalId(val)}
                        placeholder="Central de Regulação (Padrão)"
                        searchPlaceholder="Buscar hospital..."
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5">
                        Telefone / WhatsApp
                      </label>
                      <input
                        type="text"
                        value={telefone}
                        onChange={e => setTelefone(e.target.value)}
                        placeholder="(94) 99999-9999"
                        className="w-full rounded-2xl border border-border/50 bg-background/50 py-3 px-4 text-xs text-foreground outline-none focus:border-primary"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5">
                        E-mail
                      </label>
                      <input
                        type="email"
                        value={medicoEmail}
                        onChange={e => setMedicoEmail(e.target.value)}
                        placeholder="medico@hospital.com"
                        className="w-full rounded-2xl border border-border/50 bg-background/50 py-3 px-4 text-xs text-foreground outline-none focus:border-primary"
                      />
                    </div>
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
                      <span>{active ? 'Médico Ativo no Sistema' : 'Médico Inativo'}</span>
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
                      <span>{submitting ? 'Salvando...' : 'Salvar Médico'}</span>
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
