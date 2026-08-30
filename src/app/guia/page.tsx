'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import {
  HeartPulse,
  Users,
  Shield,
  FileSpreadsheet,
  PhoneCall,
  MessageSquare,
  Calendar,
  Layers,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Printer,
  ChevronRight,
  ExternalLink,
  BookOpen,
  Sparkles,
  Stethoscope,
  Building2,
  Clock,
  Search,
  Check,
  XCircle,
  HelpCircle,
  GripVertical
} from 'lucide-react'

// Tipos de Perfis
type RoleKey = 'OPERADOR' | 'COORDENADOR' | 'MEDICO' | 'HOSPITAL' | 'CIDADAO'

interface RoleInfo {
  id: RoleKey
  title: string
  subtitle: string
  icon: React.ComponentType<{ className?: string }>
  badge: string
  color: string
  description: string
  tasks: string[]
  mainScreens: { name: string; url: string; desc: string }[]
  goldenRule: string
}

const ROLES: Record<RoleKey, RoleInfo> = {
  OPERADOR: {
    id: 'OPERADOR',
    title: 'Operador de Convocação',
    subtitle: 'O coração da Central de Regulação',
    icon: PhoneCall,
    badge: 'Operação Diária',
    color: 'from-blue-600 to-cyan-600',
    description: 'Responsável por realizar a triagem dos pacientes no topo da fila, entrar em contato via telefone/WhatsApp, registrar o comparecimento e alocar nas agendas médicas disponíveis.',
    tasks: [
      'Filtrar a fila de espera pela especialidade e procedimento que terão vagas abertas.',
      'Ligar e enviar WhatsApp padronizado para os pacientes com os múltiplos telefones da base.',
      'Registrar o desfecho do contato: Confirmou, Sem Resposta, Recusou ou Número Inválido.',
      'Alocar pacientes confirmados na grade de vagas do médico.',
      'Solicitar autorização de mudança de prioridade caso o paciente apresente laudo de urgência.'
    ],
    mainScreens: [
      { name: 'Fila de Espera', url: '/dashboard/fila', desc: 'Triagem inteligente e chamadas' },
      { name: 'Agendas & Vagas', url: '/dashboard/agendas', desc: 'Alocação nas cotas dos médicos' },
      { name: 'Convocação', url: '/dashboard/convocacao', desc: 'Histórico de contatos' }
    ],
    goldenRule: 'Nunca deixe uma tentativa de contato sem registro. Se o número for inválido, sinalize para busca ativa na UBS.'
  },
  COORDENADOR: {
    id: 'COORDENADOR',
    title: 'Coordenador / Regulador',
    subtitle: 'Governança, Equidade e Auditoria',
    icon: Shield,
    badge: 'Gestão & Decisão',
    color: 'from-purple-600 to-indigo-600',
    description: 'Responsável pela integridade da fila, autorização de pedidos de alteração de risco, monitoramento dos tempos de espera e validação do fechamento mensal para o SISREG.',
    tasks: [
      'Importar e atualizar lotes de dados do SISREG e planilhas oficiais.',
      'Analisar e aprovar/rejeitar pedidos de mudança de risco clínico e prioridades.',
      'Acompanhar a taxa de absenteísmo (faltas) e ocupação de vagas dos prestadores.',
      'Gerar relatórios epidemiológicos e devolutivas para o Ministério da Saúde.'
    ],
    mainScreens: [
      { name: 'Movimentações da Fila', url: '/dashboard/movimentacoes', desc: 'Workflow de aprovação de prioridades' },
      { name: 'Importação SISREG', url: '/dashboard/importacao', desc: 'Ingestão e conciliação de dados' },
      { name: 'Auditoria Geral', url: '/dashboard/auditoria', desc: 'Log imutável de todas as ações' }
    ],
    goldenRule: 'Nenhum paciente pode ter sua prioridade alterada sem justificativa médica e registro formal na auditoria.'
  },
  MEDICO: {
    id: 'MEDICO',
    title: 'Médico / Auditor Clínico',
    subtitle: 'Decisão Técnica e Segurança do Paciente',
    icon: Stethoscope,
    badge: 'Corpo Clínico',
    color: 'from-emerald-600 to-teal-600',
    description: 'Responsável pela análise técnica de laudos clínicos, definição de riscos cirúrgicos, pareceres pré-operatórios e validação de casos de alta complexidade.',
    tasks: [
      'Avaliar exames e risco cardiológico/anestésico dos pacientes na fase pré-operatória.',
      'Emitir parecer de Apto para Cirurgia ou Inapto Temporário/Definitivo.',
      'Registrar intercorrências clínicas e motivos de suspensão cirúrgica.',
      'Validar solicitações de agravamento de quadro clínico.'
    ],
    mainScreens: [
      { name: 'Funil Cirúrgico', url: '/dashboard/agendas', desc: 'Pareceres pré-op e acompanhamento' },
      { name: 'Movimentações', url: '/dashboard/movimentacoes', desc: 'Apreciação de laudos de urgência' }
    ],
    goldenRule: 'O parecer clínico pré-operatório é soberano para garantir que apenas pacientes aptos entrem em centro cirúrgico.'
  },
  HOSPITAL: {
    id: 'HOSPITAL',
    title: 'Hospital Executante (HMM / CCE / CEI)',
    subtitle: 'Oferta de Vagas e Execução Cirúrgica',
    icon: Building2,
    badge: 'Rede Prestadora',
    color: 'from-amber-600 to-orange-600',
    description: 'Hospitais e clínicas da rede pública municipal que ofertam as cotas de vagas de consultas e cirurgias, realizam o atendimento e registram a execução.',
    tasks: [
      'Cadastrar previamente no sistema as grades de atendimento (Médico, Data, Horário e Vagas).',
      'Emitir o Mapa de Atendimento Diário / Lista de Presença da recepção.',
      'Registrar o comparecimento dos pacientes (Consulta Realizada vs Faltou).',
      'Confirmar a realização das cirurgias eletivas no centro cirúrgico.'
    ],
    mainScreens: [
      { name: 'Ofertar Nova Agenda', url: '/dashboard/agendas', desc: 'Disponibilização de cotas mensais' },
      { name: 'Lista de Presença', url: '/dashboard/agendas', desc: 'Impressão da escala do dia' }
    ],
    goldenRule: 'Disponibilize as agendas com antecedência mínima de 15 dias para permitir tempo hábil de convocação dos pacientes.'
  },
  CIDADAO: {
    id: 'CIDADAO',
    title: 'Cidadão / Paciente',
    subtitle: 'Transparência e Acesso à Informação',
    icon: Users,
    badge: 'Usuário do SUS',
    color: 'from-teal-600 to-emerald-600',
    description: 'O paciente de Marabá pode consultar a qualquer momento sua posição estimada na fila, orientações sobre seu procedimento e manter seus telefones atualizados.',
    tasks: [
      'Consultar sua posição na fila pelo CPF ou Cartão SUS (CNS).',
      'Manter os telefones sempre atualizados na Unidade Básica de Saúde.',
      'Apresentar-se na data agendada com documento com foto e exames solicitados.'
    ],
    mainScreens: [
      { name: 'Portal da Transparência', url: '/portal-cidadao', desc: 'Consulta pública sem necessidade de login' }
    ],
    goldenRule: 'Mantenha seu telefone sempre ativo para não perder a ligação ou mensagem de convocação da Secretaria de Saúde.'
  }
}

