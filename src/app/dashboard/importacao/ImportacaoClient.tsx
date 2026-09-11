'use client'

import React, { useState } from 'react'
import { DashboardShell } from '@/components/layout/DashboardShell'
import { 
  Upload, CheckCircle2, AlertCircle, FileText, ArrowRight, 
  Activity, Clock, ShieldAlert, Layers, Users
} from 'lucide-react'
import { ImportacaoEsusTab } from './ImportacaoEsusTab'

interface ImportStats {
  nomeArquivo: string
  totalRegistros: number
  registrosNovos: number
  registrosAtualizados: number
  registrosAusentes: number
  dataExportacao: string | null
}

export function ImportacaoClient({ role, email }: { role: string; email: string }) {
  const [activeTab, setActiveTab] = useState<'SISREG' | 'ESUS'>('SISREG')
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
      <div className="space-y-8 max-w-5xl">
        {/* Cabeçalho */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-3xl font-black text-foreground tracking-tighter uppercase">
              Central de <span className="text-primary italic">Importações</span>
            </h2>
            <p className="text-sm text-muted-foreground mt-2">
              Gerencie a importação de filas do SISREG III e atualização cadastral territorial do e-SUS.
            </p>
          </div>

          {/* Navegação de Abas */}
          <div className="flex items-center p-1 bg-muted/50 border border-border/40 rounded-2xl shrink-0 self-start">
            <button
              type="button"
              onClick={() => setActiveTab('SISREG')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'SISREG'
                  ? 'bg-primary text-primary-foreground shadow-md'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>Fila SISREG</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('ESUS')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'ESUS'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Atualização e-SUS</span>
            </button>
          </div>
        </div>

        {/* Conteúdo da Aba e-SUS */}
        {activeTab === 'ESUS' && (
          <ImportacaoEsusTab />
        )}

        {/* Conteúdo da Aba SISREG */}
        {activeTab === 'SISREG' && (
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
                    <span><strong>Enriquecimento Automático:</strong> Ao final da importação, novos pacientes são enriquecidos instantaneamente com a base do e-SUS.</span>
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
                        <span>Iniciar Processamento SISREG</span>
                        <ArrowRight className="h-4.5 w-4.5 stroke-[2.5]" />
                      </>
                    )}
                  </button>
                </form>
              </div>

              {/* Estatísticas de Retorno */}
              {stats && (
                <div className="bento-card p-8 border-emerald-500/20 bg-emerald-500/5">
                  <div className="flex items-center gap-3 text-emerald-500 mb-6">
                    <CheckCircle2 className="h-6 w-6" />
                    <div>
                      <h4 className="font-black text-sm uppercase tracking-tight">Importação SISREG Concluída!</h4>
                      <p className="text-xs text-muted-foreground mt-0.5">O arquivo foi validado e inserido com sucesso na base de dados.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="p-4 rounded-2xl bg-card border border-border/50">
                      <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Total Linhas</span>
                      <p className="text-2xl font-black text-foreground mt-1">{stats.totalRegistros.toLocaleString('pt-BR')}</p>
                    </div>

                    <div className="p-4 rounded-2xl bg-card border border-border/50">
                      <span className="text-[10px] font-black uppercase tracking-wider text-emerald-500">Novos Registros</span>
                      <p className="text-2xl font-black text-emerald-500 mt-1">{stats.registrosNovos.toLocaleString('pt-BR')}</p>
                    </div>

                    <div className="p-4 rounded-2xl bg-card border border-border/50">
                      <span className="text-[10px] font-black uppercase tracking-wider text-blue-500">Atualizados</span>
                      <p className="text-2xl font-black text-blue-500 mt-1">{stats.registrosAtualizados.toLocaleString('pt-BR')}</p>
                    </div>

                    <div className="p-4 rounded-2xl bg-card border border-border/50">
                      <span className="text-[10px] font-black uppercase tracking-wider text-amber-500">Não Encontrados</span>
                      <p className="text-2xl font-black text-amber-500 mt-1">{stats.registrosAusentes.toLocaleString('pt-BR')}</p>
                    </div>
                  </div>

                  {stats.dataExportacao && (
                    <div className="mt-6 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                      <Clock className="h-4 w-4 text-primary" />
                      <span>Data de Exportação do Arquivo SISREG: <strong>{stats.dataExportacao}</strong></span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </DashboardShell>
  )
}
