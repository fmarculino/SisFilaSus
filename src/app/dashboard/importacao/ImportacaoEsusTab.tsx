import React, { useState, useRef, useEffect } from 'react'
import { 
  FolderUp, Upload, CheckCircle2, AlertCircle, RefreshCw, 
  FileText, ShieldCheck, Users, PhoneCall, MapPin, Database, ChevronRight, X,
  Server, Zap, Clock, PlayCircle, Download, Check, HelpCircle, Activity, Info
} from 'lucide-react'
import { 
  solicitarPreviaEsusAction,
  solicitarSincronizacaoEsusAction, 
  obterUltimoJobSincronizacaoAction, 
  verificarAgenteOnlineAction,
  cancelarJobSincronizacaoAction, 
  EsusSyncJob 
} from './esus-sync-actions'

interface FileItem {
  id: string
  file: File
  name: string
  size: string
  status: 'PENDENTE' | 'PROCESSANDO' | 'SUCESSO' | 'ERRO'
  stats?: {
    totalLidoArquivo: number
    totalCidadaosValidos: number
    totalSalvoEsusBase: number
    totalPacientesSisFilaEncontrados: number
    totalTelefonesAdicionados: number
    totalEnderecosAtualizados: number
    unidadeNome: string | null
  }
  error?: string
}

interface AccumulatedTotals {
  arquivosConcluidos: number
  totalSalvoEsus: number
  totalPacientesEnriquecidos: number
  totalTelefonesAdicionados: number
  totalEnderecosAtualizados: number
}

