'use client'

import React, { useState } from 'react'
import { Phone, Plus, Trash2, Star, ChevronUp, ChevronDown, MessageSquare, UserCircle } from 'lucide-react'
import { PhoneBadge, type PhoneStatus, type PhoneType, getPhoneTypeLabel } from './PhoneBadge'

export interface TelefoneData {
  id?: string
  numero: string
  tipo: PhoneType
  status: PhoneStatus
  prioridade: number
  nome_contato: string
  parentesco: string
  observacoes: string
  _isNew?: boolean  // flag local para telefones recém-adicionados (não salvo no banco)
}

interface PhoneManagerProps {
  telefones: TelefoneData[]
  onChange: (telefones: TelefoneData[]) => void
  readOnly?: boolean
  compact?: boolean  // modo compacto para uso no drawer da fila
}

const maskPhone = (value: string) => {
  const clean = value.replace(/\D/g, '').substring(0, 11)
  if (clean.length <= 2) return clean
  if (clean.length <= 7) return `(${clean.substring(0, 2)}) ${clean.substring(2)}`
  return `(${clean.substring(0, 2)}) ${clean.substring(2, 7)}-${clean.substring(7)}`
}

const EMPTY_PHONE: TelefoneData = {
  numero: '',
  tipo: 'CELULAR_WHATSAPP',
  status: 'ATIVO',
  prioridade: 0,
  nome_contato: '',
  parentesco: '',
  observacoes: '',
  _isNew: true,
}

