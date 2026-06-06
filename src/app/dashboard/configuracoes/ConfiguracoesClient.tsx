'use client'

import React, { useState } from 'react'
import { DashboardShell } from '@/components/layout/DashboardShell'
import { Settings, Save, PhoneCall, Trash2, Building, EyeOff, Info } from 'lucide-react'
import { updateConfigAction } from './actions'

interface ConfigValue {
  limite_tentativas_contato: number
  anos_limpeza_fila: number
  municipio_sede: string
  omitir_fora_sisreg_padrao: boolean
}

interface ConfiguracoesClientProps {
  role: string
  email: string
  config: ConfigValue
}

export function ConfiguracoesClient({ role, email, config: initialConfig }: ConfiguracoesClientProps) {
  const [limiteContato, setLimiteContato] = useState(initialConfig.limite_tentativas_contato)
  const [anosLimpeza, setAnosLimpeza] = useState(initialConfig.anos_limpeza_fila)
  const [municipio, setMunicipio] = useState(initialConfig.municipio_sede)
  const [omitirForaSisreg, setOmitirForaSisreg] = useState(initialConfig.omitir_fora_sisreg_padrao)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setMessage(null)

    try {
      const res = await updateConfigAction({
        limite_tentativas_contato: Number(limiteContato),
        anos_limpeza_fila: Number(anosLimpeza),
        municipio_sede: municipio.trim().toUpperCase(),
        omitir_fora_sisreg_padrao: omitirForaSisreg
      })

      if (!res.success) {
        throw new Error(res.error)
      }

      setMessage({ type: 'success', text: 'Configurações salvas com sucesso!' })
      // Auto dismiss success message
      setTimeout(() => setMessage(null), 4000)
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Erro ao salvar configurações.' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <DashboardShell role={role} email={email}>
      <div className="space-y-8 max-w-4xl">
        
        {/* Header */}
        <div>
          <h2 className="text-3xl font-black text-foreground tracking-tighter uppercase">
            Parâmetros <span className="text-primary italic">Gerais</span>
          </h2>
          <p className="text-sm text-muted-foreground mt-2">
            Configure as regras de negócio globais, limites operacionais e comportamentos padrão do SisFilaSus.
          </p>
        </div>

        {/* Feedback Alert */}
        {message && (
          <div className={`p-4 rounded-2xl border text-xs font-bold uppercase tracking-wide animate-in fade-in slide-in-from-top-2 duration-300 ${
            message.type === 'success' 
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' 
              : 'bg-rose-500/10 border-rose-500/20 text-rose-500'
          }`}>
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 shrink-0" />
              <span>{message.text}</span>
            </div>
          </div>
        )}

        {/* Config Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            
            {/* Bento Card: Regulação Operacional */}
            <div className="bento-card p-6 md:p-8 space-y-6">
              <div className="flex items-center gap-3 border-b border-border/10 pb-4">
                <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <PhoneCall className="h-4.5 w-4.5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-foreground uppercase tracking-wider">Regulação Operacional</h3>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Parâmetros de contatos e buscas ativas.</p>
                </div>
              </div>

              {/* Limite de Tentativas */}
              <div className="group">
                <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2 px-1">
                  Limite de Tentativas de Contato
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  required
                  value={limiteContato}
                  onChange={(e) => setLimiteContato(Number(e.target.value))}
                  className="block w-full rounded-2xl border border-border/50 bg-background/50 py-3.5 px-4 text-xs text-foreground outline-none focus:border-primary transition-all"
                  placeholder="Ex: 3"
                />
                <span className="block text-[9px] text-muted-foreground/60 mt-1.5 px-1">
                  Quantidade máxima de tentativas falhas antes de classificar a solicitação como sem contato.
                </span>
              </div>

              {/* Município Sede */}
              <div className="group">
                <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2 px-1">
                  Município Sede da Regulação
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={municipio}
                    onChange={(e) => setMunicipio(e.target.value)}
                    className="block w-full rounded-2xl border border-border/50 bg-background/50 py-3.5 px-4 pr-10 text-xs text-foreground outline-none focus:border-primary transition-all uppercase"
                    placeholder="Ex: MARABÁ"
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/30">
                    <Building className="h-4 w-4" />
                  </div>
                </div>
                <span className="block text-[9px] text-muted-foreground/60 mt-1.5 px-1">
                  Identificador municipal padrão usado nos filtros e nos relatórios consolidados.
                </span>
              </div>
            </div>

            {/* Bento Card: Configurações da Fila */}
            <div className="bento-card p-6 md:p-8 space-y-6">
              <div className="flex items-center gap-3 border-b border-border/10 pb-4">
                <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <Trash2 className="h-4.5 w-4.5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-foreground uppercase tracking-wider">Fila e Triagem</h3>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Parâmetros de limpeza e exibição da fila.</p>
                </div>
              </div>

              {/* Anos Limpeza */}
              <div className="group">
                <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2 px-1">
                  Tempo Limite para Limpeza de Fila (Anos)
                </label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  required
                  value={anosLimpeza}
                  onChange={(e) => setAnosLimpeza(Number(e.target.value))}
                  className="block w-full rounded-2xl border border-border/50 bg-background/50 py-3.5 px-4 text-xs text-foreground outline-none focus:border-primary transition-all"
                  placeholder="Ex: 5"
                />
                <span className="block text-[9px] text-muted-foreground/60 mt-1.5 px-1">
                  Período em anos para que solicitações antigas apareçam no filtro de inativação em massa.
                </span>
              </div>

              {/* Omitir Fora do SISREG */}
              <div className="flex items-center justify-between p-4 bg-muted/20 border border-border/10 rounded-2xl">
                <div className="flex flex-col pr-4">
                  <span className="text-xs font-bold text-foreground">Omitir Fora do SISREG por Padrão</span>
                  <span className="text-[9px] text-muted-foreground mt-0.5">
                    Oculta registros ausentes nos novos arquivos de importação para evitar filas poluídas.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setOmitirForaSisreg(!omitirForaSisreg)}
                  className={`p-1.5 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                    omitirForaSisreg 
                      ? 'bg-primary/10 border-primary/30 text-primary' 
                      : 'bg-zinc-500/10 border-zinc-500/30 text-zinc-500'
                  }`}
                >
                  <EyeOff className="h-4 w-4" />
                  <span>{omitirForaSisreg ? 'Sim' : 'Não'}</span>
                </button>
              </div>
            </div>

          </div>

          {/* Form Submit Button */}
          <div className="flex justify-end pt-4">
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-4 bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-widest rounded-2xl hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer disabled:opacity-50 shadow-lg shadow-primary/20 flex items-center gap-2"
            >
              <Save className="h-4.5 w-4.5" />
              <span>{submitting ? 'Salvando...' : 'Salvar Parâmetros'}</span>
            </button>
          </div>
        </form>

      </div>
    </DashboardShell>
  )
}