export function ImportacaoEsusTab() {
  const [queue, setQueue] = useState<FileItem[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [currentProcessingIndex, setCurrentProcessingIndex] = useState<number | null>(null)
  const [totals, setTotals] = useState<AccumulatedTotals>({
    arquivosConcluidos: 0,
    totalSalvoEsus: 0,
    totalPacientesEnriquecidos: 0,
    totalTelefonesAdicionados: 0,
    totalEnderecosAtualizados: 0
  })

  // Estados da Sincronização Direta com o e-SUS PEC (Agente Local)
  const [syncJob, setSyncJob] = useState<EsusSyncJob | null>(null)
  const [isSubmittingSync, setIsSubmittingSync] = useState(false)
  const [syncPeriod, setSyncPeriod] = useState<'7' | '15' | '30' | '60' | '90' | 'custom' | 'all'>('30')
  const [customDays, setCustomDays] = useState<number>(45)
  const [syncMsg, setSyncMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null)

  // Estados de Prévia
  const [previewJob, setPreviewJob] = useState<EsusSyncJob | null>(null)
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)

  // Status do Agente no Servidor
  const [isAgentOnline, setIsAgentOnline] = useState<boolean>(false)
  const [agentIdentifier, setAgentIdentifier] = useState<string>('')

  // 1. Checar status do Agente Local periodicamente
  useEffect(() => {
    const checkAgent = async () => {
      const res = await verificarAgenteOnlineAction()
      if (res.success) {
        setIsAgentOnline(res.status.online)
        if (res.status.identificador) setAgentIdentifier(res.status.identificador)
      }
    }
    checkAgent()
    const agentInterval = setInterval(checkAgent, 15000)
    return () => clearInterval(agentInterval)
  }, [])

  // 2. Carregar status do último job e fazer polling dinâmico
  useEffect(() => {
    let timer: NodeJS.Timeout

    const fetchLatestJob = async () => {
      const res = await obterUltimoJobSincronizacaoAction('SINCRONIZACAO')
      if (res.success && res.job) {
        setSyncJob(res.job)
      }
    }

    fetchLatestJob()

    if (syncJob?.status === 'PENDENTE' || syncJob?.status === 'PROCESSANDO') {
      timer = setInterval(fetchLatestJob, 2500)
    }

    return () => {
      if (timer) clearInterval(timer)
    }
  }, [syncJob?.status])

  // 3. Polling de Prévia (quando solicitada)
  useEffect(() => {
    if (!isLoadingPreview || !previewJob?.id) return

    const checkPreview = async () => {
      const res = await obterUltimoJobSincronizacaoAction('PREVIA')
      if (res.success && res.job && res.job.id === previewJob.id) {
        if (res.job.status === 'CONCLUIDO' || res.job.status === 'ERRO') {
          setPreviewJob(res.job)
          setIsLoadingPreview(false)
          if (res.job.status === 'ERRO') {
            setSyncMsg({ type: 'error', text: res.job.mensagem_erro || 'Falha ao consultar prévia.' })
          }
        }
      }
    }

    const interval = setInterval(checkPreview, 1500)
    return () => clearInterval(interval)
  }, [isLoadingPreview, previewJob?.id])

  const getEffectiveDays = () => {
    if (syncPeriod === 'all') return undefined
    if (syncPeriod === 'custom') return customDays > 0 ? customDays : 30
    return parseInt(syncPeriod, 10)
  }

  // Ação de solicitar Prévia (Contagem e Tempo Estimado)
  const handleSolicitarPrevia = async () => {
    setIsLoadingPreview(true)
    setSyncMsg(null)
    setPreviewJob(null)

    const isAll = syncPeriod === 'all'
    const days = getEffectiveDays()

    try {
      const res = await solicitarPreviaEsusAction(days, isAll)
      if (res.success && res.job) {
        setPreviewJob(res.job)
      } else {
        setIsLoadingPreview(false)
        setSyncMsg({ type: 'error', text: res.error || 'Erro ao solicitar prévia.' })
      }
    } catch (err: any) {
      setIsLoadingPreview(false)
      setSyncMsg({ type: 'error', text: err.message })
    }
  }

  // Ação de Iniciar a Sincronização (Com ou sem prévia)
  const handleConfirmarSincronizacao = async () => {
    setIsSubmittingSync(true)
    setSyncMsg(null)

    const isAll = syncPeriod === 'all'
    const days = getEffectiveDays()
    const totalEstimado = previewJob?.total_estimado || 0

    try {
      const res = await solicitarSincronizacaoEsusAction(days, isAll, totalEstimado)
      if (res.success && res.job) {
        setSyncJob(res.job)
        setPreviewJob(null) // Fecha card de prévia
        setSyncMsg({ 
          type: 'info', 
          text: 'Sincronização iniciada! Acompanhe o progresso em tempo real abaixo.' 
        })
      } else {
        setSyncMsg({ type: 'error', text: res.error || 'Erro ao iniciar sincronização.' })
      }
    } catch (err: any) {
      setSyncMsg({ type: 'error', text: err.message })
    } finally {
      setIsSubmittingSync(false)
    }
  }

  const handleCancelarSync = async (jobId: string) => {
    await cancelarJobSincronizacaoAction(jobId)
    const res = await obterUltimoJobSincronizacaoAction('SINCRONIZACAO')
    if (res.success && res.job) setSyncJob(res.job)
  }

  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
  }

  const handleAddFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return

    const newItems: FileItem[] = []
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i]
      if (file.name.toLowerCase().endsWith('.csv')) {
        newItems.push({
          id: `${file.name}-${file.size}-${Date.now()}-${i}`,
          file,
          name: file.name,
          size: formatFileSize(file.size),
          status: 'PENDENTE'
        })
      }
    }

    if (newItems.length > 0) {
      setQueue(prev => [...prev, ...newItems])
    }
  }

  const handleRemoveItem = (id: string) => {
    if (isProcessing) return
    setQueue(prev => prev.filter(item => item.id !== id))
  }

  const handleClearQueue = () => {
    if (isProcessing) return
    setQueue([])
    setTotals({
      arquivosConcluidos: 0,
      totalSalvoEsus: 0,
      totalPacientesEnriquecidos: 0,
      totalTelefonesAdicionados: 0,
      totalEnderecosAtualizados: 0
    })
  }

  // Leitura com decodificação ISO-8859-1 (Latin1) ou UTF-8
  const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(reader.error)
      reader.readAsText(file, 'ISO-8859-1')
    })
  }

  const startBatchProcess = async () => {
    if (queue.length === 0 || isProcessing) return

    setIsProcessing(true)
    const currentQueue = [...queue]

    for (let i = 0; i < currentQueue.length; i++) {
      const item = currentQueue[i]
      if (item.status === 'SUCESSO') continue // Pular já concluídos com sucesso

      setCurrentProcessingIndex(i)

      // Atualizar status para PROCESSANDO
      setQueue(prev => prev.map((q, idx) => idx === i ? { ...q, status: 'PROCESSANDO' } : q))

      try {
        const fileContent = await readFileAsText(item.file)

        const res = await fetch('/api/importar/esus', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileContent,
            fileName: item.name
          })
        })

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}))
          throw new Error(errData?.error || `Erro ${res.status}: ${res.statusText}`)
        }

        const data = await res.json()

        // Atualizar item com sucesso
        setQueue(prev => prev.map((q, idx) => idx === i ? {
          ...q,
          status: 'SUCESSO',
          stats: {
            totalLidoArquivo: data.totalLidoArquivo,
            totalCidadaosValidos: data.totalCidadaosValidos,
            totalSalvoEsusBase: data.totalSalvoEsusBase,
            totalPacientesSisFilaEncontrados: data.totalPacientesSisFilaEncontrados,
            totalTelefonesAdicionados: data.totalTelefonesAdicionados,
            totalEnderecosAtualizados: data.totalEnderecosAtualizados,
            unidadeNome: data.unidadeNome
          }
        } : q))

        // Acumular totais
        setTotals(prev => ({
          arquivosConcluidos: prev.arquivosConcluidos + 1,
          totalSalvoEsus: prev.totalSalvoEsus + (data.totalSalvoEsusBase || 0),
          totalPacientesEnriquecidos: prev.totalPacientesEnriquecidos + (data.totalPacientesSisFilaEncontrados || 0),
          totalTelefonesAdicionados: prev.totalTelefonesAdicionados + (data.totalTelefonesAdicionados || 0),
          totalEnderecosAtualizados: prev.totalEnderecosAtualizados + (data.totalEnderecosAtualizados || 0)
        }))

      } catch (err: any) {
        setQueue(prev => prev.map((q, idx) => idx === i ? {
          ...q,
          status: 'ERRO',
          error: err.message || 'Falha ao processar arquivo.'
        } : q))
      }
    }

    setIsProcessing(false)
    setCurrentProcessingIndex(null)
  }

  return (
    <div className="space-y-6">
      {/* Banner Explicativo de Regras */}
      <div className="bento-card p-6 bg-card/60 border border-emerald-500/25">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div className="space-y-2">
            <h3 className="text-base font-bold text-foreground">
              Atualização Cadastral e-SUS (Atenção Primária)
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Esta ferramenta processa os relatórios de <em>Acompanhamento de Cidadãos Vinculados</em> do e-SUS. 
              Alimenta o banco territorial municipal e atualiza automaticamente os pacientes do <strong>SisFilaSUS</strong> com 
              endereços, telefones sem duplicação, UBS de referência, Equipe e Microárea do ACS.
            </p>
            <div className="inline-flex items-center gap-2 mt-1 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-800 dark:text-emerald-300 font-semibold">
              <span>🛡️ <strong>Regra Estrita:</strong> Nenhum novo paciente é inserido na fila regulada. Cidadãos não presentes na regulação são armazenados exclusivamente na base territorial para enriquecimentos futuros.</span>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* CARD DE SINCRONIZAÇÃO DIRETA COM BANCO e-SUS PEC (AGENTE LOCAL 24X7)     */}
      {/* ========================================================================= */}
      <div className="bento-card p-6 border border-primary/20 bg-gradient-to-br from-primary/[0.04] via-background/60 to-emerald-500/[0.04] rounded-3xl relative overflow-hidden shadow-sm space-y-6">
        
        {/* Cabeçalho do Card com Status do Agente e Download */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-border/50">
          <div className="flex items-start gap-4">
            <div className="p-3.5 rounded-2xl bg-primary/10 text-primary shrink-0 shadow-sm">
              <Server className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h4 className="text-base font-bold text-foreground">
                  Sincronização Direta do Banco e-SUS PEC
                </h4>
                
                {/* Badge de Status do Agente no Servidor */}
                {isAgentOnline ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    Agente Online no Servidor {agentIdentifier ? `(${agentIdentifier})` : ''}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border/60">
                    <span className="w-2 h-2 rounded-full bg-muted-foreground/50"></span>
                    Agente Desconectado
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1 max-w-2xl leading-relaxed">
                Puxa cadastros, endereços e telefones atualizados direto do PostgreSQL do e-SUS PEC via <strong>Agente Windows 24x7</strong>.
              </p>
            </div>
          </div>

          {/* Botão de Download do Agente */}
          <div className="flex items-center gap-2 shrink-0">
            <a
              href="/downloads/SisFilaSusAgent.zip"
              download="SisFilaSusAgent.zip"
              className="btn btn-outline border-border/80 hover:bg-muted/50 px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 text-foreground transition-all shadow-sm"
              title="Baixar executável do Agente para rodar no servidor do e-SUS"
            >
              <Download className="w-3.5 h-3.5 text-primary" />
              Baixar Agente Windows (.zip)
            </a>
          </div>
        </div>

        {/* Linha de Configuração do Período e Ações */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-primary" />
              Período de Atualização:
            </label>
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={syncPeriod}
                onChange={(e) => {
                  setSyncPeriod(e.target.value as any)
                  setPreviewJob(null) // Reseta prévia ao trocar
                }}
                disabled={isSubmittingSync || syncJob?.status === 'PENDENTE' || syncJob?.status === 'PROCESSANDO'}
                className="text-xs bg-background/80 border border-border/80 rounded-xl px-3.5 py-2 font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-sm"
              >
                <option value="7">Últimos 7 dias (Mais Rápido)</option>
                <option value="15">Últimos 15 dias</option>
                <option value="30">Últimos 30 dias (Recomendado)</option>
                <option value="60">Últimos 60 dias</option>
                <option value="90">Últimos 90 dias</option>
                <option value="custom">Personalizado (dias)...</option>
                <option value="all">Base Completa (Todos os 57.000+)</option>
              </select>

              {syncPeriod === 'custom' && (
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min="1"
                    max="365"
                    value={customDays}
                    onChange={(e) => {
                      setCustomDays(parseInt(e.target.value, 10) || 1)
                      setPreviewJob(null)
                    }}
                    className="w-20 text-xs bg-background border border-border/80 rounded-xl px-2.5 py-2 text-foreground font-semibold"
                  />
                  <span className="text-xs text-muted-foreground font-medium">dias</span>
                </div>
              )}
            </div>
          </div>

          {/* Botões de Ação */}
          <div className="flex items-center gap-2.5">
            {/* Botão de Prévia (Estimativa) */}
            <button
              onClick={handleSolicitarPrevia}
              disabled={isLoadingPreview || isSubmittingSync || syncJob?.status === 'PROCESSANDO'}
              className="btn btn-outline border-primary/30 hover:bg-primary/5 text-primary px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all"
            >
              {isLoadingPreview ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Calculando Prévia...
                </>
              ) : (
                <>
                  <Activity className="w-3.5 h-3.5" />
                  Calcular Prévia
                </>
              )}
            </button>

            {/* Botão de Início Direto */}
            <button
              onClick={handleConfirmarSincronizacao}
              disabled={isSubmittingSync || syncJob?.status === 'PENDENTE' || syncJob?.status === 'PROCESSANDO'}
              className="btn btn-primary px-5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm shadow-primary/20 hover:shadow-md hover:shadow-primary/30 active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none"
            >
              {isSubmittingSync ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Iniciando...
                </>
              ) : syncJob?.status === 'PROCESSANDO' ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Processando...
                </>
              ) : syncJob?.status === 'PENDENTE' ? (
                <>
                  <Clock className="w-3.5 h-3.5" />
                  Na Fila do Agente...
                </>
              ) : (
                <>
                  <Zap className="w-3.5 h-3.5 text-amber-300" />
                  Iniciar Sincronização
                </>
              )}
            </button>
          </div>
        </div>

        {/* Card de PRÉVIA / ESTIMATIVA (Antes de iniciar) */}
        {previewJob && previewJob.status === 'CONCLUIDO' && (
          <div className="p-4 rounded-2xl bg-primary/5 border border-primary/20 flex flex-col md:flex-row md:items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-primary shrink-0" />
                <span className="text-xs font-bold text-foreground">
                  Prévia da Sincronização Encontrada:
                </span>
              </div>
              <p className="text-xs text-muted-foreground pl-6">
                Existem <strong className="text-foreground">{previewJob.total_estimado?.toLocaleString('pt-BR')} cidadãos</strong> com 
                atualizações no período selecionado ({syncPeriod === 'all' ? 'Base Completa' : `Últimos ${getEffectiveDays()} dias`}). 
                Tempo estimado: <strong className="text-foreground">~{previewJob.tempo_estimado_segundos} segundos</strong>.
              </p>
            </div>
            <div className="flex items-center gap-2 pl-6 md:pl-0 shrink-0">
              <button
                onClick={handleConfirmarSincronizacao}
                disabled={isSubmittingSync}
                className="btn btn-primary px-4 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm"
              >
                <PlayCircle className="w-3.5 h-3.5" />
                Confirmar e Iniciar
              </button>
              <button
                onClick={() => setPreviewJob(null)}
                className="btn btn-ghost px-3 py-1.5 rounded-xl text-xs text-muted-foreground hover:text-foreground"
              >
                Fechar
              </button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* BARRA DE PROGRESSO EM TEMPO REAL ANTI-TRAVAMENTO                          */}
        {/* ========================================================================= */}
        {syncJob && (syncJob.status === 'PROCESSANDO' || syncJob.status === 'PENDENTE') && (
          <div className="p-4 rounded-2xl bg-card/80 border border-primary/30 shadow-sm space-y-3 animate-in fade-in duration-300">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 font-semibold text-foreground">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-primary" />
                <span>{syncJob.mensagem_status || 'Processando sincronização com o e-SUS...'}</span>
              </div>
              <span className="font-bold text-primary text-sm">
                {syncJob.progresso_pct || 0}%
              </span>
            </div>

            {/* Barra Visual com Gradiente */}
            <div className="w-full h-3 bg-muted/60 rounded-full overflow-hidden p-0.5 border border-border/40">
              <div 
                className="h-full bg-gradient-to-r from-primary via-emerald-500 to-primary rounded-full transition-all duration-500 ease-out shadow-sm"
                style={{ width: `${Math.max(4, syncJob.progresso_pct || 0)}%` }}
              />
            </div>

            {/* Métricas ao Vivo durante o processamento */}
            <div className="flex items-center justify-between flex-wrap gap-2 text-[11px] text-muted-foreground pt-1">
              <span>
                Processados: <strong className="text-foreground">{(syncJob.total_processado || syncJob.stats?.totalLidos || 0).toLocaleString('pt-BR')}</strong> de <strong className="text-foreground">{(syncJob.total_estimado || 0).toLocaleString('pt-BR')}</strong>
              </span>

              {syncJob.stats && (
                <div className="flex items-center gap-3">
                  <span>🎯 SisFila: <strong className="text-emerald-600 dark:text-emerald-400">+{syncJob.stats.totalPacientesEnriquecidos || 0}</strong></span>
                  <span>📞 Telefones: <strong className="text-primary">+{syncJob.stats.totalTelefonesAdicionados || 0}</strong></span>
                  <span>📍 Endereços: <strong className="text-foreground">+{syncJob.stats.totalEnderecosAtualizados || 0}</strong></span>
                </div>
              )}

              <div className="flex items-center gap-2">
                {syncJob.tempo_decorrido_segundos !== undefined && (
                  <span>Decorrido: <strong className="text-foreground">{syncJob.tempo_decorrido_segundos}s</strong></span>
                )}
                {syncJob.status === 'PENDENTE' && (
                  <button
                    onClick={() => handleCancelarSync(syncJob.id)}
                    className="text-destructive hover:underline font-semibold ml-2"
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Mensagem de Feedback */}
        {syncMsg && (
          <div className={`p-3 rounded-2xl text-xs font-medium flex items-center gap-2.5 ${
            syncMsg.type === 'success' 
              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20' 
              : syncMsg.type === 'info'
              ? 'bg-primary/10 text-primary border border-primary/20'
              : 'bg-destructive/10 text-destructive border border-destructive/20'
          }`}>
            {syncMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            <span>{syncMsg.text}</span>
          </div>
        )}

        {/* Resumo da Última Execução Concluída */}
        {syncJob && syncJob.status === 'CONCLUIDO' && (
          <div className="pt-3 border-t border-border/50 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold">
                <CheckCircle2 className="w-4 h-4" /> Concluído:
              </span>
              <span>{syncJob.mensagem_status}</span>
            </div>

            {syncJob.stats && syncJob.stats.totalLidos !== undefined && (
              <div className="flex items-center gap-4 flex-wrap text-muted-foreground">
                <span>Lidos: <strong className="text-foreground">{syncJob.stats.totalLidos.toLocaleString('pt-BR')}</strong></span>
                <span>Enriquecidos: <strong className="text-emerald-600 dark:text-emerald-400">+{syncJob.stats.totalPacientesEnriquecidos || 0}</strong></span>
                <span>Telefones: <strong className="text-primary">+{syncJob.stats.totalTelefonesAdicionados || 0}</strong></span>
                <span>Endereços: <strong className="text-foreground">+{syncJob.stats.totalEnderecosAtualizados || 0}</strong></span>
                {syncJob.stats.tempoDecorrido && <span>Tempo: <strong className="text-foreground">{syncJob.stats.tempoDecorrido}</strong></span>}
              </div>
            )}
          </div>
        )}

      </div>

      {/* Divisor Visual */}
      <div className="relative flex py-2 items-center">
        <div className="flex-grow border-t border-border/60"></div>
        <span className="flex-shrink mx-4 text-xs font-semibold text-muted-foreground tracking-wider uppercase">
          Ou importe arquivos CSV manualmente
        </span>
        <div className="flex-grow border-t border-border/60"></div>
      </div>

      {/* Seletor de Arquivos e Pastas no padrão clean do SisFilaSUS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Opção 1: Selecionar Pasta Completa */}
        <div 
          onClick={() => !isProcessing && folderInputRef.current?.click()}
          className={`bento-card p-8 group relative flex flex-col items-center justify-center border-2 border-dashed border-border/60 hover:border-emerald-500/50 rounded-3xl bg-background/40 hover:bg-emerald-500/[0.03] transition-all duration-300 cursor-pointer text-center ${isProcessing ? 'opacity-50 pointer-events-none' : ''}`}
        >
          <input 
            type="file" 
            ref={folderInputRef}
            // @ts-ignore
            webkitdirectory="true"
            directory="true"
            multiple
            className="hidden"
            onChange={(e) => handleAddFiles(e.target.files)}
          />
          <div className="p-4 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform mb-3 shadow-sm">
            <FolderUp className="w-8 h-8" />
          </div>
          <span className="text-sm font-bold text-foreground group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
            Selecionar Pasta Completa
          </span>
          <span className="text-xs text-muted-foreground mt-1">
            Carrega todos os arquivos CSV de uma pasta de uma só vez
          </span>
        </div>

        {/* Opção 2: Seleção Múltipla / Arraste */}
        <div 
          onClick={() => !isProcessing && fileInputRef.current?.click()}
          className={`bento-card p-8 group relative flex flex-col items-center justify-center border-2 border-dashed border-border/60 hover:border-primary/50 rounded-3xl bg-background/40 hover:bg-primary/[0.03] transition-all duration-300 cursor-pointer text-center ${isProcessing ? 'opacity-50 pointer-events-none' : ''}`}
        >
          <input 
            type="file" 
            ref={fileInputRef}
            multiple
            accept=".csv"
            className="hidden"
            onChange={(e) => handleAddFiles(e.target.files)}
          />
          <div className="p-4 rounded-2xl bg-primary/10 text-primary group-hover:scale-110 transition-transform mb-3 shadow-sm">
            <Upload className="w-8 h-8" />
          </div>
          <span className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
            Selecionar Arquivos Múltiplos
          </span>
          <span className="text-xs text-muted-foreground mt-1">
            Escolha um ou vários arquivos CSV com Ctrl+A ou arraste aqui
          </span>
        </div>
      </div>

      {/* Painel de Métricas Acumuladas */}
      {(totals.arquivosConcluidos > 0 || isProcessing) && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bento-card p-5 bg-card/70 border border-border/50">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold">
              <Database className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Base Territorial e-SUS</span>
            </div>
            <p className="text-2xl font-black text-foreground mt-2">
              {totals.totalSalvoEsus.toLocaleString('pt-BR')}
            </p>
            <span className="text-[10px] text-muted-foreground font-medium">cidadãos salvos/atualizados</span>
          </div>

          <div className="bento-card p-5 bg-card/70 border border-border/50">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold">
              <Users className="w-4 h-4 text-primary" />
              <span>Pacientes SisFilaSUS</span>
            </div>
            <p className="text-2xl font-black text-foreground mt-2">
              {totals.totalPacientesEnriquecidos.toLocaleString('pt-BR')}
            </p>
            <span className="text-[10px] text-muted-foreground font-medium">encontrados na regulação</span>
          </div>

          <div className="bento-card p-5 bg-card/70 border border-border/50">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold">
              <PhoneCall className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              <span>Novos Telefones</span>
            </div>
            <p className="text-2xl font-black text-foreground mt-2">
              {totals.totalTelefonesAdicionados.toLocaleString('pt-BR')}
            </p>
            <span className="text-[10px] text-muted-foreground font-medium">inseridos sem duplicação</span>
          </div>

          <div className="bento-card p-5 bg-card/70 border border-border/50">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold">
              <MapPin className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span>Endereços Atualizados</span>
            </div>
            <p className="text-2xl font-black text-foreground mt-2">
              {totals.totalEnderecosAtualizados.toLocaleString('pt-BR')}
            </p>
            <span className="text-[10px] text-muted-foreground font-medium">com dados territoriais</span>
          </div>
        </div>
      )}

      {/* Fila de Arquivos */}
      {queue.length > 0 && (
        <div className="bento-card overflow-hidden border border-border/60">
          <div className="p-4 sm:p-5 border-b border-border/40 bg-muted/20 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-foreground">
                  Fila de Arquivos para Processamento ({queue.length})
                </h4>
                <span className="text-xs text-muted-foreground">
                  {totals.arquivosConcluidos} de {queue.length} concluídos
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {!isProcessing && (
                <button
                  type="button"
                  onClick={handleClearQueue}
                  className="px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/80 rounded-xl transition-colors"
                >
                  Limpar Lista
                </button>
              )}
              <button
                type="button"
                disabled={isProcessing || queue.every(q => q.status === 'SUCESSO')}
                onClick={startBatchProcess}
                className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:pointer-events-none rounded-xl shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Processando {(currentProcessingIndex || 0) + 1} de {queue.length}...</span>
                  </>
                ) : (
                  <>
                    <span>Iniciar Processamento do Lote</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="divide-y divide-border/30 max-h-96 overflow-y-auto">
            {queue.map((item, idx) => (
              <div 
                key={item.id} 
                className={`p-4 flex items-center justify-between gap-4 transition-colors ${
                  item.status === 'PROCESSANDO' ? 'bg-emerald-500/5' : 'hover:bg-muted/30'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="shrink-0">
                    {item.status === 'SUCESSO' && <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />}
                    {item.status === 'PROCESSANDO' && <RefreshCw className="w-5 h-5 text-emerald-600 dark:text-emerald-400 animate-spin" />}
                    {item.status === 'ERRO' && <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400" />}
                    {item.status === 'PENDENTE' && <div className="w-2.5 h-2.5 rounded-full bg-muted-foreground/40 ml-1.5 mr-1" />}
                  </div>

                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-foreground truncate">
                      {item.name}
                    </p>
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-0.5">
                      <span>{item.size}</span>
                      {item.stats?.unidadeNome && (
                        <span className="text-emerald-700 dark:text-emerald-400 font-semibold truncate">
                          📍 {item.stats.unidadeNome}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {item.status === 'SUCESSO' && item.stats && (
                    <div className="text-right text-[11px]">
                      <span className="font-bold text-emerald-700 dark:text-emerald-400">
                        +{item.stats.totalPacientesSisFilaEncontrados} pacientes
                      </span>
                      <span className="text-muted-foreground mx-1.5">•</span>
                      <span className="text-muted-foreground font-medium">
                        +{item.stats.totalTelefonesAdicionados} tels
                      </span>
                    </div>
                  )}

                  {item.status === 'ERRO' && (
                    <span className="text-xs text-rose-600 dark:text-rose-400 font-bold max-w-xs truncate">
                      {item.error}
                    </span>
                  )}

                  {item.status === 'PROCESSANDO' && (
                    <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold animate-pulse">
                      Processando...
                    </span>
                  )}

                  {!isProcessing && item.status !== 'PROCESSANDO' && (
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(item.id)}
                      className="p-1.5 text-muted-foreground hover:text-rose-600 rounded-lg hover:bg-rose-500/10 transition-colors"
                      title="Remover arquivo"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
