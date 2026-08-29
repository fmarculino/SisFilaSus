'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { DashboardShell } from '@/components/layout/DashboardShell'
import { Portal } from '@/components/ui/Portal'
import { useSystemModal } from '@/components/ui/SystemModal'
import { PhoneBadge } from '@/components/ui/PhoneBadge'
import {
  Calendar as CalendarIcon,
  CalendarDays,
  Columns3,
  Table as TableIcon,
  FileSpreadsheet,
  Plus,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  User,
  Phone,
  MessageSquare,
  Check,
  X,
  Clock,
  Building2,
  Stethoscope,
  Trash2,
  ExternalLink,
  Send,
  AlertCircle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  FileText,
  Download,
  Users,
  Star,
  Activity,
  ArrowRight,
  ShieldCheck
} from 'lucide-react'
import {
  createAgendaAction,
  deleteAgendaAction,
  fetchAgendasAction,
  fetchAgendaDetalhadaAction,
  searchPacientesParaAgendaAction,
  allocatePacienteToAgendaAction,
  updateAgendamentoAction,
  removeAgendamentoAction,
  fetchKanbanDataAction,
  fetchFechamentoSisregAction,
  markExportedSisregAction,
  type CreateAgendaInput,
  type UpdateAgendamentoInput
} from './actions'
import { sendWhatsAppMessageAction, getWhatsAppWebUrl } from '@/lib/communication'

interface AgendasClientProps {
  role: string
  email: string
  userHospitalId?: string | null
  prestadores: any[]
  templates: any[]
  initialAgendas: any[]
}

type ViewMode = 'CALENDAR' | 'KANBAN' | 'TABLE' | 'SISREG'
type CalendarSubView = 'MONTH' | 'WEEK' | 'DAY'

const KANBAN_COLUMNS = [
  { id: 'AGENDADO_PRE_OP', label: 'Consulta Pré-Op Agendada', color: 'border-blue-500/30 bg-blue-500/5 text-blue-500' },
  { id: 'CONSULTA_REALIZADA', label: 'Consulta Realizada (Avaliado)', color: 'border-indigo-500/30 bg-indigo-500/5 text-indigo-500' },
  { id: 'AGUARDANDO_CIRURGIA', label: 'Aguardando Data Cirurgia', color: 'border-amber-500/30 bg-amber-500/5 text-amber-500' },
  { id: 'CIRURGIA_AGENDADA', label: 'Cirurgia Agendada', color: 'border-purple-500/30 bg-purple-500/5 text-purple-500' },
  { id: 'CIRURGIA_REALIZADA', label: 'Cirurgia Realizada (Sucesso)', color: 'border-emerald-500/30 bg-emerald-500/5 text-emerald-500' },
  { id: 'DESFECHOS_CANCELADOS', label: 'Inaptos / Faltas / Intercorrências', color: 'border-rose-500/30 bg-rose-500/5 text-rose-500' },
]

