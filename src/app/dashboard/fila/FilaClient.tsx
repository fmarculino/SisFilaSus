'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { DashboardShell } from '@/components/layout/DashboardShell'
import { Pagination } from '@/components/ui/Pagination'
import { 
  Search, Filter, Eye, Phone, MessageSquare, Plus, X, 
  Activity, ArrowUpRight, Calendar, User, FileText, CheckCircle2, AlertTriangle,
  ArrowUpDown
} from 'lucide-react'
import { fetchSolicitacaoExtraData, updatePatientPhone, createContactLog, proposeMovement, updateSolicitacaoStatus, encaminharParaPrestador } from './actions'


const formatPhone = (value: string) => {
  if (!value) return ''
  const clean = value.replace(/\D/g, '')
  if (clean.length === 0) return ''
  
  if (clean.length <= 2) {
    return `(${clean}`
  }
  if (clean.length <= 6) {
    return `(${clean.slice(0, 2)}) ${clean.slice(2)}`
  }
  if (clean.length <= 10) {
    return `(${clean.slice(0, 2)}) ${clean.slice(2, 6)}-${clean.slice(6)}`
  }
  return `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7, 11)}`
}

interface FilaClientProps {
  role: string
  email: string
  solicitacoes: any[]
  totalItems: number
  itemsPerPage: number
  currentPage: number
  procedimentos: any[]
  municipios: any[]
  especialidades: string[]
  omitirForaSisregDefault?: boolean
  anosLimpezaFila?: number
  appliedFilters: {
    search: string
    proced: string
    municipio: string
    risco: string
    status: string
    tipo: string
    antigas: string
    omitirForaSisreg: string
    especialidade: string
    modalidade: string
  }
}