// 7 Etapas do Fluxo
const FLOW_STEPS = [
  {
    step: 1,
    title: 'Ingestão de Dados & Higienização',
    subtitle: 'Como a informação entra no sistema',
    icon: FileSpreadsheet,
    color: 'border-blue-500 bg-blue-500/10 text-blue-500',
    whatHappens: 'Os arquivos oficiais do SISREG ou planilhas de regulação são importados no sistema.',
    howItWorks: [
      'O sistema cruza os pacientes pelo Cartão SUS (CNS de 15 dígitos).',
      'Identifica automaticamente novos telefones e anexa notas clínicas sem apagar dados anteriores.',
      'Gera um protocolo de lote auditável com quantidade de solicitações ativas e reguladas.'
    ],
    actor: 'Coordenador de Regulação',
    screen: '/dashboard/importacao'
  },
  {
    step: 2,
    title: 'Fila Única & Classificação de Risco',
    subtitle: 'Organização inteligente por gravidade clínica',
    icon: Layers,
    color: 'border-indigo-500 bg-indigo-500/10 text-indigo-500',
    whatHappens: 'Os pacientes são organizados em fila transparente segundo o protocolo de Manchester/SUS.',
    howItWorks: [
      'Prioridade 1 (Vermelho): Casos mais graves / Emergenciais.',
      'Prioridade 2 (Amarelo): Casos urgentes que exigem rápida intervenção.',
      'Prioridade 3 (Verde) e 4 (Azul): Procedimentos eletivos gerais.',
      'Critérios de desempate legais: Idosos (Estatuto do Idoso) e tempo cronológico de espera.'
    ],
    actor: 'Operadores e Coordenadores',
    screen: '/dashboard/fila'
  },
  {
    step: 3,
    title: 'Convocação Ativa & Triagem Telefônica',
    subtitle: 'Localizando e confirmando os pacientes',
    icon: PhoneCall,
    color: 'border-cyan-500 bg-cyan-500/10 text-cyan-500',
    whatHappens: 'O operador liga e dispara WhatsApp oficial para os primeiros pacientes da fila.',
    howItWorks: [
      'Disparo de WhatsApp com 1 clique utilizando mensagens oficiais padronizadas.',
      'Registro obrigatório do resultado: Confirmou, Sem Resposta, Caixa Postal ou Desistência.',
      'Múltiplos telefones disponíveis para garantir que o paciente seja localizado.'
    ],
    actor: 'Operador de Convocação',
    screen: '/dashboard/fila'
  },
  {
    step: 4,
    title: 'Workflow de Segurança & Mudança de Risco',
    subtitle: 'Garantindo a lisura e evitando privilégios',
    icon: Shield,
    color: 'border-purple-500 bg-purple-500/10 text-purple-500',
    whatHappens: 'Se o paciente piorou ou apresentou novo laudo, a prioridade pode ser alterada apenas sob justificativa formal.',
    howItWorks: [
      'O operador abre um pedido de movimentação anexando o laudo e a justificativa.',
      'O médico auditor ou coordenador analisa na tela de Movimentações e aprova ou rejeita.',
      'Toda decisão é gravada em histórico imutável com data, hora, IP e responsável.'
    ],
    actor: 'Médico Auditor & Coordenador',
    screen: '/dashboard/movimentacoes'
  },
  {
    step: 5,
    title: 'Oferta de Agendas pelos Prestadores',
    subtitle: 'Hospitais disponibilizam as vagas',
    icon: Calendar,
    color: 'border-amber-500 bg-amber-500/10 text-amber-500',
    whatHappens: 'O Hospital Municipal (HMM), CCE ou CEI disponibilizam suas grades mensais de atendimento.',
    howItWorks: [
      'Cadastro de médico oficial, especialidade, data, horário e quantidade de vagas (ex: 15 vagas).',
      'Definição do tipo: Consulta Pré-Operatória, Cirurgia Eletiva ou Pequena Cirurgia.',
      'Visualização por Calendário Mensal, Semanal ou Diário.'
    ],
    actor: 'Hospital Prestador / Coordenação',
    screen: '/dashboard/agendas'
  },
  {
    step: 6,
    title: 'Alocação & Funil Cirúrgico (Kanban)',
    subtitle: 'A jornada do paciente do pré-op à alta',
    icon: GripVertical,
    color: 'border-emerald-500 bg-emerald-500/10 text-emerald-500',
    whatHappens: 'O operador aloca o paciente confirmado na agenda e acompanha sua evolução em um painel interativo.',
    howItWorks: [
      'Etapa 1: Consulta Pré-Op Agendada (Aguardando dia da consulta).',
      'Etapa 2: Consulta Realizada (Médico solicitou exames/risco cirúrgico).',
      'Etapa 3: Aguardando Data Cirurgia (Risco aprovado pelo cardiologista).',
      'Etapa 4: Cirurgia Agendada (Data do centro cirúrgico marcada).',
      'Etapa 5: Cirurgia Realizada com Sucesso.',
      'Movimentação dos cards por Arrastar e Soltar (Drag & Drop).'
    ],
    actor: 'Operadores e Hospital Executante',
    screen: '/dashboard/agendas'
  },
  {
    step: 7,
    title: 'Fechamento SISREG & Prestação de Contas',
    subtitle: 'Devolutiva oficial ao Ministério da Saúde',
    icon: CheckCircle2,
    color: 'border-rose-500 bg-rose-500/10 text-rose-500',
    whatHappens: 'Os procedimentos executados são consolidados e devolvidos ao sistema nacional.',
    howItWorks: [
      'Geração de relatório com todos os atendimentos e cirurgias realizadas no mês.',
      'Exportação para prestação de contas dos tetos financeiros e metas do SUS.',
      'Baixa definitiva da solicitação na fila com registro de sucesso.'
    ],
    actor: 'Coordenador Geral',
    screen: '/dashboard/agendas'
  }
]

