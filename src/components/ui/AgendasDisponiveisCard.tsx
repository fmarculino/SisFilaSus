'use client'

import React, { useState, useEffect } from 'react'
import { 
  Calendar, Clock, Hospital, UserCheck, CheckCircle2, 
  AlertCircle, Star, ArrowRight, Loader2, BookmarkCheck,
  Check, ChevronRight
} from 'lucide-react'
import { 
  fetchAgendasCompativeisAction, 
  agendarPacienteEmVagaAction, 
  marcarComoAptoAguardandoVagaAction,
  type AgendaCompativel 
} from '@/app/dashboard/fila/actions'
import { useSystemModal } from './SystemModal'

interface AgendasDisponiveisCardProps {
  solicitacao: any
  onAgendamentoConcluido: (novoStatus: string, agendaInfo?: any) => void
}

export function AgendasDisponiveisCard({
  solicitacao,
  onAgendamentoConcluido
}: AgendasDisponiveisCardProps) {
  const { showAlert, showConfirm } = useSystemModal()
  const [agendas, setAgendas] = useState<AgendaCompativel[]>([])
  const [loading, setLoading] = useState(true)
  const [agendandoId, setAgendandoId] = useState<string | null>(null)
  const [marcandoApto, setMarcandoApto] = useState(false)
  const [mostrarTodas, setMostrarTodas] = useState(false)

  const especialidade = solicitacao?.procedimentos?.grupo_descricao || ''
  const isApto = solicitacao?.status_interno === 'APTO_AGUARDANDO_VAGA'
  const isConfirmado = solicitacao?.status_interno === 'CONVOCADO_CONFIRMADO'

  // Carrega agendas compatíveis com a especialidade da solicitação
  const carregarAgendas = async () => {
    if (!solicitacao?.cod_solicitacao) return
    setLoading(true)
    try {
      const res = await fetchAgendasCompativeisAction({
        codSolicitacao: solicitacao.cod_solicitacao,
        especialidade: especialidade,
        codSigtap: solicitacao?.procedimentos?.cod_sigtap
      })
      if (res.success) {
        setAgendas(res.agendas || [])
      }
    } catch (err) {
      console.error('Erro ao carregar agendas compatíveis:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarAgendas()
  }, [solicitacao?.cod_solicitacao, especialidade])

  // Agendar paciente em uma vaga específica
  const handleAgendarVaga = async (agenda: AgendaCompativel) => {
    const dataFormatada = agenda.data_agenda ? new Date(`${agenda.data_agenda}T00:00:00`).toLocaleDateString('pt-BR') : agenda.data_agenda
    
    const confirmed = await showConfirm({
      title: 'Confirmar Agendamento de Vaga',
      message: `Deseja vincular ${solicitacao.pacientes?.nome_usuario} na agenda do Dr. ${agenda.medico_nome} para o dia ${dataFormatada} às ${agenda.horario_inicio}?`,
      confirmText: 'Confirmar Agendamento',
      variant: 'primary'
    })

    if (!confirmed) return

    setAgendandoId(agenda.id)
    try {
      const res = await agendarPacienteEmVagaAction({
        agendaId: agenda.id,
        codSolicitacao: solicitacao.cod_solicitacao,
        pacienteId: solicitacao.pacientes?.id,
        observacoes: `Agendado via Casamento Rápido na Fila de Espera (${solicitacao?.procedimentos?.desc_sigtap})`
      })

      if (!res.success) throw new Error('Falha ao registrar agendamento')

      await showAlert({
        title: 'Paciente Agendado com Sucesso!',
        message: `Vaga garantida para ${solicitacao.pacientes?.nome_usuario} no dia ${dataFormatada} (${agenda.medico_nome}). O status da solicitação foi atualizado para Confirmado.`,
        type: 'success'
      })

      onAgendamentoConcluido('CONVOCADO_CONFIRMADO', agenda)
      carregarAgendas()
    } catch (err: any) {
      await showAlert({
        title: 'Erro ao Agendar',
        message: err.message || 'Não foi possível concluir o agendamento da vaga.',
        type: 'error'
      })
    } finally {
      setAgendandoId(null)
    }
  }

  // Colocar paciente no Banco de Aptos (Aguardando Vagas)
  const handleColocarNoBancoDeAptos = async () => {
    const confirmed = await showConfirm({
      title: 'Colocar no Banco de Aptos',
      message: `O paciente ${solicitacao.pacientes?.nome_usuario} confirmou interesse e ficará pré-selecionado como APTO. Assim que surgir uma cota de agenda para ${especialidade || 'este procedimento'}, o sistema alertará para convocação prioritária. Confirmar?`,
      confirmText: 'Mover para Banco de Aptos',
      variant: 'primary'
    })

    if (!confirmed) return

    setMarcandoApto(true)
    try {
      const res = await marcarComoAptoAguardandoVagaAction({
        codSolicitacao: solicitacao.cod_solicitacao,
        observacoes: `Paciente confirmou que está apto e aguardando abertura de vagas para ${especialidade || 'o procedimento'}.`
      })

      if (!res.success) throw new Error('Falha ao atualizar status')

      await showAlert({
        title: 'Paciente no Banco de Aptos!',
        message: 'O paciente foi pré-selecionado com sucesso e possui prioridade máxima assim que novas vagas forem ofertadas.',
        type: 'success'
      })

      onAgendamentoConcluido('APTO_AGUARDANDO_VAGA')
    } catch (err: any) {
      await showAlert({
        title: 'Erro ao Atualizar',
        message: err.message || 'Falha ao colocar paciente no banco de aptos.',
        type: 'error'
      })
    } finally {
      setMarcandoApto(false)
    }
  }

  const agendasComVagas = agendas.filter(a => a.vagas_restantes > 0)
  const agendasParaExibir = mostrarTodas ? agendasComVagas : agendasComVagas.slice(0, 3)

  return (
    <div className="bento-card p-6 border-primary/20 bg-primary/[0.02] space-y-5 rounded-3xl relative overflow-hidden">
      {/* Header do Módulo */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-primary/10 text-primary">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-primary">
              Oferta & Casamento de Agendas
            </span>
            <h4 className="text-sm font-bold text-foreground">
              {especialidade ? `Agendas para ${especialidade}` : 'Agendas Disponíveis'}
            </h4>
          </div>
        </div>

        {/* Badge do Status Atual de Aptidão */}
        {isApto && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/25 text-[10px] font-black uppercase tracking-wider">
            <BookmarkCheck className="w-3.5 h-3.5" />
            <span>Banco de Aptos</span>
          </span>
        )}

        {isConfirmado && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 text-[10px] font-black uppercase tracking-wider">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Agendado / Confirmado</span>
          </span>
        )}
      </div>

      {/* Conteúdo Principal */}
      {loading ? (
        <div className="py-8 flex flex-col items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
          <span className="text-xs font-semibold">Cruzando especialidade com vagas abertas dos prestadores...</span>
        </div>
      ) : agendasComVagas.length > 0 ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">
              {agendasComVagas.length} {agendasComVagas.length === 1 ? 'agenda aberta' : 'agendas abertas'} com cotas livres:
            </span>
            {agendasComVagas.length > 3 && (
              <button
                type="button"
                onClick={() => setMostrarTodas(!mostrarTodas)}
                className="text-primary hover:underline text-[11px] font-bold cursor-pointer"
              >
                {mostrarTodas ? 'Ver menos' : `Ver todas (+${agendasComVagas.length - 3})`}
              </button>
            )}
          </div>

          {/* Lista de Cards de Agendas */}
          <div className="grid gap-2.5">
            {agendasParaExibir.map((agenda) => {
              const dataFormatada = agenda.data_agenda 
                ? new Date(`${agenda.data_agenda}T00:00:00`).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' }) 
                : agenda.data_agenda

              const isSavingThis = agendandoId === agenda.id

              return (
                <div
                  key={agenda.id}
                  className="p-3.5 rounded-2xl border border-border/60 bg-card/70 hover:border-primary/40 hover:bg-card transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-xs text-foreground capitalize">
                        {dataFormatada}
                      </span>
                      <span className="text-[10px] text-muted-foreground font-mono bg-muted/50 px-2 py-0.5 rounded-md">
                        {agenda.horario_inicio}
                      </span>
                      <span className="px-2 py-0.5 text-[9px] font-black uppercase rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        {agenda.vagas_restantes} {agenda.vagas_restantes === 1 ? 'vaga livre' : 'vagas livres'}
                      </span>
                    </div>

                    <div className="text-xs text-muted-foreground flex items-center gap-2 truncate">
                      <span className="font-bold text-foreground truncate">
                        Dr(a). {agenda.medico_nome}
                      </span>
                      {agenda.hospital?.nome && (
                        <>
                          <span className="text-border">•</span>
                          <span className="truncate">{agenda.hospital.nome}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={isSavingThis || isConfirmado}
                    onClick={() => handleAgendarVaga(agenda)}
                    className="shrink-0 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-wider hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSavingThis ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Agendando...</span>
                      </>
                    ) : (
                      <>
                        <span>Agendar nesta Vaga</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        /* Sem Agendas Abertas no Momento: Opção de Banco de Aptos */
        <div className="p-4 rounded-2xl bg-muted/30 border border-border/50 space-y-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-xs font-bold text-foreground">
                Nenhuma cota de agenda com vagas disponíveis para {especialidade || 'este procedimento'}.
              </p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Se você já contatou o paciente e ele confirmou que tem interesse e está apto, coloque-o no <strong>Banco de Aptos</strong>. Ele ficará pré-selecionado e terá prioridade de convocação assim que uma nova agenda for ofertada.
              </p>
            </div>
          </div>

          {!isApto && (
            <div className="flex justify-end pt-1">
              <button
                type="button"
                disabled={marcandoApto}
                onClick={handleColocarNoBancoDeAptos}
                className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-[10px] font-black uppercase tracking-wider shadow-md shadow-teal-600/20 active:scale-[0.98] transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
              >
                {marcandoApto ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Salvando no Banco de Aptos...</span>
                  </>
                ) : (
                  <>
                    <Star className="w-3.5 h-3.5 fill-white" />
                    <span>Colocar no Banco de Aptos (Aguardando Vagas)</span>
                  </>
                )}
              </button>
            </div>
          )}

          {isApto && (
            <div className="p-2.5 rounded-xl bg-teal-500/10 border border-teal-500/20 text-[11px] text-teal-700 dark:text-teal-300 font-semibold flex items-center gap-2">
              <Check className="w-4 h-4 text-teal-500" />
              <span>Paciente já cadastrado no Banco de Aptos! Aguardando surgimento de vagas.</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
