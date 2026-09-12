'use client'

import React, { useState, useRef, useEffect, useMemo } from 'react'
import { ChevronDown, Check, X, Bookmark, Flag, Tag } from 'lucide-react'
import { StatusItem, getStatusColorConfig } from './StatusBadge'

interface StatusSelectProps {
  statusList: StatusItem[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  buttonClassName?: string
  disabled?: boolean
}

export function StatusSelect({
  statusList,
  value,
  onChange,
  placeholder = 'Todos os Status',
  className = '',
  buttonClassName = '',
  disabled = false,
}: StatusSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  // Encontra o status selecionado
  const selectedItem = useMemo(() => {
    return statusList.find(s => s.codigo === value)
  }, [statusList, value])

  // Filtragem de opções ativas ou da atualmente selecionada
  const visibleOptions = useMemo(() => {
    const list = statusList.filter(s => s.active !== false || s.codigo === value)
    if (!search.trim()) return list
    const q = search.toLowerCase().trim()
    return list.filter(s => s.nome.toLowerCase().includes(q) || s.codigo.toLowerCase().includes(q))
  }, [statusList, value, search])

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const selectedColorCfg = selectedItem ? getStatusColorConfig(selectedItem.cor) : null

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* Botão Seletor Principal */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`
          flex w-full items-center justify-between gap-2.5 rounded-2xl border border-border/50 bg-background/50 py-3.5 px-4 text-xs font-semibold text-foreground outline-none transition-all
          hover:border-primary/50 focus:border-primary focus:ring-2 focus:ring-primary/20
          disabled:cursor-not-allowed disabled:opacity-50
          ${isOpen ? 'border-primary ring-2 ring-primary/20' : ''}
          ${buttonClassName}
        `}
      >
        <div className="flex items-center gap-2.5 truncate min-w-0">
          {selectedItem && selectedColorCfg ? (
            <>
              {/* Bandeirinha / Marcador com a cor cadastrada */}
              <div 
                className="w-3 h-4 rounded-xs shrink-0 shadow-xs border flex items-center justify-center transition-transform"
                style={{ 
                  backgroundColor: selectedColorCfg.hex, 
                  borderColor: `${selectedColorCfg.hex}cc` 
                }}
                title={`Cor: ${selectedColorCfg.label}`}
              >
                <div className="w-1 h-1 rounded-full bg-white/90" />
              </div>

              {/* Nome limpo sem prefixos [SISREG] ou [SisFilaSus] */}
              <span className="truncate font-bold text-foreground">
                {selectedItem.nome}
              </span>
            </>
          ) : (
            <span className="text-muted-foreground truncate font-medium">
              {placeholder}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0 text-muted-foreground">
          {value && (
            <span
              onClick={(e) => {
                e.stopPropagation()
                onChange('')
              }}
              className="p-1 rounded-md hover:bg-muted text-muted-foreground/60 hover:text-foreground cursor-pointer transition-colors"
              title="Limpar seleção"
            >
              <X className="h-3.5 w-3.5" />
            </span>
          )}
          <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isOpen ? 'rotate-180 text-primary' : ''}`} />
        </div>
      </button>

      {/* Menu Dropdown com Bandeirinhas Coloridas */}
      {isOpen && (
        <div className="absolute z-50 mt-1.5 w-full rounded-2xl border border-border/60 bg-background/95 backdrop-blur-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Opções de Status */}
          <ul className="max-h-64 overflow-y-auto py-1.5 text-xs divide-y divide-border/5">
            {/* Opção "Todos os Status" */}
            <li
              onClick={() => {
                onChange('')
                setIsOpen(false)
              }}
              className={`px-4 py-2.5 cursor-pointer flex items-center justify-between text-muted-foreground hover:bg-muted/40 transition-colors ${
                !value ? 'bg-primary/10 text-primary font-bold' : ''
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div className="w-3 h-4 rounded-xs border border-dashed border-border/60 bg-muted/40 shrink-0" />
                <span className="font-semibold">{placeholder}</span>
              </div>
              {!value && <Check className="h-4 w-4 text-primary stroke-[3]" />}
            </li>

            {/* Lista com Bandeirinhas Coloridas para cada status */}
            {visibleOptions.map((item) => {
              const isSelected = item.codigo === value
              const colorCfg = getStatusColorConfig(item.cor)

              return (
                <li
                  key={item.codigo}
                  onClick={() => {
                    onChange(item.codigo)
                    setIsOpen(false)
                  }}
                  className={`px-4 py-2.5 cursor-pointer flex items-center justify-between gap-3 hover:bg-muted/40 transition-colors ${
                    isSelected ? 'bg-primary/10 font-bold' : ''
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {/* Bandeirinha com a cor configurada no cadastro */}
                    <div 
                      className="w-3.5 h-4.5 rounded-xs shrink-0 shadow-xs border flex items-center justify-center"
                      style={{ 
                        backgroundColor: colorCfg.hex, 
                        borderColor: `${colorCfg.hex}` 
                      }}
                      title={`Cor: ${colorCfg.label}`}
                    >
                      <div className="w-1 h-1 rounded-full bg-white/90 shadow-xs" />
                    </div>

                    {/* Nome do status 100% limpo, sem [SISREG] ou [SisFilaSus] */}
                    <span className="text-foreground truncate font-semibold">
                      {item.nome}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {/* Badge da cor suave */}
                    <span 
                      className="px-2 py-0.5 text-[9px] font-black uppercase rounded-md border"
                      style={{
                        backgroundColor: `${colorCfg.hex}15`,
                        color: colorCfg.hex,
                        borderColor: `${colorCfg.hex}30`
                      }}
                    >
                      {colorCfg.label}
                    </span>

                    {isSelected && (
                      <Check className="h-4 w-4 text-primary stroke-[3]" />
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
