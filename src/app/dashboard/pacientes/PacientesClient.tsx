'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { DashboardShell } from '@/components/layout/DashboardShell'
import { Pagination } from '@/components/ui/Pagination'
import { Portal } from '@/components/ui/Portal'
import { PhoneBadge, type PhoneStatus, type PhoneType } from '@/components/ui/PhoneBadge'
import { PhoneManager, type TelefoneData } from '@/components/ui/PhoneManager'
import { 
  Plus, Edit2, Trash2, X, User, Search, Filter, 
  Phone, Calendar, AlertCircle, FileText, Star
} from 'lucide-react'
import { savePacienteAction, deletePacienteAction } from './actions'
import { syncPacienteTelefonesAction, getPacienteTelefonesAction } from './telefone-actions'
import { useSystemModal } from '@/components/ui/SystemModal'
import { SearchableSelect } from '@/components/ui/SearchableSelect'

interface TelefoneDB {
  id: string
  numero: string
  tipo: PhoneType
  status: PhoneStatus
  prioridade: number
  nome_contato: string | null
  parentesco: string | null
  observacoes: string | null
}

interface Paciente {
  id: string
  cns_usuario: string
  cpf_usuario: string | null
  nome_usuario: string
  data_nascimento: string | null
  sexo: string | null
  nome_mae: string | null
  telefone_1: string | null
  telefone_2: string | null
  endereco: string | null
  municipio_origem: string | null
  observacoes: string | null
  pacientes_telefones?: TelefoneDB[]
}

interface PacientesClientProps {
  role: string
  email: string
  pacientes: Paciente[]
  totalItems: number
  itemsPerPage: number
  currentPage: number
  searchParam: string
  municipioParam: string
  municipios: string[]
}

