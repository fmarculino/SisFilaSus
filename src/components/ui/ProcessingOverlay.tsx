'use client'

import React, { useState, useEffect } from 'react'
import { Loader2, Activity, ShieldCheck, Database } from 'lucide-react'

interface ProcessingOverlayProps {
  isOpen: boolean
  title?: string
  subtitle?: string
  messages?: string[]
  estimatedTime?: string
}

const DEFAULT_MESSAGES = [
  'Conectando ao banco de dados da Regulação...',
  'Varrendo base com mais de 100 mil solicitações...',
  'Aplicando critérios de prioridade e classificação de risco...',
  'Calculando posições oficiais na fila...',
  'Preparando e formatando dados para exibição...',
]

export function ProcessingOverlay({
  isOpen,
  title = 'Consultando a Regulação...',
  subtitle = 'Aguarde enquanto processamos os dados atualizados.',
  messages = DEFAULT_MESSAGES,
}: ProcessingOverlayProps) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0)

  useEffect(() => {
    if (!isOpen) {
      setElapsedSeconds(0)
      setCurrentMessageIndex(0)
      return
    }

    // Cronômetro ativo a cada segundo para provar que a tela NÃO travou
    const timer = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1)
    }, 1000)

    // Rotaciona as mensagens a cada 3 segundos
    const messageTimer = setInterval(() => {
      setCurrentMessageIndex((prev) => (prev + 1) % messages.length)
    }, 3000)

    return () => {
      clearInterval(timer)
      clearInterval(messageTimer)
    }
  }, [isOpen, messages.length])

  if (!isOpen) return null

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60)
    const remSecs = secs % 60
    return `${mins.toString().padStart(2, '0')}:${remSecs.toString().padStart(2, '0')}`
  }

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/70 backdrop-blur-sm animate-in fade-in duration-200"
      role="alert"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="bento-card w-full max-w-md p-6 sm:p-8 bg-card/95 border border-primary/30 shadow-2xl rounded-3xl relative overflow-hidden text-center space-y-5 animate-in zoom-in-95 duration-250">
        {/* Barra superior de progresso infinito / shimmer */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-muted/30 overflow-hidden">
          <div className="h-full bg-gradient-to-r from-transparent via-primary to-transparent w-1/2 animate-[shimmer_1.5s_infinite] -translate-x-full" />
        </div>

        {/* Ícone com pulso e anéis concêntricos */}
        <div className="relative mx-auto w-16 h-16 flex items-center justify-center">
          <div className="absolute inset-0 rounded-2xl bg-primary/20 animate-ping opacity-60" />
          <div className="absolute inset-0 rounded-2xl bg-primary/10 animate-pulse" />
          <div className="relative w-14 h-14 rounded-2xl bg-primary/20 border border-primary/40 flex items-center justify-center text-primary shadow-inner">
            <Loader2 className="w-7 h-7 animate-spin" />
          </div>
        </div>

        {/* Textos Principais */}
        <div className="space-y-1.5">
          <h3 className="text-lg font-black text-foreground tracking-tight">
            {title}
          </h3>
          <p className="text-xs text-muted-foreground">
            {subtitle}
          </p>
        </div>

        {/* Mensagem Dinâmica em Transição */}
        <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/40 min-h-[58px] flex items-center justify-center">
          <div className="flex items-center gap-2.5 text-xs font-semibold text-foreground/90 transition-all duration-300">
            <Database className="w-4 h-4 text-primary shrink-0 animate-pulse" />
            <span className="animate-in fade-in slide-in-from-bottom-1 duration-300 key={currentMessageIndex}">
              {messages[currentMessageIndex]}
            </span>
          </div>
        </div>

        {/* Cronômetro e Indicador de Vida do Sistema */}
        <div className="flex items-center justify-between pt-2 border-t border-border/30 text-[11px]">
          <div className="flex items-center gap-1.5 text-muted-foreground font-medium">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>Sistema ativo • Não travou</span>
          </div>
          
          <div className="flex items-center gap-2 bg-primary/10 px-2.5 py-1 rounded-xl font-mono text-primary font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>{formatTime(elapsedSeconds)}</span>
          </div>
        </div>

        {/* Dica para consultas longas (> 10 segundos) */}
        {elapsedSeconds >= 10 && (
          <p className="text-[10px] text-amber-500/90 font-medium animate-in fade-in duration-300 bg-amber-500/10 p-2 rounded-xl border border-amber-500/20">
            A consulta está processando um grande volume de dados. Quase concluído, continue aguardando...
          </p>
        )}
      </div>
    </div>
  )
}