export function PhoneManager({ telefones, onChange, readOnly = false, compact = false }: PhoneManagerProps) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null)

  const handleAdd = () => {
    const maxPrio = telefones.length > 0
      ? Math.max(...telefones.map(t => t.prioridade)) + 1
      : 0
    const newPhone: TelefoneData = { ...EMPTY_PHONE, prioridade: maxPrio }
    const updated = [...telefones, newPhone]
    onChange(updated)
    setExpandedIdx(updated.length - 1)
  }

  const handleRemove = (idx: number) => {
    const updated = telefones.filter((_, i) => i !== idx)
    // Reindex prioridades
    const reindexed = updated.map((t, i) => ({ ...t, prioridade: i }))
    onChange(reindexed)
    if (expandedIdx === idx) setExpandedIdx(null)
    else if (expandedIdx !== null && expandedIdx > idx) setExpandedIdx(expandedIdx - 1)
  }

  const handleUpdate = (idx: number, field: keyof TelefoneData, value: string) => {
    const updated = telefones.map((t, i) =>
      i === idx ? { ...t, [field]: value } : t
    )
    onChange(updated)
  }

  const handleMoveUp = (idx: number) => {
    if (idx === 0) return
    const updated = [...telefones]
    const temp = updated[idx]
    updated[idx] = updated[idx - 1]
    updated[idx - 1] = temp
    // Reindex prioridades
    const reindexed = updated.map((t, i) => ({ ...t, prioridade: i }))
    onChange(reindexed)
    if (expandedIdx === idx) setExpandedIdx(idx - 1)
    else if (expandedIdx === idx - 1) setExpandedIdx(idx)
  }

  const handleMoveDown = (idx: number) => {
    if (idx === telefones.length - 1) return
    const updated = [...telefones]
    const temp = updated[idx]
    updated[idx] = updated[idx + 1]
    updated[idx + 1] = temp
    // Reindex prioridades
    const reindexed = updated.map((t, i) => ({ ...t, prioridade: i }))
    onChange(reindexed)
    if (expandedIdx === idx) setExpandedIdx(idx + 1)
    else if (expandedIdx === idx + 1) setExpandedIdx(idx)
  }

  const toggleExpand = (idx: number) => {
    setExpandedIdx(expandedIdx === idx ? null : idx)
  }

  const sorted = [...telefones].sort((a, b) => a.prioridade - b.prioridade)

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
          <Phone className="h-3.5 w-3.5" />
          Telefones para Contato
          <span className="text-[9px] font-mono text-muted-foreground/50">
            ({telefones.filter(t => t.status === 'ATIVO').length} ativo{telefones.filter(t => t.status === 'ATIVO').length !== 1 ? 's' : ''})
          </span>
        </span>
        {!readOnly && (
          <button
            type="button"
            onClick={handleAdd}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-primary hover:bg-primary/10 rounded-xl transition-all cursor-pointer border border-primary/20"
          >
            <Plus className="h-3 w-3" />
            Telefone
          </button>
        )}
      </div>

      {/* Empty State */}
      {telefones.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border/50 p-6 text-center">
          <Phone className="h-8 w-8 text-muted-foreground/20 mx-auto mb-2" />
          <p className="text-[10px] text-muted-foreground/60 font-bold">
            Nenhum telefone cadastrado.
          </p>
          {!readOnly && (
            <button
              type="button"
              onClick={handleAdd}
              className="mt-3 text-[9px] font-black uppercase tracking-widest text-primary hover:underline cursor-pointer"
            >
              + Adicionar Primeiro Telefone
            </button>
          )}
        </div>
      )}

      {/* Phone List */}
      <div className="space-y-2">
        {sorted.map((tel, sortedIdx) => {
          // Find the real index in the original array
          const realIdx = telefones.findIndex(t => t === tel)
          const isExpanded = expandedIdx === realIdx

          return (
            <div
              key={tel.id || `new-${sortedIdx}`}
              className={`rounded-2xl border transition-all ${
                isExpanded
                  ? 'border-primary/30 bg-primary/[0.02] shadow-sm'
                  : 'border-border/30 bg-card/50 hover:border-border/50'
              }`}
            >
              {/* Collapsed Row */}
              <div
                className="flex items-center gap-3 px-4 py-3 cursor-pointer"
                onClick={() => toggleExpand(realIdx)}
              >
                {/* Priority indicator */}
                <div className="shrink-0">
                  {sortedIdx === 0 ? (
                    <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                  ) : (
                    <span className="text-[9px] font-black text-muted-foreground/40 w-4 text-center block">
                      {sortedIdx + 1}
                    </span>
                  )}
                </div>

                {/* Phone info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold font-mono text-foreground">
                      {tel.numero ? maskPhone(tel.numero) : '(sem número)'}
                    </span>
                    <PhoneBadge status={tel.status} />
                    <span className="text-[8px] font-bold text-muted-foreground/50 uppercase">
                      {getPhoneTypeLabel(tel.tipo)}
                    </span>
                  </div>
                  {tel.tipo === 'RECADO' && tel.nome_contato && (
                    <p className="text-[9px] text-muted-foreground/60 mt-0.5 truncate">
                      Recado c/ {tel.nome_contato}{tel.parentesco ? ` (${tel.parentesco})` : ''}
                    </p>
                  )}
                </div>

                {/* Actions */}
                {!readOnly && (
                  <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => handleMoveUp(realIdx)}
                      disabled={sortedIdx === 0}
                      className="p-1 rounded-lg hover:bg-muted/50 text-muted-foreground disabled:opacity-20 cursor-pointer transition-colors"
                      title="Mover para cima"
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveDown(realIdx)}
                      disabled={sortedIdx === sorted.length - 1}
                      className="p-1 rounded-lg hover:bg-muted/50 text-muted-foreground disabled:opacity-20 cursor-pointer transition-colors"
                      title="Mover para baixo"
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemove(realIdx)}
                      className="p-1 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-500 cursor-pointer transition-colors"
                      title="Remover telefone"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Expanded Form */}
              {isExpanded && !readOnly && (
                <div className="px-4 pb-4 pt-1 border-t border-border/10 space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    {/* Número */}
                    <div className="group">
                      <label className="block text-[8px] font-black uppercase tracking-widest text-muted-foreground mb-1.5 px-0.5">Número</label>
                      <div className="relative">
                        <input
                          type="text"
                          value={maskPhone(tel.numero)}
                          onChange={(e) => handleUpdate(realIdx, 'numero', e.target.value.replace(/\D/g, ''))}
                          className="block w-full rounded-xl border border-border/50 bg-background/50 py-2.5 px-3 pl-9 text-xs text-foreground outline-none focus:border-primary transition-all font-mono"
                          placeholder="(94) 99123-4567"
                        />
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/45 pointer-events-none" />
                      </div>
                    </div>

                    {/* Tipo */}
                    <div className="group">
                      <label className="block text-[8px] font-black uppercase tracking-widest text-muted-foreground mb-1.5 px-0.5">Tipo</label>
                      <select
                        value={tel.tipo}
                        onChange={(e) => handleUpdate(realIdx, 'tipo', e.target.value)}
                        className="block w-full rounded-xl border border-border/50 bg-background/50 py-2.5 px-3 text-xs text-foreground outline-none focus:border-primary transition-all"
                      >
                        <option value="CELULAR_WHATSAPP">📱 Celular/WhatsApp</option>
                        <option value="CELULAR">📞 Celular (sem WhatsApp)</option>
                        <option value="FIXO">☎️ Fixo</option>
                        <option value="RECADO">💬 Recado (terceiro)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {/* Status */}
                    <div className="group">
                      <label className="block text-[8px] font-black uppercase tracking-widest text-muted-foreground mb-1.5 px-0.5">Status</label>
                      <select
                        value={tel.status}
                        onChange={(e) => handleUpdate(realIdx, 'status', e.target.value)}
                        className="block w-full rounded-xl border border-border/50 bg-background/50 py-2.5 px-3 text-xs text-foreground outline-none focus:border-primary transition-all"
                      >
                        <option value="ATIVO">🟢 Ativo</option>
                        <option value="INATIVO">🔴 Inativo</option>
                        <option value="TROCOU_DONO">🟠 Trocou de Dono</option>
                        <option value="PERDIDO">🟡 Perdido</option>
                        <option value="DESLIGADO">⚫ Desligado</option>
                        <option value="NAO_EXISTE">🔵 Não Existe</option>
                        <option value="NAO_ATENDE">🟣 Não Atende</option>
                      </select>
                    </div>

                    {/* Parentesco (se tipo é RECADO) */}
                    {tel.tipo === 'RECADO' && (
                      <div className="group">
                        <label className="block text-[8px] font-black uppercase tracking-widest text-muted-foreground mb-1.5 px-0.5">Parentesco</label>
                        <select
                          value={tel.parentesco}
                          onChange={(e) => handleUpdate(realIdx, 'parentesco', e.target.value)}
                          className="block w-full rounded-xl border border-border/50 bg-background/50 py-2.5 px-3 text-xs text-foreground outline-none focus:border-primary transition-all"
                        >
                          <option value="">Não Informado</option>
                          <option value="MAE">Mãe</option>
                          <option value="PAI">Pai</option>
                          <option value="ESPOSO(A)">Esposo(a)</option>
                          <option value="FILHO(A)">Filho(a)</option>
                          <option value="IRMAO(A)">Irmão(ã)</option>
                          <option value="VIZINHO(A)">Vizinho(a)</option>
                          <option value="AMIGO(A)">Amigo(a)</option>
                          <option value="OUTRO">Outro</option>
                        </select>
                      </div>
                    )}
                  </div>

                  {/* Nome do contato (para RECADO) */}
                  {tel.tipo === 'RECADO' && (
                    <div className="group">
                      <label className="block text-[8px] font-black uppercase tracking-widest text-muted-foreground mb-1.5 px-0.5">Nome do Contato (Recado)</label>
                      <div className="relative">
                        <input
                          type="text"
                          value={tel.nome_contato}
                          onChange={(e) => handleUpdate(realIdx, 'nome_contato', e.target.value)}
                          className="block w-full rounded-xl border border-border/50 bg-background/50 py-2.5 px-3 pl-9 text-xs text-foreground outline-none focus:border-primary transition-all uppercase"
                          placeholder="Ex: MARIA (vizinha)"
                        />
                        <UserCircle className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/45 pointer-events-none" />
                      </div>
                    </div>
                  )}

                  {/* Observações */}
                  {!compact && (
                    <div className="group">
                      <label className="block text-[8px] font-black uppercase tracking-widest text-muted-foreground mb-1.5 px-0.5">Observações</label>
                      <input
                        type="text"
                        value={tel.observacoes}
                        onChange={(e) => handleUpdate(realIdx, 'observacoes', e.target.value)}
                        className="block w-full rounded-xl border border-border/50 bg-background/50 py-2.5 px-3 text-xs text-foreground outline-none focus:border-primary transition-all"
                        placeholder="Ex: Atende só de manhã, número antigo, etc."
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