export function AgendasClient({
  role,
  email,
  userHospitalId,
  prestadores,
  templates,
  initialAgendas
}: AgendasClientProps) {
  const { showAlert, showConfirm } = useSystemModal()

  // Navegação de Visão
  const [viewMode, setViewMode] = useState<ViewMode>('CALENDAR')
  const [calendarSubView, setCalendarSubView] = useState<CalendarSubView>('MONTH')

  // Agendas e Filtros
  const [agendas, setAgendas] = useState<any[]>(initialAgendas)
  const [selectedHospital, setSelectedHospital] = useState(userHospitalId || '')
  const [selectedEspecialidade, setSelectedEspecialidade] = useState('')
  const [searchMedico, setSearchMedico] = useState('')
  const [currentDate, setCurrentDate] = useState(new Date())

  // Modais
  const [modalNovaAgenda, setModalNovaAgenda] = useState(false)
  const [agendaDetalhada, setAgendaDetalhada] = useState<any | null>(null)
  const [drawerAgendaOpen, setDrawerAgendaOpen] = useState(false)
  const [drawerAlocarOpen, setDrawerAlocarOpen] = useState(false)

  // Modal de Intercorrência Clínica
  const [modalIntercorrencia, setModalIntercorrencia] = useState(false)
  const [intercorrenciaAgendamento, setIntercorrenciaAgendamento] = useState<any | null>(null)
  const [tipoIntercorrencia, setTipoIntercorrencia] = useState('REPROVADO_RISCO_CARDIOLOGICO')
  const [descIntercorrencia, setDescIntercorrencia] = useState('')
  const [medicoIntercorrencia, setMedicoIntercorrencia] = useState('')
  const [savingIntercorrencia, setSavingIntercorrencia] = useState(false)

  // Formulário Nova Agenda
  const [formNovaAgenda, setFormNovaAgenda] = useState<CreateAgendaInput>({
    hospital_id: userHospitalId || '',
    medico_nome: '',
    especialidade: 'CIRURGIA GERAL',
    data_agenda: new Date().toISOString().split('T')[0],
    horario_inicio: '08:00',
    horario_fim: '12:00',
    quantidade_vagas: 15,
    tipo_agenda: 'CONSULTA_PRE_OP',
    observacoes_bloqueio: ''
  })
  const [savingAgenda, setSavingAgenda] = useState(false)

  // Alocação da Fila
  const [filaBusca, setFilaBusca] = useState('')
  const [pacientesFila, setPacientesFila] = useState<any[]>([])
  const [loadingFila, setLoadingFila] = useState(false)
  const [allocatingId, setAllocatingId] = useState<number | null>(null)

  // Dados Kanban
  const [kanbanData, setKanbanData] = useState<any[]>([])
  const [loadingKanban, setLoadingKanban] = useState(false)

  // Dados Fechamento SISREG
  const [sisregData, setSisregData] = useState<any[]>([])
  const [loadingSisreg, setLoadingSisreg] = useState(false)
  const [selectedSisregIds, setSelectedSisregIds] = useState<string[]>([])
  const [sisregFiltroPendente, setSisregFiltroPendente] = useState(true)

  // Disparos WhatsApp
  const [sendingWa, setSendingWa] = useState(false)

  // Handlers de Intercorrência
  const handleOpenIntercorrencia = (ag: any) => {
    setIntercorrenciaAgendamento(ag)
    setTipoIntercorrencia(ag.intercorrencia_tipo || 'REPROVADO_RISCO_CARDIOLOGICO')
    setDescIntercorrencia(ag.intercorrencia_descricao || ag.observacoes_clinicas || '')
    setMedicoIntercorrencia(ag.realizado_por_medico || agendaDetalhada?.medico_nome || '')
    setModalIntercorrencia(true)
  }

  const handleSaveIntercorrencia = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!intercorrenciaAgendamento) return
    setSavingIntercorrencia(true)
    try {
      const statusMap: Record<string, string> = {
        REPROVADO_RISCO_CARDIOLOGICO: 'INAPTO_RISCO_CIRURGICO',
        REPROVADO_ANESTESIA: 'INAPTO_RISCO_CIRURGICO',
        FALTA_LEITO_UTI: 'ENCAMINHADO_ALTA_COMPLEXIDADE',
        ABSENTEISMO_PACIENTE: 'ABSENTEISMO_CIRURGIA',
        SUSPENSAO_CLINICA: 'INAPTO_RISCO_CIRURGICO',
        INTERCORRENCIA_CLINICA: 'INAPTO_RISCO_CIRURGICO'
      }
      const nextStatus = statusMap[tipoIntercorrencia] || 'INAPTO_RISCO_CIRURGICO'

      await handleUpdateAgendamento(intercorrenciaAgendamento.id, {
        desfecho_execucao: tipoIntercorrencia,
        intercorrencia_tipo: tipoIntercorrencia,
        intercorrencia_descricao: descIntercorrencia,
        realizado_por_medico: medicoIntercorrencia,
        status_agendamento: nextStatus,
        observacoes_clinicas: descIntercorrencia
      })

      showAlert({ title: 'Intercorrência Registrada', message: 'Parecer clínico registrado com sucesso e equipe informada.', type: 'success' })
      setModalIntercorrencia(false)
    } finally {
      setSavingIntercorrencia(false)
    }
  }

  // Atualizar agendas quando filtros de período/hospital mudarem
  const reloadAgendas = async () => {
    const start = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1).toISOString().split('T')[0]
    const end = new Date(currentDate.getFullYear(), currentDate.getMonth() + 2, 0).toISOString().split('T')[0]

    const res = await fetchAgendasAction({
      dataInicio: start,
      dataFim: end,
      hospitalId: selectedHospital || undefined,
      especialidade: selectedEspecialidade || undefined,
      medico: searchMedico || undefined
    })

    if (res.success) {
      setAgendas(res.data)
    }
  }

  useEffect(() => {
    reloadAgendas()
  }, [currentDate, selectedHospital, selectedEspecialidade, searchMedico])

  // Carregar dados de Kanban quando aba for aberta
  useEffect(() => {
    if (viewMode === 'KANBAN') {
      setLoadingKanban(true)
      fetchKanbanDataAction({
        hospitalId: selectedHospital || undefined,
        medico: searchMedico || undefined,
        especialidade: selectedEspecialidade || undefined
      })
        .then(res => {
          if (res.success) setKanbanData(res.data)
        })
        .finally(() => setLoadingKanban(false))
    }
  }, [viewMode, selectedHospital, searchMedico, selectedEspecialidade])

  // Carregar dados de Fechamento SISREG quando aba for aberta
  useEffect(() => {
    if (viewMode === 'SISREG') {
      setLoadingSisreg(true)
      fetchFechamentoSisregAction({
        hospitalId: selectedHospital || undefined,
        apenasPendentes: sisregFiltroPendente
      })
        .then(res => {
          if (res.success) setSisregData(res.data)
        })
        .finally(() => setLoadingSisreg(false))
    }
  }, [viewMode, selectedHospital, sisregFiltroPendente])

  // Abrir detalhes de uma agenda
  const handleOpenAgendaDetalhes = async (agendaId: string) => {
    const res = await fetchAgendaDetalhadaAction(agendaId)
    if (res.success && res.data) {
      setAgendaDetalhada(res.data)
      setDrawerAgendaOpen(true)
    } else {
      showAlert({ title: 'Erro', message: 'Não foi possível carregar os detalhes da agenda.', type: 'error' })
    }
  }

  // Abrir gaveta para alocar pacientes da fila
  const handleOpenAlocar = async () => {
    if (!agendaDetalhada) return
    setDrawerAlocarOpen(true)
    setLoadingFila(true)
    try {
      const res = await searchPacientesParaAgendaAction({
        especialidade: agendaDetalhada.especialidade,
        search: filaBusca || undefined
      })
      if (res.success) setPacientesFila(res.data)
    } finally {
      setLoadingFila(false)
    }
  }

  // Buscar na fila com debounce ou enter
  const handleSearchFila = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!agendaDetalhada) return
    setLoadingFila(true)
    try {
      const res = await searchPacientesParaAgendaAction({
        especialidade: agendaDetalhada.especialidade,
        search: filaBusca || undefined
      })
      if (res.success) setPacientesFila(res.data)
    } finally {
      setLoadingFila(false)
    }
  }

  // Alocar paciente selecionado na agenda
  const handleAllocate = async (paciente: any) => {
    if (!agendaDetalhada) return
    setAllocatingId(paciente.cod_solicitacao)
    try {
      const res = await allocatePacienteToAgendaAction(
        agendaDetalhada.id,
        paciente.cod_solicitacao,
        paciente.pacientes.id
      )
      if (!res.success) throw new Error(res.error)

      // Atualizar lista de pacientes da agenda
      const freshAgenda = await fetchAgendaDetalhadaAction(agendaDetalhada.id)
      if (freshAgenda.success) setAgendaDetalhada(freshAgenda.data)

      // Remover da lista de disponíveis localmente
      setPacientesFila(prev => prev.filter(p => p.cod_solicitacao !== paciente.cod_solicitacao))
      reloadAgendas()

      showAlert({
        title: 'Paciente Alocado',
        message: `Paciente ${paciente.pacientes.nome_usuario} vinculado com sucesso à agenda!`,
        type: 'success'
      })
    } catch (err: any) {
      showAlert({ title: 'Erro ao Alocar', message: err.message, type: 'error' })
    } finally {
      setAllocatingId(null)
    }
  }

  // Desalocar paciente da agenda
  const handleRemoveAgendamento = async (agendamentoId: string, nomePaciente: string) => {
    const confirmed = await showConfirm({
      title: 'Desalocar Paciente',
      message: `Deseja remover "${nomePaciente}" desta agenda? O paciente retornará para a fila de espera.`,
      confirmText: 'Desalocar',
      variant: 'danger'
    })
    if (!confirmed) return

    const res = await removeAgendamentoAction(agendamentoId)
    if (res.success) {
      const freshAgenda = await fetchAgendaDetalhadaAction(agendaDetalhada.id)
      if (freshAgenda.success) setAgendaDetalhada(freshAgenda.data)
      reloadAgendas()
      showAlert({ title: 'Paciente Desalocado', message: 'Vaga liberada com sucesso.', type: 'success' })
    } else {
      showAlert({ title: 'Erro ao Desalocar', message: res.error || 'Erro.', type: 'error' })
    }
  }

  // Atualizar dados de um agendamento (Comparecimento, Cirurgia, Parecer)
  const handleUpdateAgendamento = async (agendamentoId: string, payload: UpdateAgendamentoInput) => {
    const res = await updateAgendamentoAction(agendamentoId, payload)
    if (res.success) {
      if (agendaDetalhada) {
        const fresh = await fetchAgendaDetalhadaAction(agendaDetalhada.id)
        if (fresh.success) setAgendaDetalhada(fresh.data)
      }
      reloadAgendas()
    } else {
      showAlert({ title: 'Erro', message: res.error || 'Falha ao atualizar dados.', type: 'error' })
    }
  }

  // Salvar nova agenda
  const handleCreateAgenda = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingAgenda(true)
    try {
      const res = await createAgendaAction(formNovaAgenda)
      if (!res.success) throw new Error(res.error)
      showAlert({ title: 'Agenda Criada', message: 'Oferta de vagas cadastrada com sucesso!', type: 'success' })
      setModalNovaAgenda(false)
      reloadAgendas()
      // Reset form
      setFormNovaAgenda({
        hospital_id: '',
        medico_nome: '',
        especialidade: 'CIRURGIA GERAL',
        data_agenda: new Date().toISOString().split('T')[0],
        horario_inicio: '08:00',
        quantidade_vagas: 15,
        tipo_agenda: 'CONSULTA_PRE_OP',
        observacoes_bloqueio: ''
      })
    } catch (err: any) {
      showAlert({ title: 'Erro ao Criar Agenda', message: err.message, type: 'error' })
    } finally {
      setSavingAgenda(false)
    }
  }

  // Excluir agenda
  const handleDeleteAgenda = async (agendaId: string, medico: string, data: string) => {
    const confirmed = await showConfirm({
      title: 'Excluir Agenda',
      message: `Tem certeza de que deseja excluir a agenda do Dr(a). ${medico} do dia ${new Date(data + 'T00:00:00').toLocaleDateString('pt-BR')}?`,
      confirmText: 'Excluir',
      variant: 'danger'
    })
    if (!confirmed) return

    const res = await deleteAgendaAction(agendaId)
    if (res.success) {
      setDrawerAgendaOpen(false)
      reloadAgendas()
      showAlert({ title: 'Agenda Excluída', message: 'A agenda foi removida com sucesso.', type: 'success' })
    } else {
      showAlert({ title: 'Erro ao Excluir', message: res.error || 'Erro.', type: 'error' })
    }
  }

  // Disparo direto de WhatsApp para o paciente
  const handleSendWhatsApp = async (telefone: string, nomePaciente: string, especialidade: string, dataAgenda: string) => {
    if (!telefone) {
      showAlert({ title: 'Telefone Ausente', message: 'Paciente sem telefone cadastrado.', type: 'warning' })
      return
    }

    const dataFmt = new Date(dataAgenda + 'T00:00:00').toLocaleDateString('pt-BR')
    const msg = `Olá, ${nomePaciente}. Entramos em contato da Regulação de Saúde de Marabá referente ao seu agendamento de consulta pré-operatória de ${especialidade} agendada para ${dataFmt}. Por favor, confirme seu comparecimento respondendo a esta mensagem.`

    setSendingWa(true)
    try {
      const res = await sendWhatsAppMessageAction({ phone: telefone, message: msg })
      if (res.success) {
        showAlert({ title: 'WhatsApp Enviado', message: `Mensagem enviada com sucesso para ${res.phoneUsed || telefone}!`, type: 'success' })
      } else {
        const url = await getWhatsAppWebUrl(telefone, msg)
        window.open(url, '_blank')
      }
    } catch (err: any) {
      const url = await getWhatsAppWebUrl(telefone, msg)
      window.open(url, '_blank')
    } finally {
      setSendingWa(false)
    }
  }

  // Exportar dados do Fechamento SISREG para CSV
  const handleExportCSV = () => {
    if (sisregData.length === 0) {
      showAlert({ title: 'Sem Dados', message: 'Não há registros para exportar.', type: 'warning' })
      return
    }

    const headers = [
      'Cód. SISREG Consulta',
      'Nome do Paciente',
      'Cartão SUS (CNS)',
      'CPF',
      'Procedimento',
      'Médico',
      'Especialidade',
      'Hospital/Prestador',
      'Data Agenda/Consulta',
      'Comparecimento Consulta (S/N)',
      'Parecer Pré-Op',
      'Data da Cirurgia',
      'Cirurgia Realizada (S/N)',
      'Data Execução',
      'Status Final',
      'Observações Clínicas'
    ]

    const rows = sisregData.map(item => [
      item.cod_solicitacao,
      `"${item.pacientes?.nome_usuario || ''}"`,
      `"${item.pacientes?.cns_usuario || ''}"`,
      `"${item.pacientes?.cpf_usuario || ''}"`,
      `"${item.fila_solicitacoes?.procedimentos?.desc_sigtap || ''}"`,
      `"${item.agendas_prestadores?.medico_nome || ''}"`,
      `"${item.agendas_prestadores?.especialidade || ''}"`,
      `"${item.agendas_prestadores?.hospitais_prestadores?.nome || ''}"`,
      item.agendas_prestadores?.data_agenda || '',
      item.compareceu_consulta === true ? 'SIM' : item.compareceu_consulta === false ? 'NÃO' : 'PENDENTE',
      item.parecer_pre_op || '',
      item.data_cirurgia_agendada || '',
      item.cirurgia_realizada === true ? 'SIM' : item.cirurgia_realizada === false ? 'NÃO' : 'PENDENTE',
      item.data_cirurgia_execucao || '',
      item.status_agendamento,
      `"${(item.observacoes_clinicas || '').replace(/"/g, '""')}"`
    ])

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `fechamento_sisreg_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Marcar agendamentos selecionados como exportados no SISREG
  const handleMarkSelectedAsExported = async () => {
    if (selectedSisregIds.length === 0) {
      showAlert({ title: 'Atenção', message: 'Selecione pelo menos um registro para marcar como exportado.', type: 'warning' })
      return
    }

    const res = await markExportedSisregAction(selectedSisregIds)
    if (res.success) {
      showAlert({ title: 'Sucesso', message: `${selectedSisregIds.length} registro(s) marcado(s) como informados ao SISREG!`, type: 'success' })
      setSelectedSisregIds([])
      // Recarregar dados
      const fresh = await fetchFechamentoSisregAction({
        hospitalId: selectedHospital || undefined,
        apenasPendentes: sisregFiltroPendente
      })
      if (fresh.success) setSisregData(fresh.data)
    } else {
      showAlert({ title: 'Erro', message: res.error || 'Falha ao atualizar registros.', type: 'error' })
    }
  }

  // Dias do Calendário Mensal
  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()

    const firstDayIndex = new Date(year, month, 1).getDay()
    const lastDate = new Date(year, month + 1, 0).getDate()

    const days = []

    // Dias do mês anterior
    const prevMonthLastDate = new Date(year, month, 0).getDate()
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month - 1, prevMonthLastDate - i),
        isCurrentMonth: false
      })
    }

    // Dias do mês atual
    for (let i = 1; i <= lastDate; i++) {
      days.push({
        date: new Date(year, month, i),
        isCurrentMonth: true
      })
    }

    // Dias do próximo mês para completar 35 ou 42 células
    const remaining = (7 - (days.length % 7)) % 7
    for (let i = 1; i <= remaining; i++) {
      days.push({
        date: new Date(year, month + 1, i),
        isCurrentMonth: false
      })
    }

    return days
  }, [currentDate])

  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ]

  return (
    <DashboardShell role={role} email={email}>
      <div className="space-y-8">
        
        {/* Header Principal */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="px-2.5 py-1 text-[9px] font-black uppercase tracking-widest bg-primary/10 text-primary rounded-xl border border-primary/20 flex items-center gap-1.5">
                <Stethoscope className="h-3.5 w-3.5" />
                Central de Agendamento Cirúrgico
              </span>
            </div>
            <h2 className="text-3xl font-black text-foreground tracking-tighter uppercase mt-1.5">
              Agendas & <span className="text-primary italic">Cirurgias Eletivas</span>
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Controle completo de oferta de vagas por prestador, alocação de pacientes da fila, funil cirúrgico e devolutiva SISREG.
            </p>
          </div>

          {/* Botões de Ação Topo */}
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={() => setModalNovaAgenda(true)}
              className="px-5 py-3 rounded-2xl bg-primary text-primary-foreground text-xs font-black uppercase tracking-widest hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer shadow-lg shadow-primary/20 flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              <span>Ofertar Nova Agenda</span>
            </button>
          </div>
        </div>

        {/* Barra de Filtros & Seletor de Modo de Visão */}
        <div className="bento-card p-4 md:p-6 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            
            {/* Seletor de Visualização */}
            <div className="flex gap-1.5 p-1 bg-muted/40 backdrop-blur-md rounded-2xl border border-border/30 w-fit">
              <button
                onClick={() => setViewMode('CALENDAR')}
                className={`flex items-center gap-2 px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${
                  viewMode === 'CALENDAR' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <CalendarDays className="h-3.5 w-3.5" />
                <span>Calendário</span>
              </button>

              <button
                onClick={() => setViewMode('KANBAN')}
                className={`flex items-center gap-2 px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${
                  viewMode === 'KANBAN' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Columns3 className="h-3.5 w-3.5" />
                <span>Kanban Cirúrgico</span>
              </button>

              <button
                onClick={() => setViewMode('TABLE')}
                className={`flex items-center gap-2 px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${
                  viewMode === 'TABLE' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <TableIcon className="h-3.5 w-3.5" />
                <span>Visão Planilha</span>
              </button>

              <button
                onClick={() => setViewMode('SISREG')}
                className={`flex items-center gap-2 px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${
                  viewMode === 'SISREG' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                <span>Fechamento SISREG</span>
              </button>
            </div>

            {/* Controles de Mês (quando em modo Calendário) */}
            {viewMode === 'CALENDAR' && (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))}
                  className="p-2 rounded-xl hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors cursor-pointer border border-border/40"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-sm font-black uppercase tracking-wider text-foreground min-w-36 text-center">
                  {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
                </span>
                <button
                  onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))}
                  className="p-2 rounded-xl hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors cursor-pointer border border-border/40"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setCurrentDate(new Date())}
                  className="px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-primary hover:bg-primary/10 rounded-xl border border-primary/20 transition-all cursor-pointer"
                >
                  Hoje
                </button>
              </div>
            )}
          </div>

          {/* Filtros Secundários */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 pt-2 border-t border-border/20 text-xs">
            <div>
              <label className="block text-[8px] font-black uppercase tracking-widest text-muted-foreground mb-1">Hospital / Prestador</label>
              <select
                value={selectedHospital}
                onChange={(e) => setSelectedHospital(e.target.value)}
                className="block w-full rounded-xl border border-border/50 bg-background/50 py-2.5 px-3 text-xs outline-none focus:border-primary transition-all text-foreground"
              >
                <option value="">Todos os Prestadores</option>
                {prestadores.map(p => (
                  <option key={p.id} value={p.id}>{p.nome}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[8px] font-black uppercase tracking-widest text-muted-foreground mb-1">Especialidade</label>
              <select
                value={selectedEspecialidade}
                onChange={(e) => setSelectedEspecialidade(e.target.value)}
                className="block w-full rounded-xl border border-border/50 bg-background/50 py-2.5 px-3 text-xs outline-none focus:border-primary transition-all text-foreground"
              >
                <option value="">Todas as Especialidades</option>
                <option value="CIRURGIA GERAL">CIRURGIA GERAL</option>
                <option value="UROLOGIA">UROLOGIA</option>
                <option value="PEQUENAS CIRURGIAS">PEQUENAS CIRURGIAS</option>
                <option value="GINECOLOGIA">GINECOLOGIA</option>
                <option value="ORTOPEDIA">ORTOPEDIA</option>
                <option value="OFTALMOLOGIA">OFTALMOLOGIA</option>
              </select>
            </div>

            <div>
              <label className="block text-[8px] font-black uppercase tracking-widest text-muted-foreground mb-1">Buscar por Médico</label>
              <input
                type="text"
                value={searchMedico}
                onChange={(e) => setSearchMedico(e.target.value)}
                placeholder="Ex: Dr. José Roberto..."
                className="block w-full rounded-xl border border-border/50 bg-background/50 py-2.5 px-3 text-xs outline-none focus:border-primary transition-all text-foreground uppercase"
              />
            </div>

            <div className="flex items-end">
              <button
                type="button"
                onClick={() => {
                  setSelectedHospital('')
                  setSelectedEspecialidade('')
                  setSearchMedico('')
                }}
                className="w-full py-2.5 rounded-xl border border-border/40 text-[9px] font-black uppercase tracking-widest text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-all cursor-pointer text-center"
              >
                Limpar Filtros
              </button>
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* 1. VISUALIZAÇÃO EM CALENDÁRIO MENSAL                     */}
        {/* ======================================================== */}
        {viewMode === 'CALENDAR' && (
          <div className="bento-card overflow-hidden">
            {/* Dias da semana */}
            <div className="grid grid-cols-7 border-b border-border/20 bg-muted/20 text-center py-3 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
              <div>Dom</div>
              <div>Seg</div>
              <div>Ter</div>
              <div>Qua</div>
              <div>Qui</div>
              <div>Sex</div>
              <div>Sáb</div>
            </div>

            {/* Grid de Dias */}
            <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-border/10">
              {calendarDays.map((dayItem, idx) => {
                const dateStr = dayItem.date.toISOString().split('T')[0]
                const dayAgendas = agendas.filter(a => a.data_agenda === dateStr)
                const isToday = dateStr === new Date().toISOString().split('T')[0]

                return (
                  <div
                    key={idx}
                    className={`min-h-32 p-2 transition-colors flex flex-col justify-between ${
                      dayItem.isCurrentMonth ? 'bg-card/40' : 'bg-muted/5 opacity-40'
                    } ${isToday ? 'ring-2 ring-primary/40 bg-primary/[0.02]' : ''}`}
                  >
                    {/* Cabeçalho do dia */}
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-black rounded-lg px-1.5 py-0.5 ${
                        isToday ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
                      }`}>
                        {dayItem.date.getDate()}
                      </span>
                      {dayAgendas.length > 0 && (
                        <span className="text-[8px] font-black uppercase tracking-widest text-primary">
                          {dayAgendas.length} agenda{dayAgendas.length > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>

                    {/* Blocos de Agendas deste dia */}
                    <div className="space-y-1.5 my-2 flex-1">
                      {dayAgendas.map(agenda => {
                        const totalVagas = agenda.quantidade_vagas || 15
                        const ocupadas = agenda.agendamentos_procedimentos?.length || 0
                        const isFull = ocupadas >= totalVagas

                        return (
                          <div
                            key={agenda.id}
                            onClick={() => handleOpenAgendaDetalhes(agenda.id)}
                            className={`p-2 rounded-xl border text-left cursor-pointer transition-all hover:scale-[1.02] shadow-sm ${
                              isFull
                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                                : ocupadas > 0
                                  ? 'bg-primary/10 border-primary/30 text-foreground'
                                  : 'bg-muted/40 border-border/40 text-muted-foreground'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-[8px] font-black uppercase tracking-wider truncate font-mono">
                                {agenda.horario_inicio} · {agenda.medico_nome.split(' ')[0]}
                              </span>
                              <span className={`text-[7px] font-black px-1 py-0.2 rounded font-mono ${
                                isFull ? 'bg-emerald-500 text-white' : 'bg-primary text-primary-foreground'
                              }`}>
                                {ocupadas}/{totalVagas}
                              </span>
                            </div>
                            <p className="text-[8px] font-bold truncate opacity-80 uppercase mt-0.5">
                              {agenda.especialidade}
                            </p>
                          </div>
                        )
                      })}
                    </div>

                    {/* Botão rápido de adicionar agenda no dia */}
                    {dayItem.isCurrentMonth && (
                      <button
                        onClick={() => {
                          setFormNovaAgenda(prev => ({ ...prev, data_agenda: dateStr }))
                          setModalNovaAgenda(true)
                        }}
                        className="w-full py-1 text-[8px] font-black uppercase tracking-widest text-muted-foreground/40 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors text-center cursor-pointer"
                      >
                        + Ofertar
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* 2. VISUALIZAÇÃO EM KANBAN CIRÚRGICO                      */}
        {/* ======================================================== */}
        {viewMode === 'KANBAN' && (
          <div className="space-y-4">
            {loadingKanban ? (
              <div className="bento-card p-12 text-center text-muted-foreground">
                <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-3" />
                <span className="text-xs font-bold uppercase tracking-widest">Carregando funil cirúrgico...</span>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6 items-start">
                {KANBAN_COLUMNS.map(col => {
                  const items = kanbanData.filter(item => {
                    if (col.id === 'DESFECHOS_CANCELADOS') {
                      return ['ABSENTEISMO_CONSULTA', 'ABSENTEISMO_CIRURGIA', 'INAPTO_RISCO_CIRURGICO', 'DESISTENCIA_PACIENTE', 'ENCAMINHADO_ALTA_COMPLEXIDADE'].includes(item.status_agendamento)
                    }
                    return item.status_agendamento === col.id
                  })

                  return (
                    <div key={col.id} className="bento-card p-4 flex flex-col h-[750px] border-t-4">
                      {/* Header da Coluna */}
                      <div className="pb-3 border-b border-border/20 flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider text-foreground">
                          {col.label}
                        </span>
                        <span className="text-[10px] font-mono font-black px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                          {items.length}
                        </span>
                      </div>

                      {/* Lista de Cards */}
                      <div className="flex-1 overflow-y-auto space-y-3 py-3 pr-1">
                        {items.length === 0 ? (
                          <div className="py-8 text-center text-muted-foreground/40 text-[10px] font-bold uppercase tracking-wider">
                            Nenhum paciente
                          </div>
                        ) : (
                          items.map(item => {
                            const tel = item.pacientes?.pacientes_telefones?.[0]?.numero || item.pacientes?.telefone_1 || ''
                            
                            return (
                              <div
                                key={item.id}
                                className="p-3 rounded-2xl border border-border/40 bg-card/60 hover:border-primary/40 transition-all space-y-2.5 shadow-sm"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-[8px] font-mono font-black text-muted-foreground/60">
                                    SOL: {item.cod_solicitacao}
                                  </span>
                                  <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                                    {item.agendas_prestadores?.especialidade}
                                  </span>
                                </div>

                                <div>
                                  <h4 className="text-xs font-black text-foreground uppercase truncate">
                                    {item.pacientes?.nome_usuario}
                                  </h4>
                                  <p className="text-[9px] text-muted-foreground font-semibold truncate mt-0.5">
                                    {item.fila_solicitacoes?.procedimentos?.desc_sigtap}
                                  </p>
                                </div>

                                <div className="text-[9px] text-muted-foreground/70 font-mono space-y-0.5 pt-1 border-t border-border/10">
                                  <p>👨‍⚕️ {item.agendas_prestadores?.medico_nome}</p>
                                  <p>📅 Agenda: {new Date(item.agendas_prestadores?.data_agenda + 'T00:00:00').toLocaleDateString('pt-BR')}</p>
                                  {item.data_cirurgia_agendada && (
                                    <p className="text-purple-500 font-bold">🔪 Cirurgia: {new Date(item.data_cirurgia_agendada + 'T00:00:00').toLocaleDateString('pt-BR')}</p>
                                  )}
                                </div>

                                {/* Ações Rápidas no Card */}
                                <div className="flex items-center justify-between pt-2 border-t border-border/10">
                                  {tel ? (
                                    <button
                                      type="button"
                                      onClick={() => handleSendWhatsApp(tel, item.pacientes.nome_usuario, item.agendas_prestadores.especialidade, item.agendas_prestadores.data_agenda)}
                                      className="p-1.5 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white rounded-xl transition-all cursor-pointer"
                                      title="Chamar WhatsApp"
                                    >
                                      <MessageSquare className="h-3.5 w-3.5" />
                                    </button>
                                  ) : (
                                    <span className="text-[8px] opacity-40 italic">Sem Tel</span>
                                  )}

                                  {/* Select de Avanço de Status */}
                                  <select
                                    value={item.status_agendamento}
                                    onChange={(e) => handleUpdateAgendamento(item.id, { status_agendamento: e.target.value })}
                                    className="text-[8px] font-black uppercase rounded-lg border border-border/40 bg-background/50 py-1 px-2 text-foreground outline-none focus:border-primary"
                                  >
                                    <option value="AGENDADO_PRE_OP">Pré-Op Agendado</option>
                                    <option value="CONSULTA_REALIZADA">Consulta Realizada</option>
                                    <option value="AGUARDANDO_CIRURGIA">Aguardando Cirurgia</option>
                                    <option value="CIRURGIA_AGENDADA">Cirurgia Agendada</option>
                                    <option value="CIRURGIA_REALIZADA">Cirurgia Realizada</option>
                                    <option value="ABSENTEISMO_CONSULTA">Faltou Consulta</option>
                                    <option value="ABSENTEISMO_CIRURGIA">Faltou Cirurgia</option>
                                    <option value="INAPTO_RISCO_CIRURGICO">Inapto Risco</option>
                                    <option value="DESISTENCIA_PACIENTE">Desistência</option>
                                  </select>
                                </div>
                              </div>
                            )
                          })
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* 3. VISUALIZAÇÃO EM TABELA / PLANILHA                     */}
        {/* ======================================================== */}
        {viewMode === 'TABLE' && (
          <div className="bento-card overflow-hidden">
            <div className="p-4 border-b border-border/10 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-foreground uppercase tracking-wider">
                  Listagem Geral de Agendas Cadastradas
                </h3>
                <p className="text-[10px] text-muted-foreground">
                  Clique em "Ver Vagas & Pacientes" para gerenciar cada atendimento.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border/20 bg-muted/20 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                    <th className="py-4 px-6">Data</th>
                    <th className="py-4 px-6">Horário</th>
                    <th className="py-4 px-6">Médico</th>
                    <th className="py-4 px-6">Especialidade</th>
                    <th className="py-4 px-6">Hospital / Prestador</th>
                    <th className="py-4 px-6">Ocupação de Vagas</th>
                    <th className="py-4 px-6 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/10 text-xs font-semibold">
                  {agendas.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-muted-foreground font-bold">
                        Nenhuma agenda cadastrada no período selecionado.
                      </td>
                    </tr>
                  ) : (
                    agendas.map(agenda => {
                      const totalVagas = agenda.quantidade_vagas || 15
                      const ocupadas = agenda.agendamentos_procedimentos?.length || 0
                      const isFull = ocupadas >= totalVagas

                      return (
                        <tr key={agenda.id} className="hover:bg-muted/10 transition-colors">
                          <td className="py-4 px-6 font-mono font-bold text-foreground">
                            {new Date(agenda.data_agenda + 'T00:00:00').toLocaleDateString('pt-BR')}
                          </td>
                          <td className="py-4 px-6 font-mono text-muted-foreground">
                            {agenda.horario_inicio}
                          </td>
                          <td className="py-4 px-6 font-bold uppercase text-foreground">
                            {agenda.medico_nome}
                          </td>
                          <td className="py-4 px-6 uppercase text-primary font-bold">
                            {agenda.especialidade}
                          </td>
                          <td className="py-4 px-6 text-muted-foreground uppercase">
                            {agenda.hospitais_prestadores?.nome || 'Central de Regulação'}
                          </td>
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-2">
                              <div className="w-24 bg-muted/40 h-2 rounded-full overflow-hidden">
                                <div
                                  className={`h-full ${isFull ? 'bg-emerald-500' : 'bg-primary'}`}
                                  style={{ width: `${Math.min(100, (ocupadas / totalVagas) * 100)}%` }}
                                />
                              </div>
                              <span className="font-mono text-xs font-black">
                                {ocupadas} / {totalVagas}
                              </span>
                            </div>
                          </td>
                          <td className="py-4 px-6 text-right">
                            <button
                              onClick={() => handleOpenAgendaDetalhes(agenda.id)}
                              className="px-4 py-2 bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer"
                            >
                              Ver Vagas ({ocupadas})
                            </button>
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

        {/* ======================================================== */}
        {/* 4. VISUALIZAÇÃO DE FECHAMENTO SISREG                     */}
        {/* ======================================================== */}
        {viewMode === 'SISREG' && (
          <div className="bento-card space-y-6 p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/10 pb-6">
              <div>
                <h3 className="text-lg font-black text-foreground uppercase tracking-wider">
                  Relatório de Devolutiva & Fechamento SISREG
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Exporte os desfechos cirúrgicos e de consultas para dar baixa oficial nas solicitações do SISREG.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleExportCSV}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md shadow-emerald-600/20 transition-all cursor-pointer flex items-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  <span>Exportar CSV (Excel)</span>
                </button>

                {selectedSisregIds.length > 0 && (
                  <button
                    type="button"
                    onClick={handleMarkSelectedAsExported}
                    className="px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer flex items-center gap-2"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Marcar como Exportado ({selectedSisregIds.length})</span>
                  </button>
                )}
              </div>
            </div>

            {/* Tabela de Fechamento */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border/20 bg-muted/20 text-[9px] font-black uppercase tracking-wider text-muted-foreground">
                    <th className="py-3 px-4">
                      <input
                        type="checkbox"
                        onChange={(e) => {
                          if (e.target.checked) setSelectedSisregIds(sisregData.map(d => d.id))
                          else setSelectedSisregIds([])
                        }}
                        checked={selectedSisregIds.length === sisregData.length && sisregData.length > 0}
                      />
                    </th>
                    <th className="py-3 px-4">Cód. SISREG</th>
                    <th className="py-3 px-4">Paciente</th>
                    <th className="py-3 px-4">Procedimento</th>
                    <th className="py-3 px-4">Data Agenda</th>
                    <th className="py-3 px-4">Consulta (S/N)</th>
                    <th className="py-3 px-4">Cirurgia (S/N)</th>
                    <th className="py-3 px-4">Data Cirurgia</th>
                    <th className="py-3 px-4">Status / Desfecho</th>
                    <th className="py-3 px-4">Exportado SISREG</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/10 text-xs font-semibold">
                  {sisregData.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-muted-foreground font-bold">
                        Nenhum registro localizado para fechamento.
                      </td>
                    </tr>
                  ) : (
                    sisregData.map(row => (
                      <tr key={row.id} className="hover:bg-muted/10 transition-colors">
                        <td className="py-3 px-4">
                          <input
                            type="checkbox"
                            checked={selectedSisregIds.includes(row.id)}
                            onChange={(e) => {
                              if (e.target.checked) setSelectedSisregIds(prev => [...prev, row.id])
                              else setSelectedSisregIds(prev => prev.filter(id => id !== row.id))
                            }}
                          />
                        </td>
                        <td className="py-3 px-4 font-mono text-muted-foreground font-bold">
                          {row.cod_solicitacao}
                        </td>
                        <td className="py-3 px-4 font-bold uppercase text-foreground">
                          {row.pacientes?.nome_usuario}
                        </td>
                        <td className="py-3 px-4 text-muted-foreground uppercase text-[11px]">
                          {row.fila_solicitacoes?.procedimentos?.desc_sigtap}
                        </td>
                        <td className="py-3 px-4 font-mono text-xs">
                          {row.agendas_prestadores?.data_agenda ? new Date(row.agendas_prestadores.data_agenda + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}
                        </td>
                        <td className="py-3 px-4">
                          {row.compareceu_consulta === true ? (
                            <span className="text-emerald-500 font-bold">SIM</span>
                          ) : row.compareceu_consulta === false ? (
                            <span className="text-red-500 font-bold">NÃO</span>
                          ) : (
                            <span className="text-muted-foreground opacity-50">Pendente</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {row.cirurgia_realizada === true ? (
                            <span className="text-emerald-500 font-bold">SIM</span>
                          ) : row.cirurgia_realizada === false ? (
                            <span className="text-red-500 font-bold">NÃO</span>
                          ) : (
                            <span className="text-muted-foreground opacity-50">Pendente</span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono text-xs">
                          {row.data_cirurgia_agendada ? new Date(row.data_cirurgia_agendada + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-muted">
                            {row.status_agendamento}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {row.exportado_sisreg ? (
                            <span className="text-[10px] font-black uppercase text-emerald-500 flex items-center gap-1">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Alimentado
                            </span>
                          ) : (
                            <span className="text-[10px] font-black uppercase text-amber-500 flex items-center gap-1">
                              <Clock className="h-3.5 w-3.5" /> Pendente
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>

      {/* ======================================================== */}
      {/* DRAWER: DETALHAMENTO DA AGENDA & PACIENTES ALOCADOS      */}
      {/* ======================================================== */}
      {drawerAgendaOpen && agendaDetalhada && (
        <Portal>
          <div className="fixed inset-0 z-50 overflow-hidden">
            <div
              className="absolute inset-0 bg-background/80 backdrop-blur-sm transition-opacity"
              onClick={() => setDrawerAgendaOpen(false)}
            />
            <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
              <div className="w-screen max-w-3xl bg-card border-l border-border/40 shadow-2xl flex flex-col h-full overflow-y-auto animate-in slide-in-from-right duration-350">
                
                {/* Header do Drawer */}
                <div className="p-6 md:p-8 border-b border-border/10 flex items-center justify-between bg-muted/10">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 text-[9px] font-black uppercase bg-primary text-primary-foreground rounded-lg">
                        {agendaDetalhada.especialidade}
                      </span>
                      <span className="text-xs font-mono font-black text-muted-foreground">
                        {new Date(agendaDetalhada.data_agenda + 'T00:00:00').toLocaleDateString('pt-BR')} às {agendaDetalhada.horario_inicio}
                      </span>
                    </div>
                    <h3 className="text-xl font-black text-foreground uppercase">
                      Dr(a). {agendaDetalhada.medico_nome}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Hospital: {agendaDetalhada.hospitais_prestadores?.nome || 'Central de Regulação Marabá'}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleDeleteAgenda(agendaDetalhada.id, agendaDetalhada.medico_nome, agendaDetalhada.data_agenda)}
                      className="p-2 rounded-xl text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
                      title="Excluir Agenda"
                    >
                      <Trash2 className="h-4.5 w-4.5" />
                    </button>
                    <button
                      onClick={() => setDrawerAgendaOpen(false)}
                      className="p-2 rounded-full hover:bg-muted/50 transition-colors cursor-pointer"
                    >
                      <X className="h-5 w-5 text-muted-foreground" />
                    </button>
                  </div>
                </div>

                {/* Vagas e Botão de Alocar */}
                <div className="p-6 md:p-8 space-y-6 flex-1">
                  <div className="flex items-center justify-between p-4 bg-muted/20 rounded-2xl border border-border/30">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Ocupação de Vagas</span>
                      <p className="text-lg font-black text-foreground font-mono">
                        {agendaDetalhada.agendamentos_procedimentos?.length || 0} / {agendaDetalhada.quantidade_vagas} preenchidas
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleOpenAlocar}
                      className="px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer shadow-md shadow-primary/20 flex items-center gap-2"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Preencher Vagas da Fila</span>
                    </button>
                  </div>

                  {/* Lista de Pacientes Alocados */}
                  <div className="space-y-4">
                    <h4 className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                      Pacientes Agendados nesta Sessão ({agendaDetalhada.agendamentos_procedimentos?.length || 0})
                    </h4>

                    {agendaDetalhada.agendamentos_procedimentos?.length === 0 ? (
                      <div className="p-8 rounded-2xl border border-dashed border-border/40 text-center text-muted-foreground">
                        <Users className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                        <p className="text-xs font-bold">Nenhum paciente alocado ainda.</p>
                        <p className="text-[10px] opacity-60 mt-1">Clique em "Preencher Vagas da Fila" acima para puxar os pacientes prioritários.</p>
                      </div>
                    ) : (
                      agendaDetalhada.agendamentos_procedimentos.map((ag: any, index: number) => {
                        const tel = ag.pacientes?.pacientes_telefones?.[0]?.numero || ag.pacientes?.telefone_1 || ''

                        return (
                          <div
                            key={ag.id}
                            className="p-5 rounded-2xl border border-border/40 bg-card space-y-4 shadow-sm"
                          >
                            {/* Linha 1: Dados do Paciente e Procedimento */}
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-border/10 pb-3">
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-mono font-black text-muted-foreground">#{index + 1}</span>
                                  <h5 className="text-sm font-black text-foreground uppercase">{ag.pacientes?.nome_usuario}</h5>
                                </div>
                                <p className="text-[10px] font-bold text-primary uppercase">
                                  {ag.fila_solicitacoes?.procedimentos?.desc_sigtap}
                                </p>
                              </div>

                              <div className="flex items-center gap-2">
                                {tel && (
                                  <button
                                    type="button"
                                    onClick={() => handleSendWhatsApp(tel, ag.pacientes.nome_usuario, agendaDetalhada.especialidade, agendaDetalhada.data_agenda)}
                                    className="px-3 py-1.5 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white rounded-xl text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer flex items-center gap-1.5 border border-emerald-500/20"
                                  >
                                    <MessageSquare className="h-3 w-3" />
                                    <span>WhatsApp</span>
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleRemoveAgendamento(ag.id, ag.pacientes.nome_usuario)}
                                  className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all cursor-pointer"
                                  title="Remover da Agenda"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </div>
                            </div>

                            {/* Linha 2: Controles Clínicos Rápidos (Comparecimento & Cirurgia) */}
                            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-xs">
                              {/* Comparecimento Consulta */}
                              <div className="space-y-1">
                                <label className="block text-[8px] font-black uppercase text-muted-foreground">Consulta Pré-Op</label>
                                <div className="flex gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateAgendamento(ag.id, { compareceu_consulta: true, status_agendamento: 'CONSULTA_REALIZADA' })}
                                    className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider flex-1 cursor-pointer transition-all ${
                                      ag.compareceu_consulta === true ? 'bg-emerald-500 text-white' : 'bg-muted/40 text-muted-foreground hover:bg-muted'
                                    }`}
                                  >
                                    Compareceu
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateAgendamento(ag.id, { compareceu_consulta: false, status_agendamento: 'ABSENTEISMO_CONSULTA' })}
                                    className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider flex-1 cursor-pointer transition-all ${
                                      ag.compareceu_consulta === false ? 'bg-red-500 text-white' : 'bg-muted/40 text-muted-foreground hover:bg-muted'
                                    }`}
                                  >
                                    Faltou
                                  </button>
                                </div>
                              </div>

                              {/* Parecer / Apto Cirurgia */}
                              <div className="space-y-1">
                                <label className="block text-[8px] font-black uppercase text-muted-foreground">Parecer Risco</label>
                                <select
                                  value={ag.parecer_pre_op || ''}
                                  onChange={(e) => handleUpdateAgendamento(ag.id, { parecer_pre_op: e.target.value as any })}
                                  className="block w-full rounded-lg border border-border/50 bg-background/50 py-1.5 px-2 text-[10px] outline-none focus:border-primary text-foreground font-bold"
                                >
                                  <option value="">Pendente</option>
                                  <option value="APTO_CIRURGIA">🟢 Apto para Cirurgia</option>
                                  <option value="INAPTO_TEMPORARIO">🟡 Inapto Temporário</option>
                                  <option value="INAPTO_DEFINITIVO">🔴 Inapto Definitivo</option>
                                  <option value="ENCAMINHADO_OUTRO_SERVICO">🔵 Encaminhado Outro</option>
                                </select>
                              </div>

                              {/* Data Marcada da Cirurgia */}
                              <div className="space-y-1">
                                <label className="block text-[8px] font-black uppercase text-muted-foreground">Data da Cirurgia</label>
                                <input
                                  type="date"
                                  value={ag.data_cirurgia_agendada || ''}
                                  onChange={(e) => handleUpdateAgendamento(ag.id, { data_cirurgia_agendada: e.target.value, status_agendamento: 'CIRURGIA_AGENDADA' })}
                                  className="block w-full rounded-lg border border-border/50 bg-background/50 py-1 px-2 text-[10px] outline-none focus:border-primary text-foreground font-mono"
                                />
                              </div>
                            </div>

                            {/* Linha 3: Desfecho Cirúrgico e Observação */}
                            <div className="grid gap-3 sm:grid-cols-2 pt-2 border-t border-border/10">
                              <div className="space-y-1">
                                <label className="block text-[8px] font-black uppercase text-muted-foreground">Cirurgia Realizada?</label>
                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateAgendamento(ag.id, { cirurgia_realizada: true, status_agendamento: 'CIRURGIA_REALIZADA' })}
                                    className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider flex-1 cursor-pointer transition-all ${
                                      ag.cirurgia_realizada === true ? 'bg-emerald-600 text-white' : 'bg-muted/40 text-muted-foreground hover:bg-muted'
                                    }`}
                                  >
                                    ✓ Operou com Sucesso
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenIntercorrencia(ag)}
                                    className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider flex-1 cursor-pointer transition-all border ${
                                      ag.intercorrencia_tipo ? 'bg-amber-500/20 text-amber-500 border-amber-500/40' : 'bg-rose-500/10 text-rose-500 border-rose-500/20 hover:bg-rose-500/20'
                                    }`}
                                  >
                                    ⚠️ Intercorrência / Falta
                                  </button>
                                </div>
                              </div>

                              <div className="space-y-1">
                                <label className="block text-[8px] font-black uppercase text-muted-foreground">Observação Clínica / Parecer</label>
                                <input
                                  type="text"
                                  defaultValue={ag.observacoes_clinicas || ''}
                                  onBlur={(e) => handleUpdateAgendamento(ag.id, { observacoes_clinicas: e.target.value })}
                                  placeholder="Ex: Cardiologista não autorizou, retorno pós-op dia..."
                                  className="block w-full rounded-lg border border-border/50 bg-background/50 py-1.5 px-2 text-[10px] outline-none focus:border-primary text-foreground"
                                />
                              </div>
                            </div>

                          </div>
                        )
                      })
                    )}
                  </div>
                </div>

              </div>
            </div>
          </div>
        </Portal>
      )}

      {/* ======================================================== */}
      {/* DRAWER: ALOCADOR INTELIGENTE DE PACIENTES DA FILA        */}
      {/* ======================================================== */}
      {drawerAlocarOpen && agendaDetalhada && (
        <Portal>
          <div className="fixed inset-0 z-50 overflow-hidden">
            <div
              className="absolute inset-0 bg-background/80 backdrop-blur-sm transition-opacity"
              onClick={() => setDrawerAlocarOpen(false)}
            />
            <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
              <div className="w-screen max-w-2xl bg-card border-l border-border/40 shadow-2xl flex flex-col h-full overflow-y-auto animate-in slide-in-from-right duration-350">
                
                {/* Header */}
                <div className="p-6 border-b border-border/10 flex items-center justify-between bg-primary/5">
                  <div>
                    <span className="text-[9px] font-black uppercase tracking-widest text-primary">Preenchimento de Vagas</span>
                    <h3 className="text-base font-black text-foreground uppercase mt-0.5">
                      Fila de Espera — {agendaDetalhada.especialidade}
                    </h3>
                  </div>
                  <button
                    onClick={() => setDrawerAlocarOpen(false)}
                    className="p-2 rounded-full hover:bg-muted/50 transition-colors cursor-pointer"
                  >
                    <X className="h-5 w-5 text-muted-foreground" />
                  </button>
                </div>

                {/* Busca na Fila */}
                <div className="p-6 border-b border-border/10">
                  <form onSubmit={handleSearchFila} className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        value={filaBusca}
                        onChange={(e) => setFilaBusca(e.target.value)}
                        placeholder="Buscar por Nome, CNS ou CPF..."
                        className="block w-full rounded-xl border border-border/50 bg-background/50 py-2.5 px-3 pl-9 text-xs text-foreground outline-none focus:border-primary uppercase"
                      />
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/45 pointer-events-none" />
                    </div>
                    <button
                      type="submit"
                      className="px-4 py-2.5 bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-widest rounded-xl hover:scale-[1.01] transition-all cursor-pointer"
                    >
                      Buscar
                    </button>
                  </form>
                </div>

                {/* Lista de Pacientes Prioritários */}
                <div className="p-6 space-y-3 flex-1 overflow-y-auto">
                  {loadingFila ? (
                    <div className="py-12 text-center text-muted-foreground">
                      <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2" />
                      <span className="text-[10px] font-bold uppercase tracking-widest">Buscando na fila...</span>
                    </div>
                  ) : pacientesFila.length === 0 ? (
                    <div className="py-12 text-center text-muted-foreground text-xs font-bold">
                      Nenhum paciente compatível aguardando na fila.
                    </div>
                  ) : (
                    pacientesFila.map(p => {
                      const tel = p.pacientes?.pacientes_telefones?.[0]?.numero || p.pacientes?.telefone_1 || ''

                      return (
                        <div
                          key={p.cod_solicitacao}
                          className="p-4 rounded-2xl border border-border/40 bg-card/60 hover:border-primary/40 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm"
                        >
                          <div className="space-y-1 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase bg-rose-500/10 text-rose-500 border border-rose-500/20">
                                Risco {p.classificacao_risco}
                              </span>
                              <span className="text-[9px] font-black text-primary uppercase font-mono">
                                Fila: {p.posicao_fila ? `${p.posicao_fila}º` : 'Ativo'}
                              </span>
                              <span className="text-[9px] font-mono text-muted-foreground/50">
                                SOL: {p.cod_solicitacao}
                              </span>
                            </div>
                            <h4 className="text-xs font-black text-foreground uppercase">{p.pacientes?.nome_usuario}</h4>
                            <p className="text-[10px] text-muted-foreground font-bold uppercase">{p.procedimentos?.desc_sigtap}</p>
                            {tel && (
                              <p className="text-[9px] text-muted-foreground font-mono">
                                Tel: {tel.replace(/^(\d{2})(\d{4,5})(\d{4})$/, '($1) $2-$3')}
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {tel && (
                              <button
                                type="button"
                                onClick={() => handleSendWhatsApp(tel, p.pacientes.nome_usuario, agendaDetalhada.especialidade, agendaDetalhada.data_agenda)}
                                className="p-2 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white rounded-xl transition-all cursor-pointer border border-emerald-500/20"
                                title="Chamar WhatsApp"
                              >
                                <MessageSquare className="h-3.5 w-3.5" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleAllocate(p)}
                              disabled={allocatingId === p.cod_solicitacao}
                              className="px-4 py-2 bg-primary text-primary-foreground rounded-xl text-[9px] font-black uppercase tracking-widest hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer shadow-md shadow-primary/10 disabled:opacity-50 flex items-center gap-1.5"
                            >
                              <Plus className="h-3 w-3" />
                              <span>{allocatingId === p.cod_solicitacao ? 'Alocando...' : 'Alocar na Vaga'}</span>
                            </button>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>

              </div>
            </div>
          </div>
        </Portal>
      )}

      {/* ======================================================== */}
      {/* MODAL: NOVA OFERTA DE AGENDA                            */}
      {/* ======================================================== */}
      {modalNovaAgenda && (
        <Portal>
          <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-background/80 backdrop-blur-sm transition-opacity"
              onClick={() => setModalNovaAgenda(false)}
            />
            <div className="relative w-full max-w-lg bg-card border border-border/40 shadow-2xl rounded-3xl p-6 md:p-8 space-y-6 animate-in zoom-in-95 duration-200">
              
              <div className="flex items-center justify-between border-b border-border/10 pb-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                    <CalendarDays className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Prestadores & Médicos</span>
                    <h3 className="text-base font-black text-foreground uppercase">Ofertar Nova Agenda</h3>
                  </div>
                </div>
                <button
                  onClick={() => setModalNovaAgenda(false)}
                  className="p-2 rounded-full hover:bg-muted/50 transition-colors cursor-pointer"
                >
                  <X className="h-5 w-5 text-muted-foreground" />
                </button>
              </div>

              <form onSubmit={handleCreateAgenda} className="space-y-4">
                <div>
                  <label className="block text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1.5">Médico Responsável</label>
                  <input
                    type="text"
                    required
                    value={formNovaAgenda.medico_nome}
                    onChange={(e) => setFormNovaAgenda(prev => ({ ...prev, medico_nome: e.target.value }))}
                    placeholder="Ex: DR. JOSÉ ROBERTO"
                    className="block w-full rounded-xl border border-border/50 bg-background/50 py-2.5 px-3 text-xs outline-none focus:border-primary text-foreground uppercase font-bold"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1.5">Especialidade</label>
                    <select
                      value={formNovaAgenda.especialidade}
                      onChange={(e) => setFormNovaAgenda(prev => ({ ...prev, especialidade: e.target.value }))}
                      className="block w-full rounded-xl border border-border/50 bg-background/50 py-2.5 px-3 text-xs outline-none focus:border-primary text-foreground font-bold"
                    >
                      <option value="CIRURGIA GERAL">CIRURGIA GERAL</option>
                      <option value="UROLOGIA">UROLOGIA</option>
                      <option value="PEQUENAS CIRURGIAS">PEQUENAS CIRURGIAS</option>
                      <option value="GINECOLOGIA">GINECOLOGIA</option>
                      <option value="ORTOPEDIA">ORTOPEDIA</option>
                      <option value="OFTALMOLOGIA">OFTALMOLOGIA</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1.5">Hospital / Prestador</label>
                    <select
                      value={formNovaAgenda.hospital_id || ''}
                      onChange={(e) => setFormNovaAgenda(prev => ({ ...prev, hospital_id: e.target.value }))}
                      className="block w-full rounded-xl border border-border/50 bg-background/50 py-2.5 px-3 text-xs outline-none focus:border-primary text-foreground"
                    >
                      <option value="">Central de Regulação (Padrão)</option>
                      {prestadores.map(p => (
                        <option key={p.id} value={p.id}>{p.nome}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-4">
                  <div>
                    <label className="block text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1.5">Data</label>
                    <input
                      type="date"
                      required
                      value={formNovaAgenda.data_agenda}
                      onChange={(e) => setFormNovaAgenda(prev => ({ ...prev, data_agenda: e.target.value }))}
                      className="block w-full rounded-xl border border-border/50 bg-background/50 py-2 px-3 text-xs outline-none focus:border-primary text-foreground font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1.5">Início</label>
                    <input
                      type="text"
                      required
                      value={formNovaAgenda.horario_inicio}
                      onChange={(e) => setFormNovaAgenda(prev => ({ ...prev, horario_inicio: e.target.value }))}
                      placeholder="08:00"
                      className="block w-full rounded-xl border border-border/50 bg-background/50 py-2 px-3 text-xs outline-none focus:border-primary text-foreground font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1.5">Término</label>
                    <input
                      type="text"
                      required
                      value={formNovaAgenda.horario_fim || '12:00'}
                      onChange={(e) => setFormNovaAgenda(prev => ({ ...prev, horario_fim: e.target.value }))}
                      placeholder="12:00"
                      className="block w-full rounded-xl border border-border/50 bg-background/50 py-2 px-3 text-xs outline-none focus:border-primary text-foreground font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1.5">Qtd. Vagas</label>
                    <input
                      type="number"
                      required
                      min={1}
                      max={100}
                      value={formNovaAgenda.quantidade_vagas}
                      onChange={(e) => setFormNovaAgenda(prev => ({ ...prev, quantidade_vagas: parseInt(e.target.value, 10) || 15 }))}
                      className="block w-full rounded-xl border border-border/50 bg-background/50 py-2 px-3 text-xs outline-none focus:border-primary text-foreground font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1.5">Observações / Sala</label>
                  <input
                    type="text"
                    value={formNovaAgenda.observacoes_bloqueio || ''}
                    onChange={(e) => setFormNovaAgenda(prev => ({ ...prev, observacoes_bloqueio: e.target.value }))}
                    placeholder="Ex: Ambulatório 2, trazer exames de sangue"
                    className="block w-full rounded-xl border border-border/50 bg-background/50 py-2.5 px-3 text-xs outline-none focus:border-primary text-foreground"
                  />
                </div>

                <div className="flex gap-3 pt-4 border-t border-border/10">
                  <button
                    type="button"
                    onClick={() => setModalNovaAgenda(false)}
                    className="w-1/2 py-3 border border-border/40 text-muted-foreground hover:bg-muted/50 hover:text-foreground text-[10px] font-black uppercase tracking-widest rounded-xl transition-all cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={savingAgenda}
                    className="w-1/2 py-3 bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-widest rounded-xl hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer disabled:opacity-50"
                  >
                    {savingAgenda ? 'Salvando...' : 'Salvar Agenda'}
                  </button>
                </div>
              </form>

            </div>
          </div>
        </Portal>
      )}

      {/* ======================================================== */}
      {/* MODAL: REGISTRO DE INTERCORRÊNCIA / PARECER CLÍNICO     */}
      {/* ======================================================== */}
      {modalIntercorrencia && intercorrenciaAgendamento && (
        <Portal>
          <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-background/80 backdrop-blur-sm transition-opacity"
              onClick={() => setModalIntercorrencia(false)}
            />
            <div className="relative w-full max-w-lg bg-card border border-border/40 shadow-2xl rounded-3xl p-6 md:p-8 space-y-6 animate-in zoom-in-95 duration-200">
              
              <div className="flex items-center justify-between border-b border-border/10 pb-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                    <AlertCircle className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-amber-500">Avaliação & Intercorrência</span>
                    <h3 className="text-base font-black text-foreground uppercase">Parecer do Prestador</h3>
                  </div>
                </div>
                <button
                  onClick={() => setModalIntercorrencia(false)}
                  className="p-2 rounded-full hover:bg-muted/50 transition-colors cursor-pointer"
                >
                  <X className="h-5 w-5 text-muted-foreground" />
                </button>
              </div>

              <div className="p-3 bg-muted/20 rounded-xl space-y-1">
                <span className="text-[9px] font-black uppercase text-muted-foreground">Paciente</span>
                <p className="text-xs font-black uppercase text-foreground">{intercorrenciaAgendamento.pacientes?.nome_usuario}</p>
                <p className="text-[10px] text-muted-foreground font-mono">SOL: {intercorrenciaAgendamento.cod_solicitacao}</p>
              </div>

              <form onSubmit={handleSaveIntercorrencia} className="space-y-4">
                <div>
                  <label className="block text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1.5">Tipo de Ocorrência / Motivo</label>
                  <select
                    value={tipoIntercorrencia}
                    onChange={(e) => setTipoIntercorrencia(e.target.value)}
                    className="block w-full rounded-xl border border-border/50 bg-background/50 py-2.5 px-3 text-xs outline-none focus:border-primary text-foreground font-bold"
                  >
                    <option value="REPROVADO_RISCO_CARDIOLOGICO">🫀 Risco Cardiológico Não Autorizou</option>
                    <option value="REPROVADO_ANESTESIA">💉 Contraindicação Anestésica</option>
                    <option value="FALTA_LEITO_UTI">🏥 Falta de Retaguarda / Leito de UTI</option>
                    <option value="INTERCORRENCIA_CLINICA">⚠️ Complicação Clínica Durante Atendimento</option>
                    <option value="ABSENTEISMO_PACIENTE">🚶 Paciente Não Compareceu (Falta)</option>
                    <option value="SUSPENSAO_CLINICA">❌ Suspensão por Jejum / Preparo Inadequado</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1.5">Médico Avaliador / Cirurgião</label>
                  <input
                    type="text"
                    value={medicoIntercorrencia}
                    onChange={(e) => setMedicoIntercorrencia(e.target.value)}
                    placeholder="Ex: DR. JOSÉ ROBERTO"
                    className="block w-full rounded-xl border border-border/50 bg-background/50 py-2.5 px-3 text-xs outline-none focus:border-primary text-foreground uppercase font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1.5">Justificativa Detalhada / Observação</label>
                  <textarea
                    required
                    rows={4}
                    value={descIntercorrencia}
                    onChange={(e) => setDescIntercorrencia(e.target.value)}
                    placeholder="Descreva o parecer médico, motivo da não realização ou orientações para a Regulação..."
                    className="block w-full rounded-xl border border-border/50 bg-background/50 p-3 text-xs outline-none focus:border-primary text-foreground"
                  />
                </div>

                <div className="flex gap-3 pt-4 border-t border-border/10">
                  <button
                    type="button"
                    onClick={() => setModalIntercorrencia(false)}
                    className="w-1/2 py-3 border border-border/40 text-muted-foreground hover:bg-muted/50 hover:text-foreground text-[10px] font-black uppercase tracking-widest rounded-xl transition-all cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={savingIntercorrencia}
                    className="w-1/2 py-3 bg-amber-500 text-black font-black text-[10px] uppercase tracking-widest rounded-xl hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer disabled:opacity-50 shadow-lg shadow-amber-500/20"
                  >
                    {savingIntercorrencia ? 'Salvando...' : 'Registrar Parecer'}
                  </button>
                </div>
              </form>

            </div>
          </div>
        </Portal>
      )}

    </DashboardShell>
  )
}

export default AgendasClient
