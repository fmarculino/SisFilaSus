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
      <div className="bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-blue-500/10 border border-emerald-500/20 rounded-2xl p-5">
        <div className="flex items-start gap-4">
          <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">
              Atualização Cadastral e-SUS (Atenção Primária)
            </h3>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed">
              Esta ferramenta processa os relatórios de <em>Acompanhamento de Cidadãos Vinculados</em> do e-SUS. 
              Alimenta o banco territorial municipal e atualiza automaticamente os pacientes do <strong>SisFilaSUS</strong> com 
              endereços, telefones sem duplicação, UBS de referência, Equipe e Microárea do ACS.
            </p>
            <div className="inline-flex items-center gap-2 mt-2 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-[11px] text-emerald-300 font-medium">
              <span>🛡️ <strong>Regra Estrita:</strong> Nenhum novo paciente é inserido na fila regulada. Cidadãos não presentes na regulação são armazenados exclusivamente na base territorial para enriquecimentos futuros.</span>
            </div>
          </div>
        </div>
      </div>

      {/* Seletor de Arquivos e Pastas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Opção 1: Selecionar Pasta Completa */}
        <div 
          onClick={() => !isProcessing && folderInputRef.current?.click()}
          className={`cursor-pointer group relative overflow-hidden border-2 border-dashed border-slate-700 hover:border-emerald-500/50 rounded-2xl p-6 bg-slate-900/40 hover:bg-slate-900/80 transition-all flex flex-col items-center justify-center text-center ${isProcessing ? 'opacity-50 pointer-events-none' : ''}`}
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
          <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-400 group-hover:scale-110 transition-transform mb-3">
            <FolderUp className="w-8 h-8" />
          </div>
          <span className="text-sm font-semibold text-white">Selecionar Pasta Completa</span>
          <span className="text-xs text-slate-400 mt-1">Carrega todos os arquivos CSV de uma pasta de uma vez</span>
        </div>

        {/* Opção 2: Seleção Múltipla / Arraste */}
        <div 
          onClick={() => !isProcessing && fileInputRef.current?.click()}
          className={`cursor-pointer group relative overflow-hidden border-2 border-dashed border-slate-700 hover:border-blue-500/50 rounded-2xl p-6 bg-slate-900/40 hover:bg-slate-900/80 transition-all flex flex-col items-center justify-center text-center ${isProcessing ? 'opacity-50 pointer-events-none' : ''}`}
        >
          <input 
            type="file" 
            ref={fileInputRef}
            multiple
            accept=".csv"
            className="hidden"
            onChange={(e) => handleAddFiles(e.target.files)}
          />
          <div className="p-3 rounded-2xl bg-blue-500/10 text-blue-400 group-hover:scale-110 transition-transform mb-3">
            <Upload className="w-8 h-8" />
          </div>
          <span className="text-sm font-semibold text-white">Selecionar Arquivos Múltiplos</span>
          <span className="text-xs text-slate-400 mt-1">Escolha um ou vários arquivos CSV com Ctrl+A ou arraste aqui</span>
        </div>
      </div>

      {/* Painel de Métricas Acumuladas */}
      {(totals.arquivosConcluidos > 0 || isProcessing) && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
            <div className="flex items-center gap-2 text-slate-400 text-xs">
              <Database className="w-4 h-4 text-emerald-400" />
              <span>Base Territorial e-SUS</span>
            </div>
            <p className="text-xl font-bold text-white mt-1">
              {totals.totalSalvoEsus.toLocaleString('pt-BR')}
            </p>
            <span className="text-[10px] text-slate-400">cidadãos salvos/atualizados</span>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
            <div className="flex items-center gap-2 text-slate-400 text-xs">
              <Users className="w-4 h-4 text-blue-400" />
              <span>Pacientes SisFilaSUS</span>
            </div>
            <p className="text-xl font-bold text-white mt-1">
              {totals.totalPacientesEnriquecidos.toLocaleString('pt-BR')}
            </p>
            <span className="text-[10px] text-slate-400">encontrados na regulação</span>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
            <div className="flex items-center gap-2 text-slate-400 text-xs">
              <PhoneCall className="w-4 h-4 text-teal-400" />
              <span>Novos Telefones</span>
            </div>
            <p className="text-xl font-bold text-white mt-1">
              {totals.totalTelefonesAdicionados.toLocaleString('pt-BR')}
            </p>
            <span className="text-[10px] text-slate-400">inseridos sem duplicação</span>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
            <div className="flex items-center gap-2 text-slate-400 text-xs">
              <MapPin className="w-4 h-4 text-amber-400" />
              <span>Endereços Atualizados</span>
            </div>
            <p className="text-xl font-bold text-white mt-1">
              {totals.totalEnderecosAtualizados.toLocaleString('pt-BR')}
            </p>
            <span className="text-[10px] text-slate-400">com dados territoriais</span>
          </div>
        </div>
      )}

      {/* Fila de Arquivos */}
      {queue.length > 0 && (
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-emerald-400" />
              <div>
                <h4 className="text-sm font-semibold text-white">
                  Fila de Arquivos para Processamento ({queue.length})
                </h4>
                <span className="text-xs text-slate-400">
                  {totals.arquivosConcluidos} de {queue.length} concluídos
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {!isProcessing && (
                <button
                  type="button"
                  onClick={handleClearQueue}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                >
                  Limpar Lista
                </button>
              )}
              <button
                type="button"
                disabled={isProcessing || queue.every(q => q.status === 'SUCESSO')}
                onClick={startBatchProcess}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:pointer-events-none rounded-xl shadow-lg shadow-emerald-600/20 transition-all"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Processando Arquivo {(currentProcessingIndex || 0) + 1} de {queue.length}...</span>
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

          <div className="divide-y divide-slate-800/60 max-h-96 overflow-y-auto">
            {queue.map((item, idx) => (
              <div 
                key={item.id} 
                className={`p-4 flex items-center justify-between gap-4 transition-colors ${
                  item.status === 'PROCESSANDO' ? 'bg-emerald-500/5' : 'hover:bg-slate-800/30'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="shrink-0">
                    {item.status === 'SUCESSO' && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
                    {item.status === 'PROCESSANDO' && <RefreshCw className="w-5 h-5 text-emerald-400 animate-spin" />}
                    {item.status === 'ERRO' && <AlertCircle className="w-5 h-5 text-rose-400" />}
                    {item.status === 'PENDENTE' && <div className="w-2.5 h-2.5 rounded-full bg-slate-600 ml-1.5 mr-1" />}
                  </div>

                  <div className="min-w-0">
                    <p className="text-xs font-medium text-white truncate">
                      {item.name}
                    </p>
                    <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-0.5">
                      <span>{item.size}</span>
                      {item.stats?.unidadeNome && (
                        <span className="text-emerald-400 font-medium truncate">
                          📍 {item.stats.unidadeNome}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {item.status === 'SUCESSO' && item.stats && (
                    <div className="text-right text-[11px] text-slate-300">
                      <span className="font-semibold text-emerald-400">
                        +{item.stats.totalPacientesSisFilaEncontrados} pacientes
                      </span>
                      <span className="text-slate-500 mx-1.5">•</span>
                      <span className="text-slate-400">
                        +{item.stats.totalTelefonesAdicionados} tels
                      </span>
                    </div>
                  )}

                  {item.status === 'ERRO' && (
                    <span className="text-xs text-rose-400 font-medium max-w-xs truncate">
                      {item.error}
                    </span>
                  )}

                  {item.status === 'PROCESSANDO' && (
                    <span className="text-xs text-emerald-400 font-medium animate-pulse">
                      Processando...
                    </span>
                  )}

                  {!isProcessing && item.status !== 'PROCESSANDO' && (
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(item.id)}
                      className="p-1 text-slate-500 hover:text-slate-300 rounded hover:bg-slate-800 transition-colors"
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
