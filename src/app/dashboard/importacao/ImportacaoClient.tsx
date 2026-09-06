'use client'

import React, { useState } from 'react'
import { DashboardShell } from '@/components/layout/DashboardShell'
import { Upload, CheckCircle2, AlertCircle, FileText, ArrowRight, Activity, Clock, ShieldAlert } from 'lucide-react'

interface ImportStats {
  nomeArquivo: string
  totalRegistros: number
  registrosNovos: number
  registrosAtualizados: number
  registrosAusentes: number
  dataExportacao: string | null
}

export function ImportacaoClient({ role, email }: { role: string; email: string }) {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState<ImportStats | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0])
      setError(null)
      setStats(null)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) {
      setError('Por favor, selecione um arquivo.')
      return
    }

    setLoading(true)
    setError(null)
    setStats(null)

    try {
      const fileContent = await file.text()
      const res = await fetch('/api/importar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileContent,
          fileName: file.name,
        }),
      })

      if (!res.ok) {
        let errorMsg = `Erro no servidor (${res.status} ${res.statusText})`
        try {
          const errData = await res.json()
          if (errData?.error) errorMsg = errData.error
        } catch {
          if (res.status === 502 || res.status === 504) {
            errorMsg = 'Tempo limite esgotado no servidor. O arquivo pode ser muito extenso ou o lote ainda está sendo concluído.'
          } else if (res.status === 413) {
            errorMsg = 'O arquivo selecionado excede o tamanho máximo permitido.'
          }
        }
        throw new Error(errorMsg)
      }

      const data = await res.json()
      setStats(data)
    } catch (err: any) {
      setError(err.message || 'Falha de comunicação com o servidor.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <DashboardShell role={role} email={email}>
      <div className="space-y-8 max-w-4xl">
        <div>
          <h2 className="text-3xl font-black text-foreground tracking-tighter uppercase">
            Importação de <span className="text-primary italic">Relatórios</span>
          </h2>
          <p className="text-sm text-muted-foreground mt-2">
            Carregue os arquivos CSV extraídos do SISREG III para atualizar a fila de espera e o status de procedimentos.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-3">
          {/* Instruções e Regras */}
          <div className="md:col-span-1 space-y-6">
            <div className="bento-card p-6 bg-card/25">
              <span className="text-[10px] font-black uppercase tracking-widest text-primary">Regras de Processamento</span>
              <ul className="mt-4 space-y-4 text-xs font-medium text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                  <span>Suporta relatórios de <strong>Internação Eletiva</strong> (contendo posição na fila) e <strong>Ambulatoriais/Exames</strong> (contendo agendamentos).</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                  <span>O parser trata automaticamente cabeçalhos duplicados do SISREG sem quebrar a importação.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                  <span><strong>Segurança Anti-fraude:</strong> Registros que deixam de aparecer em novos arquivos não são deletados — são marcados como <em>"Não Encontrados no SISREG"</em> para auditoria manual.</span>
                </li>
              </ul>
            </div>

            <div className="bento-card p-6 bg-amber-500/5 border-amber-500/20 text-amber-500 flex items-start gap-3">
              <ShieldAlert className="h-5 w-5 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-widest">Aviso Operacional</span>
                <p className="text-[11px] leading-relaxed font-bold opacity-80">
                  O SISREG III libera a exportação de dados analíticos apenas entre as <strong>16:00 e 22:00</strong>. Recomendamos programar as importações diárias nesta faixa horária.
                </p>
              </div>
            </div>
          </div>

          {/* Área de Upload e Resultados */}
          <div className="md:col-span-2 space-y-6">
            <div className="bento-card p-8 md:p-10">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="group relative flex flex-col items-center justify-center border-2 border-dashed border-border/50 hover:border-primary/40 rounded-3xl p-10 bg-background/20 transition-all duration-300">
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    disabled={loading}
                  />
                  <div className="flex flex-col items-center gap-4 text-center">
                    <div className="p-4 rounded-2xl bg-primary/10 text-primary group-hover:scale-110 transition-transform duration-350 shadow-md">
                      <Upload className="h-8 w-8 stroke-[2.5]" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground">
                        {file ? file.name : 'Selecione o arquivo CSV do SISREG'}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1.5">
                        {file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : 'Arraste e solte o arquivo aqui ou clique para buscar'}
                      </p>
                    </div>
                  </div>
                </div>

                {error && (
                  <div className="flex items-center gap-3 p-4 bg-rose-500/5 border border-rose-500/20 text-rose-500 rounded-2xl text-xs font-bold leading-relaxed">
                    <AlertCircle className="h-5 w-5 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || !file}
                  className={`
                    w-full py-4 rounded-2xl font-black uppercase text-xs tracking-widest transition-all duration-350 flex items-center justify-center gap-2
                    ${loading || !file
                      ? 'bg-muted text-muted-foreground cursor-not-allowed border border-border/10'
                      : 'bg-primary text-primary-foreground hover:scale-[1.01] hover:shadow-xl hover:shadow-primary/20 active:scale-[0.99] cursor-pointer'
                    }
                  `}
                >
                  {loading ? (
                    <>
                      <Activity className="h-4.5 w-4.5 animate-spin" />
                      <span>Processando Importação (isso pode levar alguns segundos)...</span>
                    </>
                  ) : (
                    <>
                      <span>Iniciar Processamento</span>
                      <ArrowRight className="h-4.5 w-4.5 stroke-[2.5]" />
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Relatório do Lote Importado */}
            {stats && (
              <div className="bento-card p-8 animate-in space-y-6 border-emerald-500/20 bg-emerald-500/5">
                <div className="flex items-center gap-3 text-emerald-500">
                  <CheckCircle2 className="h-6 w-6 shrink-0" />
                  <span className="text-sm font-black uppercase tracking-wider">Lote Importado com Sucesso!</span>
                </div>

                <div className="grid gap-4 grid-cols-2 sm:grid-cols-4 mt-6">
                  <div className="bg-background/40 border border-border/30 p-4 rounded-2xl text-center">
                    <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Total Importado</span>
                    <p className="text-3xl font-black text-foreground mt-2">{stats.totalRegistros}</p>
                  </div>

                  <div className="bg-background/40 border border-border/30 p-4 rounded-2xl text-center">
                    <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground text-emerald-500">Registros Novos</span>
                    <p className="text-3xl font-black text-emerald-500 mt-2">+{stats.registrosNovos}</p>
                  </div>

                  <div className="bg-background/40 border border-border/30 p-4 rounded-2xl text-center">
                    <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground text-teal-500">Atualizados</span>
                    <p className="text-3xl font-black text-teal-500 mt-2">{stats.registrosAtualizados}</p>
                  </div>

                  <div className="bg-background/40 border border-border/30 p-4 rounded-2xl text-center">
                    <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground text-amber-500">Ausentes (DIFF)</span>
                    <p className="text-3xl font-black text-amber-500 mt-2">{stats.registrosAusentes}</p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border border-border/30 bg-background/20 rounded-2xl text-xs font-medium text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    <span>Arquivo: <strong>{stats.nomeArquivo}</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-primary" />
                    <span>Exportação SISREG: <strong>{stats.dataExportacao || 'Não informada'}</strong></span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardShell>
  )
}