export function PacientesClient({
  role,
  email,
  pacientes: initialPacientes,
  totalItems,
  itemsPerPage,
  currentPage,
  searchParam,
  municipioParam,
  municipios
}: PacientesClientProps) {
  const { showAlert, showConfirm } = useSystemModal()
  const router = useRouter()
  const pathname = usePathname()

  const [pacientes, setPacientes] = useState<Paciente[]>(initialPacientes)
  const [search, setSearch] = useState(searchParam)
  const [selectedMunicipio, setSelectedMunicipio] = useState(municipioParam)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | undefined>(undefined)

  useEffect(() => {
    setPacientes(initialPacientes)
  }, [initialPacientes])

  useEffect(() => {
    setSearch(searchParam)
  }, [searchParam])

  useEffect(() => {
    setSelectedMunicipio(municipioParam)
  }, [municipioParam])

  // Campos do Formulário
  const [nome, setNome] = useState('')
  const [cns, setCns] = useState('')
  const [cpf, setCpf] = useState('')
  const [nascimento, setNascimento] = useState('')
  const [sexo, setSexo] = useState('MASCULINO')
  const [mae, setMae] = useState('')
  const [endereco, setEndereco] = useState('')
  const [municipio, setMunicipio] = useState('MARABA')
  const [observacoes, setObservacoes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Opções para SearchableSelect de Municípios
  const municipioOptions = useMemo(() => {
    return (municipios || []).map(m => ({
      value: m,
      label: m
    }))
  }, [municipios])

  // Telefones (novo sistema multi-telefone)
  const [telefones, setTelefones] = useState<TelefoneData[]>([])
  const [loadingPhones, setLoadingPhones] = useState(false)

  // Auxiliares de Formatação e Máscaras
  const maskCpf = (value: string) => {
    const clean = value.replace(/\D/g, '').substring(0, 11)
    if (clean.length <= 3) return clean
    if (clean.length <= 6) return `${clean.substring(0, 3)}.${clean.substring(3)}`
    if (clean.length <= 9) return `${clean.substring(0, 3)}.${clean.substring(3, 6)}.${clean.substring(6)}`
    return `${clean.substring(0, 3)}.${clean.substring(3, 6)}.${clean.substring(6, 9)}-${clean.substring(9)}`
  }

  const maskPhone = (value: string) => {
    const clean = value.replace(/\D/g, '').substring(0, 11)
    if (clean.length <= 2) return clean
    if (clean.length <= 7) return `(${clean.substring(0, 2)}) ${clean.substring(2)}`
    return `(${clean.substring(0, 2)}) ${clean.substring(2, 7)}-${clean.substring(7)}`
  }

  const maskCns = (value: string) => {
    const clean = value.replace(/\D/g, '').substring(0, 15)
    if (clean.length <= 3) return clean
    if (clean.length <= 7) return `${clean.substring(0, 3)} ${clean.substring(3)}`
    if (clean.length <= 11) return `${clean.substring(0, 3)} ${clean.substring(3, 7)} ${clean.substring(7)}`
    return `${clean.substring(0, 3)} ${clean.substring(3, 7)} ${clean.substring(7, 11)} ${clean.substring(11)}`
  }

  const handleOpenCreate = () => {
    setEditingId(undefined)
    setNome('')
    setCns('')
    setCpf('')
    setNascimento('')
    setSexo('MASCULINO')
    setMae('')
    setEndereco('')
    setMunicipio('MARABA')
    setObservacoes('')
    setTelefones([])
    setModalOpen(true)
  }

  const handleOpenEdit = async (p: Paciente) => {
    setEditingId(p.id)
    setNome(p.nome_usuario || '')
    setCns(maskCns(p.cns_usuario || ''))
    setCpf(p.cpf_usuario ? maskCpf(p.cpf_usuario) : '')
    setNascimento(p.data_nascimento || '')
    setSexo(p.sexo || 'MASCULINO')
    setMae(p.nome_mae || '')
    setEndereco(p.endereco || '')
    setMunicipio(p.municipio_origem || 'MARABA')
    setObservacoes(p.observacoes || '')
    setModalOpen(true)

    // Carregar telefones do paciente
    setLoadingPhones(true)
    try {
      const res = await getPacienteTelefonesAction(p.id)
      if (res.success && res.data) {
        setTelefones(res.data.map((t: TelefoneDB) => ({
          id: t.id,
          numero: t.numero,
          tipo: t.tipo,
          status: t.status,
          prioridade: t.prioridade,
          nome_contato: t.nome_contato || '',
          parentesco: t.parentesco || '',
          observacoes: t.observacoes || '',
        })))
      } else {
        setTelefones([])
      }
    } catch {
      setTelefones([])
    } finally {
      setLoadingPhones(false)
    }
  }

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (selectedMunicipio) params.set('municipio', selectedMunicipio)
    params.set('page', '1')
    params.set('limit', itemsPerPage.toString())
    router.push(`${pathname}?${params.toString()}`)
  }

  const handleClearSearch = () => {
    setSearch('')
    setSelectedMunicipio('')
    router.push(`${pathname}?page=1&limit=${itemsPerPage}`)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const cleanCns = cns.replace(/\D/g, '')
    const cleanCpf = cpf ? cpf.replace(/\D/g, '') : ''

    if (cleanCns.length !== 15) {
      await showAlert({ title: 'Atenção', message: 'O Cartão SUS (CNS) deve conter exatamente 15 dígitos.', type: 'warning' })
      return
    }

    if (cleanCpf && cleanCpf.length !== 11) {
      await showAlert({ title: 'Atenção', message: 'O CPF do paciente deve conter exatamente 11 dígitos.', type: 'warning' })
      return
    }

    if (!nome.trim()) {
      await showAlert({ title: 'Atenção', message: 'O nome do paciente é obrigatório.', type: 'warning' })
      return
    }

    if (!nascimento) {
      await showAlert({ title: 'Atenção', message: 'A data de nascimento é obrigatória.', type: 'warning' })
      return
    }

    setSubmitting(true)
    try {
      // Extrair os 2 primeiros telefones ativos para os campos legados
      const telefonesAtivos = telefones
        .filter(t => t.status === 'ATIVO' && t.numero.replace(/\D/g, ''))
        .sort((a, b) => a.prioridade - b.prioridade)

      const res = await savePacienteAction(editingId, {
        cns_usuario: cleanCns,
        cpf_usuario: cleanCpf || null,
        nome_usuario: nome,
        data_nascimento: nascimento || null,
        sexo: sexo || null,
        nome_mae: mae || null,
        telefone_1: telefonesAtivos[0]?.numero.replace(/\D/g, '') || null,
        telefone_2: telefonesAtivos[1]?.numero.replace(/\D/g, '') || null,
        endereco: endereco || null,
        municipio_origem: municipio || null,
        observacoes: observacoes || null
      })

      if (!res.success) throw new Error(res.error)

      // Sincronizar telefones na tabela dedicada
      // Para paciente novo, precisamos do ID — buscar via CNS
      const pacienteId = editingId || res.pacienteId
      if (pacienteId && telefones.length > 0) {
        const syncRes = await syncPacienteTelefonesAction(pacienteId, telefones)
        if (!syncRes.success) {
          console.error('Erro ao sincronizar telefones:', syncRes.error)
        }
      }

      await showAlert({ title: 'Sucesso', message: editingId ? 'Ficha do paciente atualizada com sucesso!' : 'Paciente cadastrado com sucesso!', type: 'success' })
      
      // Recarregar a página para puxar os dados atualizados do banco
      window.location.reload()
      setModalOpen(false)
    } catch (err: any) {
      await showAlert({ title: 'Erro', message: err.message || 'Erro ao salvar paciente.', type: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (role !== 'SMS_ADMIN') {
      await showAlert({ title: 'Acesso Negado', message: 'Apenas usuários com perfil de Administrador podem excluir pacientes.', type: 'warning' })
      return
    }

    const confirmed = await showConfirm({
      title: 'Confirmar Exclusão',
      message: `Tem certeza de que deseja remover permanentemente o paciente "${name}"? Esta ação removerá em cascata todas as suas solicitações da fila!`,
      confirmText: 'Excluir',
      variant: 'danger'
    })
    
    if (!confirmed) return

    try {
      const res = await deletePacienteAction(id)
      if (!res.success) throw new Error(res.error)
      setPacientes(prev => prev.filter(p => p.id !== id))
      await showAlert({ title: 'Sucesso', message: 'Paciente e suas solicitações excluídos com sucesso!', type: 'success' })
    } catch (err: any) {
      await showAlert({ title: 'Erro', message: err.message || 'Erro ao remover paciente.', type: 'error' })
    }
  }

  const getAge = (birthDateString: string | null) => {
    if (!birthDateString) return 'N/I'
    const today = new Date()
    const birthDate = new Date(birthDateString)
    let age = today.getFullYear() - birthDate.getFullYear()
    const m = today.getMonth() - birthDate.getMonth()
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--
    }
    return `${age} anos`
  }

  // Renderizar telefones na tabela de listagem
  const renderPhoneColumn = (p: Paciente) => {
    const tels = p.pacientes_telefones || []
    
    if (tels.length === 0) {
      // Fallback para campos legados se tabela nova ainda não tiver dados
      if (p.telefone_1 || p.telefone_2) {
        return (
          <div className="flex flex-col gap-0.5 font-mono">
            {p.telefone_1 && <span>{maskPhone(p.telefone_1)}</span>}
            {p.telefone_2 && <span className="text-[10px] text-muted-foreground/60">{maskPhone(p.telefone_2)} (Recado)</span>}
          </div>
        )
      }
      return <span className="text-[10px] opacity-40 italic">Sem Contato</span>
    }

    const ativos = tels.filter(t => t.status === 'ATIVO').sort((a, b) => a.prioridade - b.prioridade)
    const inativos = tels.filter(t => t.status !== 'ATIVO')

    return (
      <div className="flex flex-col gap-1">
        {ativos.slice(0, 2).map((t, i) => (
          <div key={t.id} className="flex items-center gap-1.5">
            {i === 0 && <Star className="h-3 w-3 text-amber-500 fill-amber-500 shrink-0" />}
            <span className={`font-mono ${i === 0 ? 'text-xs' : 'text-[10px] text-muted-foreground/70'}`}>
              {maskPhone(t.numero)}
            </span>
            {t.tipo === 'RECADO' && (
              <span className="text-[8px] text-muted-foreground/50">(Recado)</span>
            )}
          </div>
        ))}
        {(ativos.length > 2 || inativos.length > 0) && (
          <span className="text-[8px] text-muted-foreground/40 font-bold">
            {ativos.length > 2 ? `+${ativos.length - 2} ativo(s)` : ''}
            {ativos.length > 2 && inativos.length > 0 ? ' · ' : ''}
            {inativos.length > 0 ? `${inativos.length} inativo(s)` : ''}
          </span>
        )}
        {ativos.length === 0 && inativos.length > 0 && (
          <span className="text-[10px] text-red-500/60 italic font-bold">Todos inativos ({inativos.length})</span>
        )}
      </div>
    )
  }

  return (
    <DashboardShell role={role} email={email}>
      <div className="space-y-8">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-3xl font-black text-foreground tracking-tighter uppercase">
              Fichas de <span className="text-primary italic">Pacientes</span>
            </h2>
            <p className="text-sm text-muted-foreground mt-2">
              Pesquise e gerencie as fichas médicas, informações de contato e residência dos cidadãos na regulação.
            </p>
          </div>
        </div>

        {/* Bento de Pesquisa */}
        <div className="bento-card p-6 md:p-8">
          <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="group flex-1 w-full">
              <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2 px-1">Buscar Paciente</label>
              <div className="relative">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="block w-full rounded-2xl border border-border/50 bg-background/50 py-3.5 px-4 pr-10 text-xs text-foreground outline-none focus:border-primary transition-all placeholder:text-muted-foreground/50"
                  placeholder="Nome do Paciente, Cartão SUS (CNS) ou CPF..."
                />
                <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-muted-foreground/40" />
              </div>
            </div>

            <div className="group w-full sm:w-64">
              <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2 px-1">Município</label>
              <SearchableSelect
                options={municipioOptions}
                value={selectedMunicipio}
                onChange={(val) => setSelectedMunicipio(val)}
                placeholder="Todos os Municípios"
                searchPlaceholder="Buscar município..."
                buttonClassName="rounded-2xl py-3.5"
              />
            </div>

            <div className="flex gap-2 shrink-0 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleClearSearch}
                className="w-1/2 sm:w-auto px-5 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-all cursor-pointer"
              >
                Limpar
              </button>
              <button
                type="submit"
                className="w-1/2 sm:w-auto px-6 py-3.5 rounded-2xl bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-widest hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer shadow-md shadow-primary/10 flex items-center justify-center gap-2"
              >
                <Filter className="h-3.5 w-3.5" />
                <span>Filtrar</span>
              </button>
            </div>
          </form>
        </div>

        {/* Tabela de Resultados */}
        <div className="bento-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border/20 bg-muted/20 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                  <th className="py-5 px-6">Cartão SUS (CNS)</th>
                  <th className="py-5 px-6">Nome Completo</th>
                  <th className="py-5 px-6">CPF</th>
                  <th className="py-5 px-6">Idade (Nascimento)</th>
                  <th className="py-5 px-6">Telefones</th>
                  <th className="py-5 px-6">Município</th>
                  <th className="py-5 px-6 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/10 text-xs font-semibold">
                {pacientes.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-muted-foreground font-bold">
                      Nenhum paciente localizado na base de dados.
                    </td>
                  </tr>
                ) : (
                  pacientes.map((p) => (
                    <tr key={p.id} className="hover:bg-muted/10 transition-colors">
                      <td className="py-4 px-6 font-mono text-muted-foreground">
                        {p.cns_usuario.substring(0, 3)} {p.cns_usuario.substring(3, 7)} {p.cns_usuario.substring(7, 11)} {p.cns_usuario.substring(11)}
                      </td>
                      <td className="py-4 px-6 font-bold text-foreground text-sm uppercase">{p.nome_usuario}</td>
                      <td className="py-4 px-6 font-mono text-muted-foreground">
                        {p.cpf_usuario 
                          ? `${p.cpf_usuario.substring(0, 3)}.${p.cpf_usuario.substring(3, 6)}.${p.cpf_usuario.substring(6, 9)}-${p.cpf_usuario.substring(9)}`
                          : <span className="text-[10px] opacity-40 italic">Não Informado</span>
                        }
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex flex-col">
                          <span>{getAge(p.data_nascimento)}</span>
                          <span className="text-[9px] text-muted-foreground/60 font-mono mt-0.5">{p.data_nascimento || 'N/I'}</span>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        {renderPhoneColumn(p)}
                      </td>
                      <td className="py-4 px-6 text-muted-foreground uppercase">{p.municipio_origem || 'MARABA'}</td>
                      <td className="py-4 px-6 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleOpenEdit(p)}
                            className="p-2 rounded-xl hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors cursor-pointer"
                            title="Visualizar/Editar"
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

          <Pagination
            totalItems={totalItems}
            itemsPerPage={itemsPerPage}
            currentPage={currentPage}
          />
        </div>

      </div>

      {/* Drawer Lateral - Formulário CRUD */}
      {modalOpen && (
        <Portal>
          <div className="fixed inset-0 z-50 overflow-hidden">
          <div 
            className="absolute inset-0 bg-background/80 backdrop-blur-sm transition-opacity duration-300"
            onClick={() => setModalOpen(false)}
          />
          <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-xl bg-card border-l border-border/40 shadow-2xl flex flex-col h-full overflow-y-auto animate-in slide-in-from-right duration-350">
              
              {/* Header */}
              <div className="p-6 md:p-8 border-b border-border/10 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                    <User className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Ficha Médica / Contato</span>
                    <h3 className="text-lg font-black text-foreground uppercase mt-1">
                      {editingId ? 'Editar Paciente' : 'Novo Paciente'}
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
                
                {/* Nome */}
                <div className="group">
                  <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2 px-1">Nome do Paciente</label>
                  <input
                    type="text"
                    required
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    className="block w-full rounded-2xl border border-border/50 bg-background/50 py-3.5 px-4 text-xs text-foreground outline-none focus:border-primary transition-all uppercase"
                    placeholder="Ex: FRANCISCO ASSIS SOUZA"
                  />
                </div>

                <div className="grid gap-6 sm:grid-cols-2">
                  {/* CNS */}
                  <div className="group">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2 px-1">Cartão SUS (CNS)</label>
                    <input
                      type="text"
                      required
                      value={cns}
                      onChange={(e) => setCns(maskCns(e.target.value))}
                      className="block w-full rounded-2xl border border-border/50 bg-background/50 py-3.5 px-4 text-xs text-foreground outline-none focus:border-primary transition-all font-mono"
                      placeholder="898 0000 0000 0000"
                    />
                  </div>

                  {/* CPF */}
                  <div className="group">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2 px-1">CPF (Opcional)</label>
                    <input
                      type="text"
                      value={cpf}
                      onChange={(e) => setCpf(maskCpf(e.target.value))}
                      className="block w-full rounded-2xl border border-border/50 bg-background/50 py-3.5 px-4 text-xs text-foreground outline-none focus:border-primary transition-all font-mono"
                      placeholder="000.000.000-00"
                    />
                  </div>
                </div>

                <div className="grid gap-6 sm:grid-cols-2">
                  {/* Data Nascimento */}
                  <div className="group">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2 px-1">Data de Nascimento</label>
                    <div className="relative">
                      <input
                        type="date"
                        required
                        value={nascimento}
                        onChange={(e) => setNascimento(e.target.value)}
                        className="block w-full rounded-2xl border border-border/50 bg-background/50 py-3.5 px-4 text-xs text-foreground outline-none focus:border-primary transition-all"
                      />
                      <Calendar className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/45 pointer-events-none" />
                    </div>
                  </div>

                  {/* Sexo */}
                  <div className="group">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2 px-1">Sexo</label>
                    <select
                      value={sexo}
                      onChange={(e) => setSexo(e.target.value)}
                      className="block w-full rounded-2xl border border-border/50 bg-background/50 py-3.5 px-4 text-xs text-foreground outline-none focus:border-primary transition-all"
                    >
                      <option value="MASCULINO">Masculino</option>
                      <option value="FEMININO">Feminino</option>
                      <option value="OUTRO">Outro / Não Informado</option>
                    </select>
                  </div>
                </div>

                {/* Nome da Mãe */}
                <div className="group">
                  <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2 px-1">Nome da Mãe (Opcional)</label>
                  <input
                    type="text"
                    value={mae}
                    onChange={(e) => setMae(e.target.value)}
                    className="block w-full rounded-2xl border border-border/50 bg-background/50 py-3.5 px-4 text-xs text-foreground outline-none focus:border-primary transition-all uppercase"
                    placeholder="Ex: MARIA JOSE SOUZA"
                  />
                </div>

                {/* ========== SEÇÃO DE TELEFONES (NOVO) ========== */}
                <div className="border-t border-border/10 pt-6">
                  {loadingPhones ? (
                    <div className="flex items-center justify-center py-8 text-muted-foreground/50">
                      <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full mr-3" />
                      <span className="text-[10px] font-bold uppercase tracking-widest">Carregando telefones...</span>
                    </div>
                  ) : (
                    <PhoneManager
                      telefones={telefones}
                      onChange={setTelefones}
                    />
                  )}
                </div>

                {/* Município de Origem */}
                <div className="group">
                  <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2 px-1">Município de Residência</label>
                  <SearchableSelect
                    options={municipioOptions}
                    value={municipio}
                    onChange={(val) => setMunicipio(val || 'MARABA')}
                    placeholder="Selecione o Município..."
                    searchPlaceholder="Buscar município..."
                    buttonClassName="rounded-2xl py-3.5 font-bold uppercase"
                  />
                </div>

                {/* Endereço */}
                <div className="group">
                  <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2 px-1">Endereço Completo</label>
                  <textarea
                    value={endereco}
                    onChange={(e) => setEndereco(e.target.value)}
                    rows={2}
                    className="block w-full rounded-2xl border border-border/50 bg-background/50 py-3 px-4 text-xs text-foreground outline-none focus:border-primary transition-all"
                    placeholder="Ex: RUA CINCO, 120 - NOVA MARABA"
                  />
                </div>

                {/* Observações */}
                <div className="group">
                  <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2 px-1">Observações Internas (Histórico/Alergias/etc.)</label>
                  <textarea
                    value={observacoes}
                    onChange={(e) => setObservacoes(e.target.value)}
                    rows={2}
                    className="block w-full rounded-2xl border border-border/50 bg-background/50 py-3 px-4 text-xs text-foreground outline-none focus:border-primary transition-all"
                    placeholder="Ex: Paciente possui alergia a dipirona."
                  />
                </div>

                {/* Form Actions */}
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
