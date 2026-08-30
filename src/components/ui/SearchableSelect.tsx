'use client'

import React, { useState, useRef, useEffect, useMemo } from 'react'
import { Search, ChevronDown, X, Check } from 'lucide-react'

export interface SearchableOption {
  value: string
  label: string
  subLabel?: string
  badge?: string
  data?: any
}

interface SearchableSelectProps {
  options: SearchableOption[]
  value?: string
  onChange: (value: string, selectedOption?: SearchableOption) => void
  placeholder?: string
  searchPlaceholder?: string
  disabled?: boolean
  required?: boolean
  className?: string
  buttonClassName?: string
  clearable?: boolean
  emptyMessage?: string
  renderOption?: (option: SearchableOption, isSelected: boolean) => React.ReactNode
  maxVisible?: number
}

// Normalizador para ignorar acentos e maiúsculas
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Selecione uma opção...',
  searchPlaceholder = 'Digite para buscar...',
  disabled = false,
  required = false,
  className = '',
  buttonClassName = '',
  clearable = true,
  emptyMessage = 'Nenhum resultado encontrado',
  renderOption,
  maxVisible = 50
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [highlightedIndex, setHighlightedIndex] = useState(0)

  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  // Encontra a opção atualmente selecionada
  const selectedOption = useMemo(() => {
    return options.find(o => o.value === value)
  }, [options, value])

  // Filtragem incremental instantânea
  const filteredOptions = useMemo(() => {
    if (!search.trim()) return options
    const query = normalizeText(search.trim())
    return options.filter(option => {
      const matchLabel = normalizeText(option.label).includes(query)
      const matchSub = option.subLabel ? normalizeText(option.subLabel).includes(query) : false
      const matchValue = normalizeText(option.value).includes(query)
      const matchBadge = option.badge ? normalizeText(option.badge).includes(query) : false
      return matchLabel || matchSub || matchValue || matchBadge
    })
  }, [options, search])

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

  // Foco no input de busca ao abrir
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus()
      }, 50)
      setHighlightedIndex(0)
    }
  }, [isOpen])

  // Rola item destacado na lista
  useEffect(() => {
    if (isOpen && listRef.current && listRef.current.children[highlightedIndex]) {
      const el = listRef.current.children[highlightedIndex] as HTMLElement
      el.scrollIntoView({ block: 'nearest' })
    }
  }, [highlightedIndex, isOpen])

  const handleSelect = (option: SearchableOption) => {
    onChange(option.value, option)
    setIsOpen(false)
    setSearch('')
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange('', undefined)
    setSearch('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return

    if (!isOpen) {
      if (e.key === 'Enter' || e.key === 'ArrowDown' || e.key === ' ') {
        e.preventDefault()
        setIsOpen(true)
      }
      return
    }

    if (e.key === 'Escape') {
      e.preventDefault()
      setIsOpen(false)
      setSearch('')
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightedIndex(prev => (prev < filteredOptions.length - 1 ? prev + 1 : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightedIndex(prev => (prev > 0 ? prev - 1 : filteredOptions.length - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filteredOptions[highlightedIndex]) {
        handleSelect(filteredOptions[highlightedIndex])
      }
    }
  }

  return (
    <div className={`relative w-full ${className}`} ref={containerRef}>
      {/* Botão Gatilho do Seletor */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(prev => !prev)}
        onKeyDown={handleKeyDown}
        className={`
          flex w-full items-center justify-between gap-2 rounded-2xl border text-left transition-all duration-200 outline-none
          ${disabled ? 'opacity-50 cursor-not-allowed bg-muted/20 border-border/30' : 'cursor-pointer hover:border-primary/50'}
          ${isOpen ? 'border-primary ring-2 ring-primary/20 bg-background' : 'border-border/50 bg-background/50'}
          py-3 px-4 text-xs font-medium text-foreground
          ${buttonClassName}
        `}
      >
        <div className="flex-1 min-w-0 truncate">
          {selectedOption ? (
            <div className="flex items-center gap-2 truncate">
              <span className="font-bold text-foreground truncate">
                {selectedOption.label}
              </span>
              {selectedOption.subLabel && (
                <span className="text-[10px] text-muted-foreground truncate font-mono">
                  ({selectedOption.subLabel})
                </span>
              )}
              {selectedOption.badge && (
                <span className="px-1.5 py-0.5 text-[9px] font-black uppercase rounded bg-primary/10 text-primary shrink-0">
                  {selectedOption.badge}
                </span>
              )}
            </div>
          ) : (
            <span className="text-muted-foreground/60 select-none">
              {placeholder}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0 text-muted-foreground/60">
          {clearable && selectedOption && !disabled && (
            <span
              role="button"
              onClick={handleClear}
              className="p-1 rounded-full hover:bg-muted/80 hover:text-foreground transition-colors cursor-pointer"
              title="Limpar seleção"
            >
              <X className="h-3.5 w-3.5" />
            </span>
          )}
          <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isOpen ? 'rotate-180 text-primary' : ''}`} />
        </div>
      </button>

      {/* Dropdown com Busca Incremental */}
      {isOpen && (
        <div className="absolute z-50 mt-1.5 w-full rounded-2xl border border-border/60 bg-background/95 backdrop-blur-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Caixa de Busca com Ícone */}
          <div className="p-2 border-b border-border/40 bg-muted/20">
            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={e => {
                  setSearch(e.target.value)
                  setHighlightedIndex(0)
                }}
                onKeyDown={handleKeyDown}
                placeholder={searchPlaceholder}
                className="w-full rounded-xl border border-border/50 bg-background py-2 pl-8 pr-8 text-xs text-foreground outline-none focus:border-primary placeholder:text-muted-foreground/50 transition-all font-medium"
              />
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
              {search && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch('')
                    inputRef.current?.focus()
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-muted-foreground/50 hover:text-foreground transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Lista de Opções Filtradas */}
          <ul
            ref={listRef}
            className="max-h-60 overflow-y-auto py-1.5 text-xs divide-y divide-border/5 no-scrollbar"
          >
            {clearable && !search && (
              <li
                onClick={() => {
                  onChange('', undefined)
                  setIsOpen(false)
                }}
                className={`px-4 py-2.5 cursor-pointer text-[10px] font-black uppercase tracking-wider transition-colors text-muted-foreground hover:bg-muted/50 ${
                  !value ? 'bg-primary/10 text-primary font-bold' : ''
                }`}
              >
                {placeholder}
              </li>
            )}

            {filteredOptions.length === 0 ? (
              <li className="px-4 py-6 text-center text-xs text-muted-foreground select-none">
                {emptyMessage}
              </li>
            ) : (
              filteredOptions.slice(0, maxVisible).map((option, idx) => {
                const isSelected = option.value === value
                const isHighlighted = idx === highlightedIndex

                if (renderOption) {
                  return (
                    <li
                      key={option.value}
                      onClick={() => handleSelect(option)}
                      onMouseEnter={() => setHighlightedIndex(idx)}
                      className={`cursor-pointer transition-colors ${
                        isHighlighted ? 'bg-primary/10' : ''
                      } ${isSelected ? 'bg-primary/15' : ''}`}
                    >
                      {renderOption(option, isSelected)}
                    </li>
                  )
                }

                return (
                  <li
                    key={option.value}
                    onClick={() => handleSelect(option)}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    className={`px-4 py-2.5 cursor-pointer transition-colors flex items-center justify-between gap-3 ${
                      isHighlighted ? 'bg-primary/10' : 'hover:bg-muted/40'
                    } ${isSelected ? 'bg-primary/15 font-bold' : ''}`}
                  >
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <span className="text-foreground truncate font-medium">
                        {option.label}
                      </span>
                      {option.subLabel && (
                        <span className="text-[10px] text-muted-foreground/70 font-mono truncate">
                          {option.subLabel}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {option.badge && (
                        <span className="px-2 py-0.5 text-[9px] font-black uppercase rounded-lg bg-muted text-muted-foreground border border-border/40">
                          {option.badge}
                        </span>
                      )}
                      {isSelected && (
                        <Check className="h-4 w-4 text-primary stroke-[3]" />
                      )}
                    </div>
                  </li>
                )
              })
            )}

            {filteredOptions.length > maxVisible && (
              <li className="px-4 py-2 text-center text-[10px] text-muted-foreground/60 bg-muted/10">
                Mostrando {maxVisible} de {filteredOptions.length} resultados. Refine sua busca.
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
