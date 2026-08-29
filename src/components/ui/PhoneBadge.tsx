'use client'

import React from 'react'

export type PhoneStatus = 'ATIVO' | 'INATIVO' | 'TROCOU_DONO' | 'PERDIDO' | 'DESLIGADO' | 'NAO_EXISTE' | 'NAO_ATENDE'

const STATUS_CONFIG: Record<PhoneStatus, { label: string; color: string; bgColor: string; borderColor: string }> = {
  ATIVO: { label: 'Ativo', color: 'text-emerald-500', bgColor: 'bg-emerald-500/10', borderColor: 'border-emerald-500/20' },
  INATIVO: { label: 'Inativo', color: 'text-red-500', bgColor: 'bg-red-500/10', borderColor: 'border-red-500/20' },
  TROCOU_DONO: { label: 'Trocou Dono', color: 'text-orange-500', bgColor: 'bg-orange-500/10', borderColor: 'border-orange-500/20' },
  PERDIDO: { label: 'Perdido', color: 'text-amber-500', bgColor: 'bg-amber-500/10', borderColor: 'border-amber-500/20' },
  DESLIGADO: { label: 'Desligado', color: 'text-gray-500', bgColor: 'bg-gray-500/10', borderColor: 'border-gray-500/20' },
  NAO_EXISTE: { label: 'Não Existe', color: 'text-slate-500', bgColor: 'bg-slate-500/10', borderColor: 'border-slate-500/20' },
  NAO_ATENDE: { label: 'Não Atende', color: 'text-purple-500', bgColor: 'bg-purple-500/10', borderColor: 'border-purple-500/20' },
}

interface PhoneBadgeProps {
  status: PhoneStatus
  size?: 'sm' | 'md'
}

export function PhoneBadge({ status, size = 'sm' }: PhoneBadgeProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.INATIVO

  const sizeClasses = size === 'sm'
    ? 'text-[7px] px-1.5 py-0.5'
    : 'text-[9px] px-2 py-1'

  return (
    <span
      className={`inline-flex items-center gap-1 font-black uppercase tracking-widest rounded-md border ${config.bgColor} ${config.color} ${config.borderColor} ${sizeClasses} whitespace-nowrap`}
    >
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${status === 'ATIVO' ? 'bg-emerald-500' : status === 'INATIVO' ? 'bg-red-500' : status === 'TROCOU_DONO' ? 'bg-orange-500' : status === 'PERDIDO' ? 'bg-amber-500' : status === 'DESLIGADO' ? 'bg-gray-500' : status === 'NAO_EXISTE' ? 'bg-slate-500' : 'bg-purple-500'}`} />
      {config.label}
    </span>
  )
}

export function getPhoneStatusLabel(status: PhoneStatus): string {
  return STATUS_CONFIG[status]?.label || status
}

export type PhoneType = 'CELULAR_WHATSAPP' | 'CELULAR' | 'FIXO' | 'RECADO'

const TYPE_LABELS: Record<PhoneType, string> = {
  CELULAR_WHATSAPP: 'Celular/WhatsApp',
  CELULAR: 'Celular',
  FIXO: 'Fixo',
  RECADO: 'Recado',
}

export function getPhoneTypeLabel(tipo: PhoneType): string {
  return TYPE_LABELS[tipo] || tipo
}
