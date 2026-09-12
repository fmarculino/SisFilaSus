import React from 'react'
import { Loader2, Activity } from 'lucide-react'

export default function DashboardLoading() {
  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="h-8 w-60 bg-muted/50 rounded-2xl animate-pulse mb-2" />
          <div className="h-4 w-96 bg-muted/30 rounded-xl animate-pulse" />
        </div>
      </div>

      {/* Banner de carregamento ativo */}
      <div className="p-4 rounded-2xl bg-primary/5 border border-primary/20 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10 text-primary animate-spin">
            <Loader2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-bold text-foreground">
              Carregando Módulo do SisFilaSus...
            </p>
            <p className="text-[11px] text-muted-foreground">
              Buscando informações e preparando a interface.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
          <span className="w-2 h-2 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
          <span className="w-2 h-2 rounded-full bg-primary animate-bounce" />
        </div>
      </div>

      {/* Bento Grid Skeleton */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bento-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="h-3.5 w-24 bg-muted/40 rounded-md animate-pulse" />
              <div className="w-8 h-8 rounded-xl bg-muted/30 animate-pulse" />
            </div>
            <div className="h-8 w-28 bg-muted/50 rounded-xl animate-pulse" />
            <div className="h-3 w-36 bg-muted/30 rounded-md animate-pulse" />
          </div>
        ))}
      </div>

      {/* Bento Card Skeleton Principal */}
      <div className="bento-card p-6 space-y-4">
        <div className="h-5 w-44 bg-muted/50 rounded-lg animate-pulse mb-4" />
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-12 w-full bg-muted/20 rounded-2xl border border-border/20 animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  )
}