export function FilaClient({
  role,
  email,
  solicitacoes,
  totalItems,
  itemsPerPage,
  currentPage,
  procedimentos,
  municipios,
  especialidades,
  omitirForaSisregDefault = true,
  anosLimpezaFila = 5,
  appliedFilters,
}: FilaClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // Estados dos filtros locais
  const [search, setSearch] = useState(appliedFilters.search)
  const [proced, setProced] = useState(appliedFilters.proced)
  const [municipio, setMunicipio] = useState(appliedFilters.municipio)
  const [risco, setRisco] = useState(appliedFilters.risco)
  const [status, setStatus] = useState(appliedFilters.status)
  const [tipo, setTipo] = useState(appliedFilters.tipo)
  const [antigas, setAntigas] = useState(appliedFilters.antigas || 'false')
  const [omitirForaSisreg, setOmitirForaSisreg] = useState(appliedFilters.omitirForaSisreg || 'true')
  const [especialidade, setEspecialidade] = useState(appliedFilters.especialidade || '')
  const [modalidade, setModalidade] = useState(appliedFilters.modalidade || '')

  // Estados para busca incremental de procedimentos no filtro
  const [procedDropdownOpen, setProcedDropdownOpen] = useState(false)
  const [procedSearchQuery, setProcedSearchQuery] = useState('')
  const procedContainerRef = useRef<HTMLDivElement>(null)

  // Sincronizar o termo de busca com o procedimento selecionado
  useEffect(() => {
    const selected = procedimentos.find(p => p.cod_sigtap === proced)
    setProcedSearchQuery(selected ? selected.desc_sigtap.trim() : '')
  }, [proced, procedimentos])

  // Fechar o menu de procedimentos ao clicar fora do componente
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (procedContainerRef.current && !procedContainerRef.current.contains(event.target as Node)) {
        setProcedDropdownOpen(false)
        const selected = procedimentos.find(p => p.cod_sigtap === proced)
        setProcedSearchQuery(selected ? selected.desc_sigtap.trim() : '')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [proced, procedimentos])

  // Drawer (Detalhamento)
  const [selectedSol, setSelectedSol] = useState<any | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerLoading, setDrawerLoading] = useState(false)
  
  const [extraData, setExtraData] = useState<{
    snapshots: any[]
    contatos: any[]
    templates: any[]
    prestadores: any[]
    hospitalEncaminhado: any | null
    dataEncaminhamento: string | null
    dataInternacao: string | null
  }>({ snapshots: [], contatos: [], templates: [], prestadores: [], hospitalEncaminhado: null, dataEncaminhamento: null, dataInternacao: null })

  // Edição do Telefone do Paciente
  const [tel1, setTel1] = useState('')
  const [tel2, setTel2] = useState('')
  const [savingPhone, setSavingPhone] = useState(false)

  // Registrar Novo Contato
  const [contactType, setContactType] = useState<'WHATSAPP' | 'LIGACAO' | 'VISITA' | 'SMS'>('WHATSAPP')
  const [contactOutcome, setContactOutcome] = useState('SUCESSO_CONFIRMOU')
  const [contactObs, setContactObs] = useState('')
  const [savingContact, setSavingContact] = useState(false)

  // Template selecionado e texto customizado
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [customMsgText, setCustomMsgText] = useState('')

  // Propor Movimentação
  const [moveType, setMoveType] = useState<'MUDANCA_RISCO' | 'MUDANCA_POSICAO' | 'AGRAVAMENTO_CLINICO' | 'DESISTENCIA' | 'OBITO' | 'TRANSFERENCIA'>('MUDANCA_RISCO')
  const [newRisco, setNewRisco] = useState('')
  const [newPos, setNewPos] = useState('')
  const [moveJustification, setMoveJustification] = useState('')
  const [savingMovement, setSavingMovement] = useState(false)

  // Encaminhamento para prestador
  const [selectedPrestadorId, setSelectedPrestadorId] = useState('')
  const [dataInternaInput, setDataInternaInput] = useState('')
  const [savingEncaminhamento, setSavingEncaminhamento] = useState(false)

  // Atualiza parâmetros da URL ao submeter filtros
  const handleApplyFilters = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const params = new URLSearchParams()
    
    if (search) params.set('search', search)
    if (proced) params.set('proced', proced)
    if (especialidade) params.set('especialidade', especialidade)
    if (modalidade) params.set('modalidade', modalidade)
    if (municipio) params.set('municipio', municipio)
    if (risco) params.set('risco', risco)
    if (status) params.set('status', status)
    if (tipo) params.set('tipo', tipo)
    if (antigas === 'true') params.set('antigas', 'true')
    params.set('omitirForaSisreg', omitirForaSisreg)
    
    const sortVal = searchParams.get('sort')
    const orderVal = searchParams.get('order')
    if (sortVal) params.set('sort', sortVal)
    if (orderVal) params.set('order', orderVal)
    
    params.set('page', '1') // reseta para primeira página
    params.set('limit', itemsPerPage.toString())

    router.push(`${pathname}?${params.toString()}`)
  }

  // Ordenação de colunas da tabela
  const handleSort = (field: string) => {
    const params = new URLSearchParams()
    
    if (search) params.set('search', search)
    if (proced) params.set('proced', proced)
    if (especialidade) params.set('especialidade', especialidade)
    if (modalidade) params.set('modalidade', modalidade)
    if (municipio) params.set('municipio', municipio)
    if (risco) params.set('risco', risco)
    if (status) params.set('status', status)
    if (tipo) params.set('tipo', tipo)
    if (antigas === 'true') params.set('antigas', 'true')
    params.set('omitirForaSisreg', omitirForaSisreg)

    const currentSort = searchParams.get('sort')
    const currentOrder = searchParams.get('order')

    let nextOrder = 'asc'
    if (currentSort === field) {
      nextOrder = currentOrder === 'asc' ? 'desc' : 'asc'
    }

    params.set('sort', field)
    params.set('order', nextOrder)
    params.set('page', '1') // reset page
    params.set('limit', itemsPerPage.toString())

    router.push(`${pathname}?${params.toString()}`)
  }

  const handleClearFilters = () => {
    setSearch('')
    setProced('')
    setEspecialidade('')
    setModalidade('')
    setMunicipio('')
    setRisco('')
    setStatus('')
    setTipo('')
    setAntigas('false')
    setOmitirForaSisreg(omitirForaSisregDefault ? 'true' : 'false')
    router.push(`${pathname}?page=1&limit=${itemsPerPage}`)
  }

  // Carregar dados extras ao selecionar solicitação
  useEffect(() => {
    if (selectedSol) {
      setTel1(formatPhone(selectedSol.pacientes?.telefone_1 || ''))
      setTel2(formatPhone(selectedSol.pacientes?.telefone_2 || ''))
      setDrawerLoading(true)
      setExtraData({ snapshots: [], contatos: [], templates: [], prestadores: [], hospitalEncaminhado: null, dataEncaminhamento: null, dataInternacao: null })
      setSelectedTemplateId('')
      setSelectedPrestadorId('')
      setDataInternaInput('')

      fetchSolicitacaoExtraData(selectedSol.cod_solicitacao)
        .then(res => {
          setExtraData(res)
        })
        .finally(() => {
          setDrawerLoading(false)
        })
    }
  }, [selectedSol])

  // Atualiza o texto customizado da mensagem com base no template selecionado e nos dados da solicitação
  useEffect(() => {
    if (!selectedSol) {
      setCustomMsgText('')
      return
    }

    const defaultFallbackText = 'Olá, {nome_usuario}. Entramos em contato da Regulação da Saúde de Marabá referente à sua solicitação de {desc_sigtap}. Por favor, responda a esta mensagem.'
    let baseText = defaultFallbackText

    if (selectedTemplateId) {
      const activeTemplate = extraData.templates.find(t => t.id === selectedTemplateId)
      if (activeTemplate) {
        baseText = activeTemplate.corpo
      }
    }

    // Processar substituições
    let dataExecStr = 'Não agendado'
    if (selectedSol.data_execucao) {
      try {
        dataExecStr = new Date(selectedSol.data_execucao).toLocaleDateString('pt-BR')
      } catch (e) {
        console.error(e)
      }
    }
    const posicaoFilaStr = selectedSol.posicao_fila ? `${selectedSol.posicao_fila}º` : 'Agendado'

    const processedText = baseText
      .replace(/{nome_usuario}/g, selectedSol.pacientes?.nome_usuario || '')
      .replace(/{desc_sigtap}/g, selectedSol.procedimentos?.desc_sigtap || '')
      .replace(/{posicao_fila}/g, posicaoFilaStr)
      .replace(/{data_execucao}/g, dataExecStr)
      .replace(/{nome_executante}/g, selectedSol.nome_executante || 'Não definido')
      .replace(/{chave_confirmacao}/g, selectedSol.chave_confirmacao || 'Não gerada')

    setCustomMsgText(processedText)
  }, [selectedTemplateId, selectedSol, extraData.templates])

  const handleSavePhone = async () => {
    if (!selectedSol) return
    setSavingPhone(true)
    try {
      await updatePatientPhone(selectedSol.pacientes.id, tel1, tel2)
      // Atualizar objeto local
      setSelectedSol({
        ...selectedSol,
        pacientes: {
          ...selectedSol.pacientes,
          telefone_1: tel1,
          telefone_2: tel2
        }
      })
      alert('Telefones atualizados com sucesso!')
    } catch (err: any) {
      alert(err.message || 'Erro ao atualizar telefones.')
    } finally {
      setSavingPhone(false)
    }
  }

  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedSol) return
    setSavingContact(true)
    try {
      const activePhone = contactType === 'WHATSAPP' ? tel1 : (tel1 || tel2 || 'N/I')
      await createContactLog(selectedSol.cod_solicitacao, contactType, contactOutcome, activePhone, contactObs)
      
      // Limpar campos e recarregar dados do drawer
      setContactObs('')
      const freshData = await fetchSolicitacaoExtraData(selectedSol.cod_solicitacao)
      setExtraData(freshData)
      
      // Atualizar status na listagem local sem recarregar a página inteira
      selectedSol.status_interno = 
        contactOutcome === 'SUCESSO_CONFIRMOU' ? 'CONVOCADO_CONFIRMADO' :
        contactOutcome === 'SUCESSO_RECUSOU' ? 'CONVOCADO_RECUSOU' :
        contactOutcome === 'SEM_RESPOSTA' ? 'SEM_CONTATO' : selectedSol.status_interno
      
      alert('Contato adicionado e status atualizado!')
    } catch (err: any) {
      alert(err.message || 'Erro ao registrar contato.')
    } finally {
      setSavingContact(false)
    }
  }

  const handleProposeMovement = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedSol) return
    if (!moveJustification.trim()) {
      alert('Justificativa é obrigatória!')
      return
    }

    setSavingMovement(true)
    try {
      const valorNovo: any = {}
      if (newRisco !== '') {
        valorNovo.classificacao_risco = parseInt(newRisco, 10)
      }
      if (newPos !== '') {
        valorNovo.posicao_fila = parseInt(newPos, 10)
      }

      await proposeMovement(selectedSol.cod_solicitacao, moveType, moveJustification, valorNovo)
      
      alert('Solicitação de movimentação enviada com sucesso e pendente de aprovação!')
      setMoveJustification('')
      setNewRisco('')
      setNewPos('')
    } catch (err: any) {
      alert(err.message || 'Erro ao propor movimentação.')
    } finally {
      setSavingMovement(false)
    }
  }

  const handleEncaminhar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedSol) return
    if (!selectedPrestadorId) {
      alert('Selecione um hospital prestador.')
      return
    }
    
    const nextStatus = dataInternaInput && dataInternaInput.trim().length > 0 ? 'INTERNADO' : 'ENCAMINHADO'
    const statusLabel = nextStatus === 'INTERNADO' ? 'Internado' : 'Encaminhado Hospital/Clínica'
    
    if (!confirm(`Confirmar encaminhamento? O status será alterado para ${statusLabel}.`)) return

    setSavingEncaminhamento(true)
    try {
      await encaminharParaPrestador(
        selectedSol.cod_solicitacao,
        selectedPrestadorId,
        dataInternaInput || undefined
      )
      // Atualizar estado local
      const prestadorSelecionado = extraData.prestadores.find(p => p.id === selectedPrestadorId)
      setSelectedSol({ ...selectedSol, status_interno: nextStatus })
      setExtraData(prev => ({
        ...prev,
        hospitalEncaminhado: prestadorSelecionado || null,
        dataEncaminhamento: new Date().toISOString().split('T')[0],
        dataInternacao: dataInternaInput || null,
      }))
      alert('Paciente encaminhado com sucesso!')
    } catch (err: any) {
      alert(err.message || 'Erro ao encaminhar paciente.')
    } finally {
      setSavingEncaminhamento(false)
    }
  }

  // Geração de Mensagem via WhatsApp
  const handleOpenWhatsApp = () => {
    if (!selectedSol || !tel1) return
    
    const text = customMsgText || `Olá, ${selectedSol.pacientes.nome_usuario}. Entramos em contato da Regulação da Saúde de Marabá referente à sua solicitação de ${selectedSol.procedimentos.desc_sigtap}. Por favor, responda a esta mensagem.`

    const cleanPhone = tel1.replace(/\D/g, '')
    const url = `https://api.whatsapp.com/send?phone=55${cleanPhone}&text=${encodeURIComponent(text)}`
    window.open(url, '_blank')

    // Prefill log de contato automático para facilitar a vida do operador
    setContactType('WHATSAPP')
    setContactOutcome('SUCESSO_CONFIRMOU')
    setContactObs(`WhatsApp aberto com template enviado:\n"${text}"`)
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

  const getRiskBadge = (risco: number) => {
    switch (risco) {
      case 0: return <span className="px-2.5 py-1 text-[9px] font-black uppercase rounded-lg bg-rose-500 text-white border border-rose-600 animate-pulse">Emergência</span>
      case 1: return <span className="px-2.5 py-1 text-[9px] font-black uppercase rounded-lg bg-red-500/10 text-red-500 border border-red-500/20">Urgência</span>
      case 2: return <span className="px-2.5 py-1 text-[9px] font-black uppercase rounded-lg bg-amber-500/10 text-amber-500 border border-amber-500/20">Prioridade</span>
      case 3: return <span className="px-2.5 py-1 text-[9px] font-black uppercase rounded-lg bg-teal-500/10 text-teal-500 border border-teal-500/20">Eletivo</span>
      case 4: return <span className="px-2.5 py-1 text-[9px] font-black uppercase rounded-lg bg-purple-500/10 text-purple-500 border border-purple-500/20">Especial</span>
      default: return <span className="px-2.5 py-1 text-[9px] font-black uppercase rounded-lg bg-muted/10 text-muted-foreground border border-muted/20">Eletivo</span>
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'NA_FILA': return <span className="px-2.5 py-1 text-[9px] font-bold uppercase rounded-lg bg-muted text-muted-foreground border border-border">Na Fila</span>
      case 'EM_CONVOCACAO': return <span className="px-2.5 py-1 text-[9px] font-bold uppercase rounded-lg bg-blue-500/10 text-blue-500 border border-blue-500/20">Em Convocação</span>
      case 'CONVOCADO_CONFIRMADO': return <span className="px-2.5 py-1 text-[9px] font-bold uppercase rounded-lg bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">Confirmado</span>
      case 'CONVOCADO_RECUSOU': return <span className="px-2.5 py-1 text-[9px] font-bold uppercase rounded-lg bg-rose-500/10 text-rose-500 border border-rose-500/20">Recusou</span>
      case 'SEM_CONTATO': return <span className="px-2.5 py-1 text-[9px] font-bold uppercase rounded-lg bg-amber-500/10 text-amber-500 border border-amber-500/20">Sem Contato</span>
      case 'ABSENTEISMO': return <span className="px-2.5 py-1 text-[9px] font-bold uppercase rounded-lg bg-zinc-500/10 text-zinc-500 border border-zinc-500/20">Absenteísmo</span>
      case 'ENCAMINHADO': return <span className="px-2.5 py-1 text-[9px] font-bold uppercase rounded-lg bg-sky-500/10 text-sky-500 border border-sky-500/20">Encaminhado</span>
      case 'INTERNADO': return <span className="px-2.5 py-1 text-[9px] font-bold uppercase rounded-lg bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">Internado</span>
      case 'PROCEDIMENTO_REALIZADO': return <span className="px-2.5 py-1 text-[9px] font-bold uppercase rounded-lg bg-teal-500/10 text-teal-500 border border-teal-500/20">Realizado</span>
      case 'ALTA': return <span className="px-2.5 py-1 text-[9px] font-bold uppercase rounded-lg bg-emerald-500 text-white">Alta</span>
      case 'DESISTENCIA': return <span className="px-2.5 py-1 text-[9px] font-bold uppercase rounded-lg bg-gray-500/10 text-gray-500 border border-gray-500/20">Desistência</span>
      case 'OBITO': return <span className="px-2.5 py-1 text-[9px] font-bold uppercase rounded-lg bg-black text-white">Óbito</span>
      case 'NAO_ENCONTRADO_SISREG': return <span className="px-2.5 py-1 text-[9px] font-bold uppercase rounded-lg bg-amber-500 text-white border border-amber-600">Fora do SISREG</span>
      default: return <span className="px-2.5 py-1 text-[9px] font-bold uppercase rounded-lg bg-muted text-muted-foreground border border-border">Na Fila</span>
    }
  }

  return (
    <DashboardShell role={role} email={email}>
      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-3xl font-black text-foreground tracking-tighter uppercase">
              Fila de <span className="text-primary italic">Espera</span>
            </h2>
            <p className="text-sm text-muted-foreground mt-2">
              Pesquise e gerencie a fila de procedimentos regulados da Secretaria de Saúde.
            </p>
          </div>
        </div>

        {/* Bento Card de Filtros */}
        <div className="bento-card p-6 md:p-8">
          <form onSubmit={handleApplyFilters} className="space-y-6">
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {/* Pesquisa */}
              <div className="group">
                <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2 px-1">Buscar Paciente</label>
                <div className="relative">
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="block w-full rounded-2xl border border-border/50 bg-background/50 py-3.5 px-4 pr-10 text-xs text-foreground outline-none focus:border-primary transition-all placeholder:text-muted-foreground/50"
                    placeholder="Nome, CNS ou Nº Solicitação"
                  />
                  <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-muted-foreground/40" />
                </div>
              </div>

              {/* Procedimento */}
              <div className="group relative" ref={procedContainerRef}>
                <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2 px-1">Procedimento</label>
                <div className="relative">
                  <input
                    type="text"
                    value={procedSearchQuery}
                    onChange={(e) => {
                      setProcedSearchQuery(e.target.value)
                      setProcedDropdownOpen(true)
                    }}
                    onFocus={() => setProcedDropdownOpen(true)}
                    placeholder="Todos os Procedimentos"
                    className="block w-full rounded-2xl border border-border/50 bg-background/50 py-3.5 pl-4 pr-10 text-xs text-foreground outline-none focus:border-primary transition-all placeholder:text-muted-foreground/50"
                  />
                  {proced ? (
                    <button
                      type="button"
                      onClick={() => {
                        setProced('')
                        setProcedSearchQuery('')
                        setProcedDropdownOpen(false)
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-foreground transition-colors p-1"
                      title="Limpar procedimento"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  ) : (
                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground/30">
                      <Search className="h-4.5 w-4.5" />
                    </div>
                  )}
                </div>

                {/* Dropdown de Sugestões com Busca Incremental */}
                {procedDropdownOpen && (
                  <div className="absolute z-50 w-full mt-2 rounded-2xl border border-border/50 bg-background/95 backdrop-blur-md shadow-2xl overflow-hidden max-h-60 overflow-y-auto animate-in fade-in slide-in-from-top-1 duration-200">
                    <ul className="py-2 text-xs divide-y divide-border/5">
                      <li
                        onClick={() => {
                          setProced('')
                          setProcedSearchQuery('')
                          setProcedDropdownOpen(false)
                        }}
                        className={`px-4 py-3 cursor-pointer transition-colors font-bold uppercase tracking-wider text-[10px] text-muted-foreground hover:bg-muted/50 ${
                          !proced ? 'bg-primary/10 text-primary' : ''
                        }`}
                      >
                        Todos os Procedimentos
                      </li>
                      {procedimentos
                        .filter(p => {
                          const query = procedSearchQuery.toLowerCase().trim()
                          if (!query) return true
                          return (
                            p.cod_sigtap.includes(query) ||
                            p.desc_sigtap.toLowerCase().includes(query)
                          )
                        })
                        .slice(0, 50)
                        .map(p => {
                          const isSelected = p.cod_sigtap === proced
                          return (
                            <li
                              key={p.cod_sigtap}
                              onClick={() => {
                                setProced(p.cod_sigtap)
                                setProcedDropdownOpen(false)
                              }}
                              className={`px-4 py-2.5 cursor-pointer hover:bg-primary/5 transition-colors flex flex-col gap-0.5 ${
                                isSelected ? 'bg-primary/10 border-l-2 border-primary' : ''
                              }`}
                            >
                              <span className="font-bold text-foreground line-clamp-2">
                                {p.desc_sigtap.trim()}
                              </span>
                              <span className="text-[10px] text-muted-foreground/60 font-mono font-bold">
                                Código: {p.cod_sigtap}
                              </span>
                            </li>
                          )
                        })}
                    </ul>
                  </div>
                )}
              </div>

              {/* Município de Origem */}
              <div className="group">
                <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2 px-1">Município de Origem</label>
                <select
                  value={municipio}
                  onChange={(e) => setMunicipio(e.target.value)}
                  className="block w-full rounded-2xl border border-border/50 bg-background/50 py-3.5 px-4 text-xs text-foreground outline-none focus:border-primary transition-all"
                >
                  <option value="">Todos os Municípios</option>
                  {municipios.map(m => (
                    <option key={m.codigo_ibge} value={m.codigo_ibge}>{m.nome}</option>
                  ))}
                </select>
              </div>

              {/* Especialidade */}
              <div className="group">
                <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2 px-1">Especialidade</label>
                <select
                  value={especialidade}
                  onChange={(e) => setEspecialidade(e.target.value)}
                  className="block w-full rounded-2xl border border-border/50 bg-background/50 py-3.5 px-4 text-xs text-foreground outline-none focus:border-primary transition-all"
                >
                  <option value="">Todas as Especialidades</option>
                  {especialidades.map(esp => (
                    <option key={esp} value={esp}>{esp}</option>
                  ))}
                </select>
              </div>

              {/* Classificação de Risco */}
              <div className="group">
                <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2 px-1">Risco</label>
                <select
                  value={risco}
                  onChange={(e) => setRisco(e.target.value)}
                  className="block w-full rounded-2xl border border-border/50 bg-background/50 py-3.5 px-4 text-xs text-foreground outline-none focus:border-primary transition-all"
                >
                  <option value="">Todos os Riscos</option>
                  <option value="0">Emergência</option>
                  <option value="1">Urgência</option>
                  <option value="2">Prioridade</option>
                  <option value="3">Eletivo</option>
                  <option value="4">Especial</option>
                </select>
              </div>

              {/* Status Interno */}
              <div className="group">
                <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2 px-1">Status Interno</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="block w-full rounded-2xl border border-border/50 bg-background/50 py-3.5 px-4 text-xs text-foreground outline-none focus:border-primary transition-all font-semibold"
                >
                  <option value="">Todos os Status</option>
                  <option value="NA_FILA">[SISREG] Na Fila</option>
                  <option value="EM_CONVOCACAO">[SisFilaSus] Em Convocação</option>
                  <option value="CONVOCADO_CONFIRMADO">[SisFilaSus] Confirmado</option>
                  <option value="CONVOCADO_RECUSOU">[SisFilaSus] Recusou</option>
                  <option value="SEM_CONTATO">[SisFilaSus] Sem Contato</option>
                  <option value="ABSENTEISMO">[SisFilaSus] Absenteísmo</option>
                  <option value="ENCAMINHADO">[SisFilaSus] Encaminhado Hospital/Clínica</option>
                  <option value="INTERNADO">[SisFilaSus] Internado</option>
                  <option value="PROCEDIMENTO_REALIZADO">[SisFilaSus] Procedimento Realizado</option>
                  <option value="ALTA">[SisFilaSus] Alta</option>
                  <option value="DESISTENCIA">[SisFilaSus] Desistência</option>
                  <option value="OBITO">[SisFilaSus] Óbito</option>
                  <option value="NAO_ENCONTRADO_SISREG">[SISREG] Fora do SISREG</option>
                </select>
              </div>

              {/* Eixo / Tipo de Fila */}
              <div className="group">
                <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2 px-1">Eixo (Tipo)</label>
                <select
                  value={tipo}
                  onChange={(e) => setTipo(e.target.value)}
                  className="block w-full rounded-2xl border border-border/50 bg-background/50 py-3.5 px-4 text-xs text-foreground outline-none focus:border-primary transition-all"
                >
                  <option value="">Todos os Eixos</option>
                  <option value="1">Tipo 1 — Ambulatorial / Regulação</option>
                  <option value="2">Tipo 2 — SADT (Apoio Diagnóstico)</option>
                  <option value="3">Tipo 3 — Internação Eletiva</option>
                  <option value="4">Tipo 4 — Urgência / Alta Complexidade</option>
                </select>
              </div>

              {/* Modalidade */}
              <div className="group">
                <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2 px-1">Modalidade</label>
                <select
                  value={modalidade}
                  onChange={(e) => setModalidade(e.target.value)}
                  className="block w-full rounded-2xl border border-border/50 bg-background/50 py-3.5 px-4 text-xs text-foreground outline-none focus:border-primary transition-all"
                >
                  <option value="">Todas as Modalidades</option>
                  <option value="0">Consulta</option>
                  <option value="1">Exame</option>
                  <option value="2">Cirurgia</option>
                  <option value="3">Demais Procedimentos</option>
                </select>
              </div>

              {/* Opções Extras (Checkboxes) */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 h-full pt-4 lg:pt-6">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={antigas === 'true'}
                    onChange={(e) => setAntigas(e.target.checked ? 'true' : 'false')}
                    className="w-4.5 h-4.5 rounded border-border/50 text-primary bg-background/50 focus:ring-primary focus:ring-2 accent-primary cursor-pointer animate-all"
                  />
                  <div className="flex flex-col">
                    <span className="text-[11px] font-black text-foreground uppercase tracking-tight leading-none">Solicitações Antigas</span>
                    <span className="text-[9px] text-muted-foreground font-semibold mt-0.5">&gt; {anosLimpezaFila} anos</span>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={omitirForaSisreg === 'true'}
                    onChange={(e) => setOmitirForaSisreg(e.target.checked ? 'true' : 'false')}
                    className="w-4.5 h-4.5 rounded border-border/50 text-primary bg-background/50 focus:ring-primary focus:ring-2 accent-primary cursor-pointer animate-all"
                  />
                  <div className="flex flex-col">
                    <span className="text-[11px] font-black text-foreground uppercase tracking-tight leading-none">Omitir Fora SISREG</span>
                    <span className="text-[9px] text-muted-foreground font-semibold mt-0.5">Ocultar ausentes</span>
                  </div>
                </label>
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
                Filtrar Resultados
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
                  <th className="py-5 px-6">Solicitação</th>
                  <th className="py-5 px-6">Paciente</th>
                  <th className="py-5 px-6">Procedimento</th>
                  <th className="py-5 px-6">Município</th>
                  <th className="py-5 px-6">Risco</th>
                  <th className="py-5 px-6">Posição</th>
                  <th 
                    className="py-5 px-6 cursor-pointer select-none hover:text-foreground transition-colors"
                    onClick={() => handleSort('data_solicitacao')}
                  >
                    <div className="flex items-center gap-1 group/sort">
                      <span>Data Sol.</span>
                      <ArrowUpDown className={`h-3 w-3 transition-colors ${
                        searchParams.get('sort') === 'data_solicitacao'
                          ? 'text-primary'
                          : 'text-muted-foreground/30 group-hover/sort:text-muted-foreground/60'
                      }`} />
                    </div>
                  </th>
                  <th className="py-5 px-6">Status</th>
                  <th className="py-5 px-6 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/10 text-xs font-semibold">
                {solicitacoes.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-muted-foreground font-bold">
                      Nenhuma solicitação encontrada com os filtros aplicados.
                    </td>
                  </tr>
                ) : (
                  solicitacoes.map((sol) => (
                    <tr 
                      key={sol.cod_solicitacao} 
                      className="hover:bg-muted/10 transition-colors cursor-pointer group"
                      onClick={() => {
                        setSelectedSol(sol)
                        setDrawerOpen(true)
                      }}
                    >
                      <td className="py-4 px-6 font-mono text-muted-foreground">{sol.cod_solicitacao}</td>
                      <td className="py-4 px-6">
                        <div className="flex flex-col">
                          <span className="font-bold text-foreground text-sm group-hover:text-primary transition-colors">{sol.pacientes.nome_usuario}</span>
                          <span className="text-[10px] text-muted-foreground/60 font-mono mt-0.5">CNS: {sol.pacientes.cns_usuario}</span>
                        </div>
                      </td>
                      <td className="py-4 px-6 max-w-xs truncate">
                        <div className="flex flex-col">
                          <span className="truncate">{sol.procedimentos.desc_sigtap.trim()}</span>
                          <span className="text-[9px] text-muted-foreground/60 font-mono">SIGTAP: {sol.procedimentos.cod_sigtap}</span>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-muted-foreground">{sol.municipios?.nome || 'MARABA'}</td>
                      <td className="py-4 px-6">{getRiskBadge(sol.classificacao_risco)}</td>
                      <td className="py-4 px-6">
                        {sol.posicao_fila ? (
                          <span className="font-black text-foreground">{sol.posicao_fila}º</span>
                        ) : (
                          <span className="text-[10px] font-black text-emerald-500 uppercase tracking-wider">Agendado (AR)</span>
                        )}
                      </td>
                      <td className="py-4 px-6 text-muted-foreground whitespace-nowrap">
                        {sol.data_solicitacao ? new Date(sol.data_solicitacao).toLocaleDateString('pt-BR') : 'N/I'}
                      </td>
                      <td className="py-4 px-6">{getStatusBadge(sol.status_interno)}</td>
                      <td className="py-4 px-6 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedSol(sol)
                            setDrawerOpen(true)
                          }}
                          className="p-2.5 rounded-xl hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors cursor-pointer"
                          title="Detalhar Paciente"
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

      {/* Drawer Lateral (Detalhamento do Paciente e Convocação) */}
      {drawerOpen && selectedSol && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-background/80 backdrop-blur-sm transition-opacity duration-300"
            onClick={() => setDrawerOpen(false)}
          />
          
          {/* Panel */}
          <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-2xl bg-card border-l border-border/40 shadow-2xl flex flex-col h-full overflow-y-auto animate-in slide-in-from-right duration-350">
              
              {/* Header */}
              <div className="p-6 md:p-8 border-b border-border/10 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                    <User className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Detalhes do Paciente</span>
                    <h3 className="text-lg font-black text-foreground truncate uppercase">{selectedSol.pacientes.nome_usuario}</h3>
                  </div>
                </div>
                <button 
                  onClick={() => setDrawerOpen(false)}
                  className="p-2 rounded-full hover:bg-muted/50 transition-colors cursor-pointer"
                >
                  <X className="h-5 w-5 text-muted-foreground" />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 p-6 md:p-8 space-y-8">
                
                {/* 1. Ficha Cadastral e Telefones */}
                <div className="bento-card p-6 bg-muted/20 border-border/30 space-y-4">
                  <span className="text-[10px] font-black uppercase tracking-widest text-primary">Dados Pessoais & Contatos</span>
                  
                  <div className="grid gap-4 sm:grid-cols-2 text-xs">
                    <div>
                      <span className="text-muted-foreground font-bold uppercase tracking-wider text-[9px]">Idade:</span>
                      <p className="font-bold text-foreground mt-0.5">{getAge(selectedSol.pacientes.data_nascimento)} ({selectedSol.pacientes.data_nascimento})</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground font-bold uppercase tracking-wider text-[9px]">CNS (Cartão SUS):</span>
                      <p className="font-bold text-foreground mt-0.5 font-mono">{selectedSol.pacientes.cns_usuario}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground font-bold uppercase tracking-wider text-[9px]">CPF:</span>
                      <p className="font-bold text-foreground mt-0.5 font-mono">{selectedSol.pacientes.cpf_usuario || 'Não informado'}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground font-bold uppercase tracking-wider text-[9px]">Nome da Mãe:</span>
                      <p className="font-bold text-foreground mt-0.5 uppercase">{selectedSol.pacientes.nome_mae || 'Não informado'}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground font-bold uppercase tracking-wider text-[9px]">Data da Solicitação:</span>
                      <p className="font-bold text-foreground mt-0.5">
                        {selectedSol.data_solicitacao ? new Date(selectedSol.data_solicitacao).toLocaleDateString('pt-BR') : 'Não informada'}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground font-bold uppercase tracking-wider text-[9px]">Estimativa de Atendimento (Paciente):</span>
                      <p className="font-bold text-foreground mt-0.5">
                        {selectedSol.estimativa_atendimento_paciente !== null && selectedSol.estimativa_atendimento_paciente !== undefined
                          ? `${selectedSol.estimativa_atendimento_paciente} dias`
                          : 'Não estimada'}
                      </p>
                    </div>
                  </div>

                  {/* Edição de telefones */}
                  <div className="border-t border-border/20 pt-4 space-y-3">
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Telefones para Contato</span>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-muted-foreground uppercase">WhatsApp / Celular 1</label>
                        <input
                          type="text"
                          value={tel1}
                          onChange={(e) => setTel1(formatPhone(e.target.value))}
                          className="block w-full rounded-xl border border-border/50 bg-background/50 py-2 px-3 text-xs outline-none focus:border-primary transition-all font-mono"
                          placeholder="(94) 9XXXX-XXXX"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-muted-foreground uppercase">Celular 2 (Recado)</label>
                        <input
                          type="text"
                          value={tel2}
                          onChange={(e) => setTel2(formatPhone(e.target.value))}
                          className="block w-full rounded-xl border border-border/50 bg-background/50 py-2 px-3 text-xs outline-none focus:border-primary transition-all font-mono"
                          placeholder="(94) 9XXXX-XXXX"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={handleSavePhone}
                        disabled={savingPhone}
                        className="px-4 py-2 bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground text-[10px] font-black uppercase tracking-widest rounded-xl transition-all cursor-pointer disabled:opacity-50"
                      >
                        {savingPhone ? 'Salvando...' : 'Salvar Telefones'}
                      </button>
                    </div>

                    <div className="border-t border-border/20 pt-4 space-y-2">
                      <label className="block text-[9px] font-black text-muted-foreground uppercase tracking-widest">Alterar Status Interno (Manual)</label>
                      <div className="flex gap-2">
                        <select
                          value={selectedSol.status_interno}
                          onChange={async (e) => {
                            const nextStatus = e.target.value
                            if (confirm(`Deseja alterar o status desta solicitação para "${nextStatus}"?`)) {
                              try {
                                await updateSolicitacaoStatus(selectedSol.cod_solicitacao, nextStatus)
                                setSelectedSol({ ...selectedSol, status_interno: nextStatus })
                                alert('Status atualizado com sucesso!')
                              } catch (err: any) {
                                alert(err.message || 'Erro ao atualizar status')
                              }
                            }
                          }}
                          className="block w-full rounded-xl border border-border/50 bg-background/50 py-2.5 px-3 text-xs outline-none focus:border-primary transition-all text-foreground font-semibold"
                        >
                          <option value="NA_FILA">[SISREG] Na Fila</option>
                          <option value="EM_CONVOCACAO">[SisFilaSus] Em Convocação</option>
                          <option value="CONVOCADO_CONFIRMADO">[SisFilaSus] Confirmado</option>
                          <option value="CONVOCADO_RECUSOU">[SisFilaSus] Recusou</option>
                          <option value="SEM_CONTATO">[SisFilaSus] Sem Contato</option>
                          <option value="ABSENTEISMO">[SisFilaSus] Absenteísmo</option>
                          <option value="ENCAMINHADO">[SisFilaSus] Encaminhado Hospital/Clínica</option>
                          <option value="INTERNADO">[SisFilaSus] Internado</option>
                          <option value="PROCEDIMENTO_REALIZADO">[SisFilaSus] Procedimento Realizado</option>
                          <option value="ALTA">[SisFilaSus] Alta</option>
                          <option value="DESISTENCIA">[SisFilaSus] Desistência</option>
                          <option value="OBITO">[SisFilaSus] Óbito</option>
                          <option value="NAO_ENCONTRADO_SISREG">[SISREG] Fora do SISREG</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Painel de Encaminhamento para Hospital */}
                {(selectedSol.status_interno === 'CONVOCADO_CONFIRMADO' || selectedSol.status_interno === 'ENCAMINHADO' || selectedSol.status_interno === 'INTERNADO') && (
                  <div className="bento-card p-6 border-indigo-500/20 bg-indigo-500/5 space-y-4">
                    <div className="flex items-center gap-2 text-indigo-400">
                      <Activity className="h-5 w-5" />
                      <span className="text-[10px] font-black uppercase tracking-widest">Encaminhamento Hospitalar</span>
                    </div>

                    {/* Hospital já vinculado */}
                    {extraData.hospitalEncaminhado ? (
                      <div className="space-y-3">
                        <div className="flex items-start gap-3 p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl">
                          <CheckCircle2 className="h-4 w-4 text-indigo-400 mt-0.5 shrink-0" />
                          <div className="text-xs space-y-0.5">
                            <p className="font-black text-foreground">{extraData.hospitalEncaminhado.nome}</p>
                            {extraData.hospitalEncaminhado.cnes && (
                              <p className="text-[10px] font-mono text-muted-foreground">CNES: {extraData.hospitalEncaminhado.cnes}</p>
                            )}
                            {extraData.dataEncaminhamento && (
                              <p className="text-[10px] text-muted-foreground">
                                Encaminhado em: {new Date(extraData.dataEncaminhamento + 'T00:00:00').toLocaleDateString('pt-BR')}
                              </p>
                            )}
                            {extraData.dataInternacao && (
                              <p className="text-[10px] text-muted-foreground">
                                Data de Internação: {new Date(extraData.dataInternacao + 'T00:00:00').toLocaleDateString('pt-BR')}
                              </p>
                            )}
                          </div>
                        </div>
                        {(selectedSol.status_interno === 'INTERNADO' || selectedSol.status_interno === 'ENCAMINHADO') && (
                          <p className="text-[10px] text-indigo-400/80 font-bold">
                            {selectedSol.status_interno === 'ENCAMINHADO' 
                              ? 'Status: Encaminhado (Aguardando internação). Para registrar a internação, informe a data abaixo.' 
                              : 'Status: Internado.'}
                          </p>
                        )}
                      </div>
                    ) : null}

                    {/* Formulário de encaminhamento */}
                    {selectedSol.status_interno === 'CONVOCADO_CONFIRMADO' || selectedSol.status_interno === 'ENCAMINHADO' || selectedSol.status_interno === 'INTERNADO' ? (
                      <form onSubmit={handleEncaminhar} className="space-y-3">
                        <div className="space-y-1.5">
                          <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">
                            {extraData.hospitalEncaminhado ? 'Redirecionar para outro Hospital' : 'Selecionar Hospital Destino'}
                          </label>
                          {drawerLoading ? (
                            <div className="rounded-xl border border-border/50 bg-background/50 py-2.5 px-3 text-xs text-muted-foreground">Carregando prestadores...</div>
                          ) : extraData.prestadores.length === 0 ? (
                            <div className="flex items-center gap-2 p-3 bg-amber-500/5 text-amber-500 rounded-xl text-xs font-bold border border-amber-500/20">
                              <AlertTriangle className="h-4 w-4 shrink-0" />
                              <span>Nenhum prestador ativo cadastrado. Acesse Cadastros → Prestadores.</span>
                            </div>
                          ) : (
                            <select
                              value={selectedPrestadorId}
                              onChange={(e) => setSelectedPrestadorId(e.target.value)}
                              required
                              className="block w-full rounded-xl border border-border/50 bg-background/50 py-2.5 px-3 text-xs outline-none focus:border-indigo-400 transition-all text-foreground"
                            >
                              <option value="">— Selecione o hospital —</option>
                              {extraData.prestadores.map(p => (
                                <option key={p.id} value={p.id}>
                                  {p.nome}{p.cnes ? ` (CNES: ${p.cnes})` : ''}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Data de Internação (Opcional)</label>
                          <input
                            type="date"
                            value={dataInternaInput}
                            onChange={(e) => setDataInternaInput(e.target.value)}
                            className="block w-full rounded-xl border border-border/50 bg-background/50 py-2.5 px-3 text-xs outline-none focus:border-indigo-400 transition-all text-foreground"
                          />
                        </div>

                        {extraData.prestadores.length > 0 && (
                          <div className="flex justify-end">
                            <button
                              type="submit"
                              disabled={savingEncaminhamento || !selectedPrestadorId}
                              className="px-5 py-3 bg-indigo-500 hover:bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all cursor-pointer disabled:opacity-50 flex items-center gap-2 shadow-md shadow-indigo-500/20"
                            >
                              <ArrowUpRight className="h-3.5 w-3.5" />
                              {savingEncaminhamento 
                                ? 'Processando...' 
                                : extraData.hospitalEncaminhado 
                                  ? (selectedSol.status_interno === 'ENCAMINHADO' && dataInternaInput ? 'Registrar Internação' : 'Redirecionar Hospital') 
                                  : 'Confirmar Encaminhamento'}
                            </button>
                          </div>
                        )}
                      </form>
                    ) : null}
                  </div>
                )}

                {/* 3. Módulo de Convocação WhatsApp */}
                <div className="bento-card p-6 border-teal-500/20 bg-teal-500/5 space-y-4">
                  <div className="flex items-center gap-2 text-teal-500">
                    <MessageSquare className="h-5 w-5" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Busca Ativa — WhatsApp</span>
                  </div>

                  {!tel1 ? (
                    <div className="flex items-center gap-2 p-3 bg-amber-500/5 text-amber-500 rounded-xl text-xs font-bold leading-relaxed border border-amber-500/20">
                      <AlertTriangle className="h-4.5 w-4.5 shrink-0" />
                      <span>Cadastre o Telefone 1 acima para liberar a convocação via WhatsApp.</span>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Selecione o Modelo de Mensagem</label>
                        <select
                          value={selectedTemplateId}
                          onChange={(e) => setSelectedTemplateId(e.target.value)}
                          className="block w-full rounded-xl border border-border/50 bg-background/50 py-2.5 px-3 text-xs outline-none focus:border-primary transition-all text-foreground"
                        >
                          <option value="">Mensagem Padrão (Sem Modelo)</option>
                          {extraData.templates.map(t => (
                            <option key={t.id} value={t.id}>{t.titulo}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Preview da Mensagem (Editável)</label>
                        <textarea
                          value={customMsgText}
                          onChange={(e) => setCustomMsgText(e.target.value)}
                          rows={6}
                          className="block w-full rounded-xl border border-border/50 bg-background/50 py-2.5 px-3 text-xs outline-none focus:border-primary transition-all font-sans leading-relaxed text-foreground"
                          placeholder="Processando mensagem..."
                        />
                      </div>

                      <button
                        type="button"
                        onClick={handleOpenWhatsApp}
                        className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-md shadow-emerald-500/20 active:scale-[0.99] transition-all cursor-pointer border border-emerald-600"
                      >
                        <Phone className="h-4 w-4" />
                        <span>Chamar no WhatsApp</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* 3. Registrar Contato Manual */}
                <div className="bento-card p-6 space-y-4">
                  <span className="text-[10px] font-black uppercase tracking-widest text-primary">Registrar Novo Contato</span>
                  <form onSubmit={handleAddContact} className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-bold text-muted-foreground uppercase">Meio de Contato</label>
                        <select
                          value={contactType}
                          onChange={(e) => setContactType(e.target.value as any)}
                          className="block w-full rounded-xl border border-border/50 bg-background/50 py-2 px-3 text-xs outline-none focus:border-primary transition-all"
                        >
                          <option value="WHATSAPP">WhatsApp</option>
                          <option value="LIGACAO">Ligação Telefônica</option>
                          <option value="VISITA">Visita Domiciliar</option>
                          <option value="SMS">SMS</option>
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[9px] font-bold text-muted-foreground uppercase">Resultado</label>
                        <select
                          value={contactOutcome}
                          onChange={(e) => setContactOutcome(e.target.value)}
                          className="block w-full rounded-xl border border-border/50 bg-background/50 py-2 px-3 text-xs outline-none focus:border-primary transition-all"
                        >
                          <option value="SUCESSO_CONFIRMOU">Sucesso: Paciente Confirmou</option>
                          <option value="SUCESSO_RECUSOU">Sucesso: Paciente Recusou/Fez Particular</option>
                          <option value="SUCESSO_REMARCOU">Sucesso: Paciente Remarcou</option>
                          <option value="SEM_RESPOSTA">Sem resposta / Não atende</option>
                          <option value="NUMERO_INVALIDO">Número Inexistente / Errado</option>
                          <option value="NUMERO_INEXISTENTE">Caixa Postal</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[9px] font-bold text-muted-foreground uppercase">Observações Operacionais</label>
                      <textarea
                        value={contactObs}
                        onChange={(e) => setContactObs(e.target.value)}
                        rows={2}
                        className="block w-full rounded-xl border border-border/50 bg-background/50 py-2 px-3 text-xs outline-none focus:border-primary transition-all"
                        placeholder="Ex: Falado com a mãe do paciente. Agendamento confirmado para terça."
                      />
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={savingContact}
                        className="px-5 py-3 bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-widest rounded-xl transition-all cursor-pointer disabled:opacity-50 flex items-center gap-2"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        {savingContact ? 'Salvando...' : 'Salvar Registro'}
                      </button>
                    </div>
                  </form>
                </div>

                {/* Propor Alteração / Movimentação na Fila */}
                <div className="bento-card p-6 space-y-4">
                  <span className="text-[10px] font-black uppercase tracking-widest text-primary">Propor Alteração / Movimentação</span>
                  <form onSubmit={handleProposeMovement} className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-bold text-muted-foreground uppercase">Tipo de Movimentação</label>
                        <select
                          value={moveType}
                          onChange={(e) => setMoveType(e.target.value as any)}
                          className="block w-full rounded-xl border border-border/50 bg-background/50 py-2 px-3 text-xs outline-none focus:border-primary transition-all text-foreground"
                        >
                          <option value="MUDANCA_RISCO">Mudança de Risco</option>
                          <option value="MUDANCA_POSICAO">Mudança de Posição</option>
                          <option value="AGRAVAMENTO_CLINICO">Agravamento Clínico</option>
                          <option value="DESISTENCIA">Desistência</option>
                          <option value="OBITO">Óbito</option>
                          <option value="TRANSFERENCIA">Transferência</option>
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[9px] font-bold text-muted-foreground uppercase">Novo Risco (Opcional)</label>
                        <select
                          value={newRisco}
                          onChange={(e) => setNewRisco(e.target.value)}
                          className="block w-full rounded-xl border border-border/50 bg-background/50 py-2 px-3 text-xs outline-none focus:border-primary transition-all text-foreground"
                        >
                          <option value="">Manter Atual</option>
                          <option value="0">Emergência</option>
                          <option value="1">Urgência</option>
                          <option value="2">Prioridade</option>
                          <option value="3">Eletivo</option>
                          <option value="4">Especial</option>
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[9px] font-bold text-muted-foreground uppercase">Nova Posição (Opcional)</label>
                        <input
                          type="number"
                          value={newPos}
                          onChange={(e) => setNewPos(e.target.value)}
                          className="block w-full rounded-xl border border-border/50 bg-background/50 py-2.5 px-3 text-xs outline-none focus:border-primary transition-all text-foreground"
                          placeholder="Ex: 5"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[9px] font-bold text-muted-foreground uppercase">Justificativa Detalhada</label>
                      <textarea
                        value={moveJustification}
                        onChange={(e) => setMoveJustification(e.target.value)}
                        rows={3}
                        required
                        className="block w-full rounded-xl border border-border/50 bg-background/50 py-2 px-3 text-xs outline-none focus:border-primary transition-all text-foreground"
                        placeholder="Ex: Apresentou laudo com agravamento clínico do quadro cirúrgico..."
                      />
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={savingMovement}
                        className="px-5 py-3 bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-widest rounded-xl transition-all cursor-pointer disabled:opacity-50 flex items-center gap-2"
                      >
                        {savingMovement ? 'Enviando Proposta...' : 'Propor Movimentação'}
                      </button>
                    </div>
                  </form>
                </div>

                {/* 4. Histórico de Contatos anteriores */}
                <div className="space-y-4">
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Histórico de Contatos</span>
                  {drawerLoading ? (
                    <p className="text-xs text-muted-foreground font-bold">Carregando contatos...</p>
                  ) : extraData.contatos.length === 0 ? (
                    <p className="text-xs text-muted-foreground opacity-60">Nenhum contato registrado anteriormente para esta solicitação.</p>
                  ) : (
                    <div className="space-y-3">
                      {extraData.contatos.map((c) => (
                        <div key={c.id} className="p-4 border border-border/30 bg-muted/20 rounded-2xl text-xs space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-foreground text-[10px] uppercase tracking-wider">{c.tipo} — {c.resultado}</span>
                            <span className="text-[9px] text-muted-foreground/60">{new Date(c.created_at).toLocaleString('pt-BR')}</span>
                          </div>
                          {c.observacoes && <p className="text-muted-foreground leading-relaxed font-medium">{c.observacoes}</p>}
                          <div className="flex justify-between items-center text-[9px] font-black uppercase text-muted-foreground/50 pt-1 border-t border-border/10">
                            <span>Telefone: {c.telefone_usado}</span>
                            <span>Operador: {c.users?.nome || 'Regulador'}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 5. Histórico da Posição na Fila (Snapshots) */}
                <div className="space-y-4">
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Evolução do Paciente na Fila (SISREG)</span>
                  {drawerLoading ? (
                    <p className="text-xs text-muted-foreground font-bold">Carregando evolução...</p>
                  ) : extraData.snapshots.length === 0 ? (
                    <p className="text-xs text-muted-foreground opacity-60">Sem dados históricos de evolução deste paciente.</p>
                  ) : (
                    <div className="relative border-l-2 border-primary/20 pl-4 ml-2 space-y-5 py-2">
                      {extraData.snapshots.map((s, index) => (
                        <div key={s.id} className="relative">
                          {/* Dot indicator */}
                          <div className="absolute -left-[23px] top-1.5 h-3.5 w-3.5 rounded-full border-2 border-primary bg-card" />
                          <div className="text-xs space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-black text-foreground">
                                {s.posicao_fila ? `Posição: ${s.posicao_fila}º` : 'Agendado/Regulado'}
                              </span>
                              <span className="text-[10px] opacity-65">{new Date(s.created_at).toLocaleDateString('pt-BR')}</span>
                            </div>
                            <p className="text-[9px] text-muted-foreground uppercase tracking-wider leading-none">
                              Importação: {s.importacoes?.nome_arquivo}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>

            </div>
          </div>
        </div>
      )}
    </DashboardShell>
  )
}
