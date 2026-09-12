import React from 'react'
import { Activity, Loader2 } from 'lucide-react'

export default function FilaLoading() {
  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="h-9 w-64 bg-muted/40 rounded-2xl animate-pulse mb-2" />
          <div className="h-4 w-96 bg-muted/30 rounded-xl animate-pulse" />
        </div>
      </div>

      {/* Card de Filtros Skeleton */}
      <div className="bento-card p-6 md:p-8 space-y-6">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-3 w-24 bg-muted/40 rounded-md animate-pulse" />
              <div className="h-11 w-full bg-muted/20 rounded-2xl border border-border/30 animate-pulse" />
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between pt-4 border-t border-border/20">
          <div className="h-4 w-40 bg-muted/30 rounded-lg animate-pulse" />
          <div className="h-10 w-36 bg-primary/20 rounded-2xl animate-pulse" />
        </div>
      </div>

      {/* Banner de Carregamento Ativo */}
      <div className="p-4 rounded-2xl bg-primary/5 border border-primary/20 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10 text-primary animate-spin">
            <Loader2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-bold text-foreground">
              Carregando a Fila de Regulação...
            </p>
            <p className="text-[11px] text-muted-foreground">
              Consultando solicitações ativas e ordenação oficial do município.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
          <span className="w-2 h-2 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
          <span className="w-2 h-2 rounded-full bg-primary animate-bounce" />
        </div>
      </div>

      {/* Tabela Skeleton */}
      <div className="bento-card overflow-hidden">
        <div className="p-6 border-b border-border/40">
          <div className="h-4 w-48 bg-muted/40 rounded-lg animate-pulse" />
        </div>
        <div className="divide-y divide-border/20">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="p-4 sm:p-5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-4 flex-1">
                <div className="w-10 h-10 rounded-xl bg-muted/30 shrink-0 animate-pulse" />
                <div className="space-y-2 flex-1 max-w-sm">
                  <div className="h-4 w-3/4 bg-muted/40 rounded animate-pulse" />
                  <div className="h-3 w-1/2 bg-muted/20 rounded animate-pulse" />
                </div>
              </div>
              <div className="h-4 w-28 bg-muted/30 rounded hidden sm:block animate-pulse" />
              <div className="h-6 w-20 bg-muted/30 rounded-lg animate-pulse" />
              <div className="h-8 w-16 bg-muted/30 rounded-xl animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
