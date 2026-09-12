import React from 'react'

export interface StatusItem {
  id?: string
  codigo: string
  nome: string
  origem?: string
  cor?: string
  active?: boolean
  bloqueado_edicao_codigo?: boolean
  descricao?: string
  ordem?: number
}

// Paleta de cores com alto contraste, suporte a tema claro e escuro
export const STATUS_COLORS_MAP: Record<string, {
  badge: string
  dot: string
  label: string
  border: string
  hex: string
}> = {
  emerald: {
    badge: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25',
    dot: 'bg-emerald-500',
    label: 'Verde Esmeralda',
    border: 'border-emerald-500',
    hex: '#10b981'
  },
  green: {
    badge: 'bg-green-500/10 text-green-700 dark:text-green-300 border-green-500/25',
    dot: 'bg-green-500',
    label: 'Verde Sucesso',
    border: 'border-green-500',
    hex: '#22c55e'
  },
  blue: {
    badge: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/25',
    dot: 'bg-blue-500',
    label: 'Azul',
    border: 'border-blue-500',
    hex: '#3b82f6'
  },
  sky: {
    badge: 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/25',
    dot: 'bg-sky-500',
    label: 'Azul Céu',
    border: 'border-sky-500',
    hex: '#0ea5e9'
  },
  teal: {
    badge: 'bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-500/25',
    dot: 'bg-teal-500',
    label: 'Turquesa',
    border: 'border-teal-500',
    hex: '#14b8a6'
  },
  indigo: {
    badge: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/25',
    dot: 'bg-indigo-500',
    label: 'Índigo',
    border: 'border-indigo-500',
    hex: '#6366f1'
  },
  purple: {
    badge: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/25',
    dot: 'bg-purple-500',
    label: 'Roxo',
    border: 'border-purple-500',
    hex: '#a855f7'
  },
  amber: {
    badge: 'bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-500/30',
    dot: 'bg-amber-500',
    label: 'Âmbar / Amarelo',
    border: 'border-amber-500',
    hex: '#f59e0b'
  },
  orange: {
    badge: 'bg-orange-500/10 text-orange-800 dark:text-orange-300 border-orange-500/30',
    dot: 'bg-orange-500',
    label: 'Laranja',
    border: 'border-orange-500',
    hex: '#f97316'
  },
  rose: {
    badge: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/25',
    dot: 'bg-rose-500',
    label: 'Rosa / Coral',
    border: 'border-rose-500',
    hex: '#f43f5e'
  },
  red: {
    badge: 'bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/25',
    dot: 'bg-red-500',
    label: 'Vermelho',
    border: 'border-red-500',
    hex: '#ef4444'
  },
  slate: {
    badge: 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/25',
    dot: 'bg-slate-400',
    label: 'Cinza Suave',
    border: 'border-slate-500',
    hex: '#64748b'
  },
  zinc: {
    badge: 'bg-zinc-500/15 text-zinc-800 dark:text-zinc-200 border-zinc-500/30',
    dot: 'bg-zinc-500',
    label: 'Grafite',
    border: 'border-zinc-500',
    hex: '#71717a'
  },
  neutral: {
    badge: 'bg-neutral-900/10 dark:bg-neutral-100/10 text-neutral-900 dark:text-neutral-100 border-neutral-500/30',
    dot: 'bg-neutral-800 dark:bg-neutral-200',
    label: 'Preto / Neutro',
    border: 'border-neutral-800 dark:border-neutral-200',
    hex: '#171717'
  }
}

export function getStatusColorConfig(colorKey?: string) {
  const normalized = (colorKey || 'slate').toLowerCase().trim()
  return STATUS_COLORS_MAP[normalized] || STATUS_COLORS_MAP.slate
}

interface StatusBadgeProps {
  codigo: string
  nome?: string
  cor?: string
  statusObj?: StatusItem
  showDot?: boolean
  className?: string
}

export function StatusBadge({ 
  codigo, 
  nome, 
  cor, 
  statusObj, 
  showDot = true,
  className = '' 
}: StatusBadgeProps) {
  const activeColor = cor || statusObj?.cor || 'slate'
  const displayName = nome || statusObj?.nome || codigo.replace(/_/g, ' ')
  const colorCfg = getStatusColorConfig(activeColor)

  return (
    <span 
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider rounded-lg border shadow-xs transition-colors ${colorCfg.badge} ${className}`}
    >
      {showDot && (
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${colorCfg.dot}`} />
      )}
      <span>{displayName}</span>
    </span>
  )
}
