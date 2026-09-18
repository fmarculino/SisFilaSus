'use client'

import React, { useState, useRef, useEffect } from 'react'
import { 
  FolderUp, Upload, CheckCircle2, AlertCircle, RefreshCw, 
  FileText, ShieldCheck, Users, PhoneCall, MapPin, Database, ChevronRight, X,
  Server, Zap, Clock, PlayCircle
} from 'lucide-react'
import { 
  solicitarSincronizacaoEsusAction, 
  obterUltimoJobSincronizacaoAction, 
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
  const [syncPeriod, setSyncPeriod] = useState<'30' | '7' | 'all'>('30')
  const [syncMsg, setSyncMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Carregar status do último job e fazer polling quando estiver ativo
  React.useEffect(() => {
    let timer: NodeJS.Timeout

    const fetchLatestJob = async () => {
      const res = await obterUltimoJobSincronizacaoAction()
      if (res.success && res.job) {
        setSyncJob(res.job)
      }
    }

    fetchLatestJob()

    if (syncJob?.status === 'PENDENTE' || syncJob?.status === 'PROCESSANDO') {
      timer = setInterval(fetchLatestJob, 4000)
    }

    return () => {
      if (timer) clearInterval(timer)
    }
  }, [syncJob?.status])

  const handleSolicitarSync = async () => {
    setIsSubmittingSync(true)
    setSyncMsg(null)
    try {
      const isAll = syncPeriod === 'all'
      const days = isAll ? undefined : parseInt(syncPeriod, 10)
      const res = await solicitarSincronizacaoEsusAction(days, isAll)
      if (res.success && res.job) {
        setSyncJob(res.job)
        setSyncMsg({ type: 'success', text: 'Solicitação de sincronização enviada! O Agente Local iniciará o processamento.' })
      } else {
        setSyncMsg({ type: 'error', text: res.error || 'Erro ao registrar solicitação.' })
      }
    } catch (err: any) {
      setSyncMsg({ type: 'error', text: err.message })
    } finally {
      setIsSubmittingSync(false)
    }
  }

  const handleCancelarSync = async (jobId: string) => {
    await cancelarJobSincronizacaoAction(jobId)
    const res = await obterUltimoJobSincronizacaoAction()
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
      {/* NOVO: CARD DE SINCRONIZAÇÃO DIRETA COM BANCO e-SUS PEC (AGENTE LOCAL)    */}
      {/* ========================================================================= */}
      <div className="bento-card p-6 border border-primary/20 bg-gradient-to-br from-primary/[0.04] via-background/60 to-emerald-500/[0.04] rounded-3xl relative overflow-hidden shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="p-3.5 rounded-2xl bg-primary/10 text-primary shrink-0 shadow-sm">
              <Server className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h4 className="text-base font-bold text-foreground">
                  Sincronização Direta do Banco e-SUS PEC
                </h4>
                {syncJob?.status === 'PENDENTE' && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 animate-pulse">
                    <Clock className="w-3.5 h-3.5" /> Aguardando Agente Local
                  </span>
                )}
                {syncJob?.status === 'PROCESSANDO' && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Agente Processando...
                  </span>
                )}
                {syncJob?.status === 'CONCLUIDO' && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Concluído com Sucesso
                  </span>
                )}
                {syncJob?.status === 'ERRO' && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-destructive/10 text-destructive border border-destructive/20">
                    <AlertCircle className="w-3.5 h-3.5" /> Falha na Última Execução
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1 max-w-2xl leading-relaxed">
                Dispara a sincronização diretamente no PostgreSQL do servidor e-SUS da rede local via <strong>Agente SisFilaSUS</strong>, atualizando contatos e endereços dos pacientes regulados sem precisar manipular planilhas CSV.
              </p>
            </div>
          </div>

          {/* Controles de Disparo */}
          <div className="flex items-center gap-3 shrink-0">
            <select
              value={syncPeriod}
              onChange={(e) => setSyncPeriod(e.target.value as any)}
              disabled={isSubmittingSync || syncJob?.status === 'PENDENTE' || syncJob?.status === 'PROCESSANDO'}
              className="text-xs bg-background/80 border border-border/80 rounded-xl px-3 py-2.5 font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-sm"
            >
              <option value="30">Últimos 30 dias (Recomendado)</option>
              <option value="7">Últimos 7 dias</option>
              <option value="all">Base Completa (57.000+)</option>
            </select>

            <button
              onClick={handleSolicitarSync}
              disabled={isSubmittingSync || syncJob?.status === 'PENDENTE' || syncJob?.status === 'PROCESSANDO'}
              className="btn btn-primary px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm shadow-primary/20 hover:shadow-md hover:shadow-primary/30 active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none"
            >
              {isSubmittingSync ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Solicitando...
                </>
              ) : syncJob?.status === 'PROCESSANDO' ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Em Andamento...
                </>
              ) : syncJob?.status === 'PENDENTE' ? (
                <>
                  <Clock className="w-4 h-4" />
                  Na Fila...
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 text-amber-300" />
                  Sincronizar e-SUS Agora
                </>
              )}
            </button>
          </div>
        </div>

        {/* Mensagem de Feedback */}
        {syncMsg && (
          <div className={`mt-4 p-3 rounded-2xl text-xs font-medium flex items-center gap-2.5 ${syncMsg.type === 'success' ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20' : 'bg-destructive/10 text-destructive border border-destructive/20'}`}>
            {syncMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            <span>{syncMsg.text}</span>
          </div>
        )}

        {/* Resumo do Status Atual ou Último Job */}
        {syncJob && (
          <div className="mt-4 pt-4 border-t border-border/50 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="font-semibold text-foreground">Status Atual:</span>
              <span>{syncJob.mensagem_status || 'Nenhuma mensagem disponível.'}</span>
              {syncJob.status === 'PENDENTE' && (
                <button
                  onClick={() => handleCancelarSync(syncJob.id)}
                  className="text-destructive hover:underline ml-2 font-semibold"
                >
                  Cancelar
                </button>
              )}
            </div>

            {syncJob.stats && syncJob.stats.totalLidos !== undefined && (
              <div className="flex items-center gap-4 flex-wrap text-muted-foreground">
                <span>Lidos: <strong className="text-foreground">{syncJob.stats.totalLidos}</strong></span>
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
