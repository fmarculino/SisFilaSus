'use client'

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { ChevronDown, Check, X } from 'lucide-react'
import { StatusItem, getStatusColorConfig } from './StatusBadge'
import { Portal } from './Portal'

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
  const buttonRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const [coords, setCoords] = useState<{ top: number; left: number; width: number; openUp: boolean }>({
    top: 0,
    left: 0,
    width: 0,
    openUp: false,
  })

  // Encontra o status selecionado
  const selectedItem = useMemo(() => {
    return statusList.find(s => s.codigo === value)
  }, [statusList, value])

  // Lista de opções ativas ou da atualmente selecionada
  const visibleOptions = useMemo(() => {
    return statusList.filter(s => s.active !== false || s.codigo === value)
  }, [statusList, value])

  // Atualiza posição do dropdown com base na posição do botão na janela
  const updatePosition = useCallback(() => {
    if (!buttonRef.current) return
    const rect = buttonRef.current.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom
    const openUp = spaceBelow < 260 && rect.top > 260

    setCoords({
      top: openUp ? rect.top : rect.bottom,
      left: rect.left,
      width: rect.width,
      openUp,
    })
  }, [])

  // Atualiza posição ao abrir e escuta scroll/resize
  useEffect(() => {
    if (!isOpen) return

    updatePosition()

    const handleScrollOrResize = () => {
      updatePosition()
    }

    window.addEventListener('scroll', handleScrollOrResize, true)
    window.addEventListener('resize', handleScrollOrResize)

    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true)
      window.removeEventListener('resize', handleScrollOrResize)
    }
  }, [isOpen, updatePosition])

  // Fecha dropdown ao clicar fora do botão ou do menu
  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      if (
        buttonRef.current &&
        !buttonRef.current.contains(target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(target)
      ) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  const selectedColorCfg = selectedItem ? getStatusColorConfig(selectedItem.cor) : null

  return (
    <div className={`relative w-full ${className}`}>
      {/* Botão Seletor Principal */}
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!isOpen) updatePosition()
          setIsOpen(!isOpen)
        }}
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
              {/* Quadradinho com a cor configurada no cadastro */}
              <span
                className="w-3.5 h-3.5 rounded-md shrink-0 shadow-xs border"
                style={{
                  backgroundColor: selectedColorCfg.hex,
                  borderColor: selectedColorCfg.hex,
                }}
                aria-hidden="true"
              />

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
              className="p-1 rounded-full hover:bg-muted text-muted-foreground/60 hover:text-foreground cursor-pointer transition-colors"
              title="Limpar seleção"
            >
              <X className="h-3.5 w-3.5" />
            </span>
          )}
          <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isOpen ? 'rotate-180 text-primary' : ''}`} />
        </div>
      </button>

      {/* Menu Dropdown via Portal (Z-index 9999 - NUNCA fica por trás de cards ou modais) */}
      {isOpen && (
        <Portal>
          <div
            ref={dropdownRef}
            className="fixed z-[9999] rounded-2xl border border-border/70 bg-card/95 backdrop-blur-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
            style={{
              top: coords.openUp ? undefined : coords.top + 6,
              bottom: coords.openUp ? window.innerHeight - coords.top + 6 : undefined,
              left: coords.left,
              width: coords.width,
              maxHeight: 280,
            }}
          >
            <ul className="max-h-64 overflow-y-auto py-1.5 text-xs divide-y divide-border/10">
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
                  <span className="w-3.5 h-3.5 rounded-md border border-dashed border-border/60 bg-muted/40 shrink-0" />
                  <span className="font-semibold">{placeholder}</span>
                </div>
                {!value && <Check className="h-4 w-4 text-primary stroke-[3]" />}
              </li>

              {/* Lista com quadradinho colorido do lado esquerdo (sem tags do lado direito) */}
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
                      {/* Quadradinho com a cor cadastrada do lado esquerdo */}
                      <span
                        className="w-3.5 h-3.5 rounded-md shrink-0 shadow-xs border"
                        style={{
                          backgroundColor: colorCfg.hex,
                          borderColor: colorCfg.hex,
                        }}
                        aria-hidden="true"
                      />

                      {/* Nome do status limpo */}
                      <span className="text-foreground truncate font-semibold">
                        {item.nome}
                      </span>
                    </div>

                    {/* Apenas o Check caso selecionado (sem tag de cor no lado direito) */}
                    {isSelected && (
                      <Check className="h-4 w-4 text-primary stroke-[3] shrink-0" />
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        </Portal>
      )}
    </div>
  )
}
