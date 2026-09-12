'use client'

import React, { useState, useRef } from 'react'
import { 
  FolderUp, Upload, CheckCircle2, AlertCircle, RefreshCw, 
  FileText, ShieldCheck, Users, PhoneCall, MapPin, Database, ChevronRight, X
} from 'lucide-react'

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