export default function GuiaPage() {
  const [selectedRole, setSelectedRole] = useState<RoleKey>('OPERADOR')
  const [activeStep, setActiveStep] = useState<number>(1)

  const currentRole = ROLES[selectedRole]
  const currentStepData = FLOW_STEPS.find(s => s.step === activeStep) || FLOW_STEPS[0]

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary selection:text-primary-foreground">
      {/* ======================================================== */}
      {/* HEADER SUPERIOR COM NAVEGAÇÃO                            */}
      {/* ======================================================== */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-background/80 border-b border-border/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-2xl bg-gradient-to-tr from-primary to-emerald-500 text-white shadow-md">
              <HeartPulse className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-black tracking-tight text-foreground">SIS<span className="text-primary">FILASUS</span></span>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-primary/10 text-primary border border-primary/20">
                  Guia Interativo
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground font-semibold">Manual Oficial de Operação e Governança</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => window.print()}
              className="px-3 py-1.5 rounded-xl border border-border/40 bg-card hover:bg-muted text-foreground text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
              title="Imprimir ou Salvar PDF"
            >
              <Printer className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Imprimir Manual</span>
            </button>

            <Link
              href="/dashboard"
              className="px-4 py-1.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-bold transition-all shadow-md flex items-center gap-1.5"
            >
              <span>Acessar o Sistema</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-12">
        {/* ======================================================== */}
        {/* HERO BANNER & APRESENTAÇÃO                               */}
        {/* ======================================================== */}
        <section className="relative overflow-hidden rounded-3xl border border-border/50 bg-gradient-to-br from-primary/10 via-card to-background p-6 sm:p-10 shadow-xl">
          <div className="grid lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-7 space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold">
                <Sparkles className="h-3.5 w-3.5" />
                <span>Metodologia Oficial de Regulação Municipal de Marabá</span>
              </div>

              <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-foreground leading-tight">
                Como Funciona a Regulação Inteligente no <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-emerald-500">SisFilaSus</span>
              </h1>

              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                Este manual interativo foi elaborado para que todos os atores da saúde — <strong>operadores, médicos, coordenadores e hospitais</strong> — entendam com clareza o seu papel no fluxo contínuo desde a entrada do paciente na fila até a realização da cirurgia.
              </p>

              <div className="flex flex-wrap gap-4 pt-2">
                <div className="flex items-center gap-2 text-xs font-bold text-foreground/80 bg-background/60 backdrop-blur-sm px-3 py-2 rounded-2xl border border-border/40">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <span>Fila 100% Auditável</span>
                </div>
                <div className="flex items-center gap-2 text-xs font-bold text-foreground/80 bg-background/60 backdrop-blur-sm px-3 py-2 rounded-2xl border border-border/40">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <span>Sem Furos de Fila</span>
                </div>
                <div className="flex items-center gap-2 text-xs font-bold text-foreground/80 bg-background/60 backdrop-blur-sm px-3 py-2 rounded-2xl border border-border/40">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <span>Previsibilidade Cirúrgica</span>
                </div>
              </div>
            </div>

            <div className="lg:col-span-5">
              <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-border/40 group">
                <Image
                  src="/guia_banner.jpg"
                  alt="Infográfico do SisFilaSus"
                  width={800}
                  height={450}
                  className="w-full h-auto object-cover group-hover:scale-105 transition-transform duration-500"
                  priority
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent pointer-events-none" />
                <div className="absolute bottom-3 left-3 right-3 text-center">
                  <span className="text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full bg-background/90 text-foreground border border-border/40 shadow-sm backdrop-blur-sm">
                    Fluxo Integrado da Central de Regulação
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ======================================================== */}
        {/* SELETOR INTERATIVO DE ATORES ("QUEM É VOCÊ?")            */}
        {/* ======================================================== */}
        <section className="space-y-6">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <span className="text-xs font-black uppercase tracking-widest text-primary">Matriz de Responsabilidades</span>
            <h2 className="text-2xl font-black text-foreground">Qual é o seu papel no sistema?</h2>
            <p className="text-xs text-muted-foreground">Clique no seu perfil para entender suas tarefas diárias, ferramentas e regras de conduta.</p>
          </div>

          {/* Grid dos Botões de Perfis */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {(Object.keys(ROLES) as RoleKey[]).map((key) => {
              const r = ROLES[key]
              const isSelected = selectedRole === key
              const IconComp = r.icon

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedRole(key)}
                  className={`p-4 rounded-2xl border text-left transition-all duration-200 cursor-pointer flex flex-col justify-between space-y-3 relative overflow-hidden ${
                    isSelected
                      ? 'border-primary bg-primary/10 shadow-lg ring-2 ring-primary/30 scale-[1.02]'
                      : 'border-border/40 bg-card hover:border-primary/40 hover:bg-muted/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className={`p-2.5 rounded-xl bg-gradient-to-br ${r.color} text-white shadow-sm`}>
                      <IconComp className="h-5 w-5" />
                    </div>
                    {isSelected && (
                      <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-foreground uppercase tracking-tight">{r.title}</h3>
                    <p className="text-[10px] text-muted-foreground font-semibold mt-0.5 line-clamp-1">{r.badge}</p>
                  </div>
                </button>
              )
            })}
          </div>

          {/* Painel de Detalhes do Perfil Selecionado */}
          <div className="bento-card p-6 sm:p-8 space-y-6 border-l-4 border-l-primary animate-fadeIn">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/20">
              <div className="flex items-center gap-3">
                <div className={`p-3 rounded-2xl bg-gradient-to-br ${currentRole.color} text-white shadow-md`}>
                  {React.createElement(currentRole.icon, { className: 'h-6 w-6' })}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-black text-foreground uppercase">{currentRole.title}</h3>
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                      {currentRole.badge}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground font-medium">{currentRole.subtitle}</p>
                </div>
              </div>

              {/* Regra de Ouro */}
              <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 max-w-md">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[10px] font-black uppercase text-amber-600 dark:text-amber-400 block">Regra de Ouro</span>
                    <p className="text-xs text-foreground/90 font-medium leading-snug">{currentRole.goldenRule}</p>
                  </div>
                </div>
              </div>
            </div>

            <p className="text-sm text-foreground/80 leading-relaxed font-medium">{currentRole.description}</p>

            <div className="grid md:grid-cols-12 gap-6 pt-2">
              {/* Tarefas */}
              <div className="md:col-span-7 space-y-3">
                <h4 className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <span>Suas Principais Atividades Diárias:</span>
                </h4>
                <ul className="space-y-2">
                  {currentRole.tasks.map((task, i) => (
                    <li key={i} className="text-xs text-foreground flex items-start gap-2.5 bg-background/60 p-2.5 rounded-xl border border-border/30">
                      <span className="font-mono font-black text-primary text-[10px] px-1.5 py-0.5 bg-primary/10 rounded-md">
                        {i + 1}
                      </span>
                      <span className="leading-snug">{task}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Telas que este perfil usa */}
              <div className="md:col-span-5 space-y-3">
                <h4 className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <BookOpen className="h-4 w-4 text-primary" />
                  <span>Suas Telas de Trabalho no Sistema:</span>
                </h4>
                <div className="space-y-2">
                  {currentRole.mainScreens.map((s, i) => (
                    <Link
                      key={i}
                      href={s.url}
                      className="p-3 rounded-xl border border-border/40 bg-background/80 hover:border-primary/50 hover:bg-primary/5 transition-all flex items-center justify-between group cursor-pointer block"
                    >
                      <div>
                        <span className="text-xs font-black text-foreground uppercase group-hover:text-primary transition-colors block">
                          {s.name}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-medium">{s.desc}</span>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ======================================================== */}
        {/* O FLUXO COMPLETO EM 7 PASSOS (INFOGRÁFICO INTERATIVO)    */}
        {/* ======================================================== */}
        <section className="space-y-6">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <span className="text-xs font-black uppercase tracking-widest text-primary">Jornada do Paciente</span>
            <h2 className="text-2xl font-black text-foreground">O Fluxo Operacional Passo a Passo</h2>
            <p className="text-xs text-muted-foreground">Acompanhe as 7 etapas contínuas do SisFilaSus, desde a importação dos dados até o fechamento cirúrgico.</p>
          </div>

          {/* Stepper de Navegação */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            {FLOW_STEPS.map((s) => {
              const isActive = activeStep === s.step
              return (
                <button
                  key={s.step}
                  type="button"
                  onClick={() => setActiveStep(s.step)}
                  className={`px-4 py-2.5 rounded-2xl border text-xs font-black uppercase transition-all whitespace-nowrap flex items-center gap-2 cursor-pointer ${
                    isActive
                      ? 'border-primary bg-primary text-primary-foreground shadow-md scale-105'
                      : 'border-border/40 bg-card text-muted-foreground hover:text-foreground hover:bg-muted/40'
                  }`}
                >
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
                    isActive ? 'bg-white text-primary' : 'bg-muted text-muted-foreground'
                  }`}>
                    {s.step}
                  </span>
                  <span>{s.title}</span>
                </button>
              )
            })}
          </div>

          {/* Card Detalhado da Etapa Selecionada */}
          <div className="bento-card p-6 sm:p-8 space-y-6 border-t-4 border-t-primary">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/20">
              <div className="flex items-center gap-3.5">
                <div className={`p-3.5 rounded-2xl border ${currentStepData.color} shadow-sm`}>
                  {React.createElement(currentStepData.icon, { className: 'h-7 w-7' })}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono font-black uppercase tracking-widest px-2 py-0.5 rounded bg-primary/10 text-primary">
                      Etapa {currentStepData.step} de 7
                    </span>
                    <span className="text-[10px] text-muted-foreground font-bold">Responsável: {currentStepData.actor}</span>
                  </div>
                  <h3 className="text-xl font-black text-foreground uppercase mt-1">{currentStepData.title}</h3>
                  <p className="text-xs text-muted-foreground font-semibold">{currentStepData.subtitle}</p>
                </div>
              </div>

              <Link
                href={currentStepData.screen}
                className="px-4 py-2 rounded-xl bg-primary/10 hover:bg-primary text-primary hover:text-primary-foreground text-xs font-black uppercase transition-all flex items-center gap-2 self-start sm:self-auto"
              >
                <span>Ir para a Tela</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-card border border-border/40">
                <span className="text-[10px] font-black uppercase text-primary tracking-wider block mb-1">O que acontece aqui:</span>
                <p className="text-sm font-semibold text-foreground leading-relaxed">{currentStepData.whatHappens}</p>
              </div>

              <div className="space-y-2 pt-2">
                <span className="text-[10px] font-black uppercase text-muted-foreground tracking-wider block">Como funciona na prática:</span>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {currentStepData.howItWorks.map((detail, idx) => (
                    <div key={idx} className="p-3.5 rounded-2xl bg-background/80 border border-border/30 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-black flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <span className="text-[11px] font-bold text-foreground uppercase">Regra do Sistema</span>
                      </div>
                      <p className="text-xs text-muted-foreground font-medium leading-snug">{detail}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Navegação Entre Passos */}
            <div className="flex items-center justify-between pt-4 border-t border-border/20">
              <button
                type="button"
                disabled={activeStep === 1}
                onClick={() => setActiveStep(prev => Math.max(1, prev - 1))}
                className="px-4 py-2 rounded-xl border border-border/40 text-xs font-bold text-foreground disabled:opacity-30 hover:bg-muted transition-all cursor-pointer"
              >
                ← Etapa Anterior
              </button>

              <div className="flex items-center gap-1.5">
                {FLOW_STEPS.map(s => (
                  <span
                    key={s.step}
                    className={`h-2 rounded-full transition-all ${
                      activeStep === s.step ? 'w-6 bg-primary' : 'w-2 bg-muted'
                    }`}
                  />
                ))}
              </div>

              <button
                type="button"
                disabled={activeStep === 7}
                onClick={() => setActiveStep(prev => Math.min(7, prev + 1))}
                className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold disabled:opacity-30 hover:bg-primary/90 transition-all cursor-pointer"
              >
                Próxima Etapa →
              </button>
            </div>
          </div>
        </section>

        {/* ======================================================== */}
        {/* GLOSSÁRIO RÁPIDO DO SUS & REGULAÇÃO                      */}
        {/* ======================================================== */}
        <section className="bento-card p-6 sm:p-8 space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-border/20">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
              <HelpCircle className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-lg font-black text-foreground uppercase">Glossário Rápido de Termos do SUS</h3>
              <p className="text-xs text-muted-foreground font-medium">Entenda os termos mais utilizados no dia a dia da regulação</p>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-card border border-border/30 space-y-1">
              <span className="text-xs font-black text-primary uppercase">CNS (Cartão Nacional de Saúde)</span>
              <p className="text-xs text-muted-foreground leading-relaxed">Número de 15 dígitos que identifica unicamente o cidadão em todo o território nacional e evita prontuários duplicados.</p>
            </div>

            <div className="p-4 rounded-2xl bg-card border border-border/30 space-y-1">
              <span className="text-xs font-black text-primary uppercase">SISREG (Sistema de Regulação)</span>
              <p className="text-xs text-muted-foreground leading-relaxed">Sistema oficial do Ministério da Saúde onde as solicitações de consultas e cirurgias são registradas pelas UBSs.</p>
            </div>

            <div className="p-4 rounded-2xl bg-card border border-border/30 space-y-1">
              <span className="text-xs font-black text-primary uppercase">Tabela SIGTAP</span>
              <p className="text-xs text-muted-foreground leading-relaxed">Catálogo padronizado de procedimentos médicos e cirúrgicos do SUS, cada um com seu código oficial de 10 dígitos.</p>
            </div>

            <div className="p-4 rounded-2xl bg-card border border-border/30 space-y-1">
              <span className="text-xs font-black text-primary uppercase">Consulta Pré-Operatória (Pré-Op)</span>
              <p className="text-xs text-muted-foreground leading-relaxed">Consulta com o médico cirurgião para avaliar a necessidade cirúrgica e solicitar exames laboratoriais e cardiológicos.</p>
            </div>

            <div className="p-4 rounded-2xl bg-card border border-border/30 space-y-1">
              <span className="text-xs font-black text-primary uppercase">Absenteísmo</span>
              <p className="text-xs text-muted-foreground leading-relaxed">Falta do paciente à consulta ou cirurgia agendada. O SisFilaSus monitora e busca reduzir essa taxa com confirmação prévia via WhatsApp.</p>
            </div>

            <div className="p-4 rounded-2xl bg-card border border-border/30 space-y-1">
              <span className="text-xs font-black text-primary uppercase">NIR (Núcleo Interno de Regulação)</span>
              <p className="text-xs text-muted-foreground leading-relaxed">Setor dentro do hospital executante (HMM) responsável por gerenciar leitos cirúrgicos e confirmar os mapas cirúrgicos diários.</p>
            </div>
          </div>
        </section>

        {/* ======================================================== */}
        {/* CALL TO ACTION FINAL                                     */}
        {/* ======================================================== */}
        <section className="text-center p-8 rounded-3xl bg-gradient-to-r from-primary/20 via-primary/10 to-emerald-500/20 border border-primary/30 space-y-4">
          <h3 className="text-xl sm:text-2xl font-black text-foreground uppercase">Pronto para colocar em prática?</h3>
          <p className="text-xs sm:text-sm text-muted-foreground max-w-xl mx-auto">
            Acesse o painel com seu login institucional e comece a operar a regulação inteligente de Marabá.
          </p>
          <div className="pt-2 flex flex-wrap justify-center gap-3">
            <Link
              href="/dashboard/fila"
              className="px-6 py-2.5 rounded-2xl bg-primary text-primary-foreground text-xs font-black uppercase hover:bg-primary/90 transition-all shadow-lg flex items-center gap-2"
            >
              <span>Ir para a Fila de Espera</span>
              <ArrowRight className="h-4 w-4" />
            </Link>

            <Link
              href="/dashboard/agendas"
              className="px-6 py-2.5 rounded-2xl border border-border/40 bg-card hover:bg-muted text-foreground text-xs font-black uppercase transition-all shadow-sm"
            >
              <span>Ver Agendas & Kanban</span>
            </Link>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="border-t border-border/40 py-6 text-center text-xs text-muted-foreground">
        <p>SisFilaSus — Secretaria Municipal de Saúde (SMS) • Marabá/PA • {new Date().getFullYear()}</p>
      </footer>
    </div>
  )
}
