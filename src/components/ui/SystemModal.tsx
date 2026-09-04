'use client'

import React, { createContext, useContext, useState, useCallback } from 'react'
import { Portal } from './Portal'
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X, ShieldAlert } from 'lucide-react'

export type ModalType = 'success' | 'error' | 'warning' | 'info'

export interface AlertOptions {
  title?: string
  message: string
  type?: ModalType
  buttonText?: string
  onClose?: () => void
}

export interface ConfirmOptions {
  title?: string
  message: string
  confirmText?: string
  cancelText?: string
  variant?: 'danger' | 'warning' | 'primary' | 'success'
}

interface ModalContextType {
  showAlert: (options: AlertOptions | string, title?: string, type?: ModalType) => Promise<void>
  showConfirm: (options: ConfirmOptions | string, title?: string) => Promise<boolean>
}

const SystemModalContext = createContext<ModalContextType | null>(null)

export function SystemModalProvider({ children }: { children: React.ReactNode }) {
  // Alert State
  const [alertState, setAlertState] = useState<{
    open: boolean
    title: string
    message: string
    type: ModalType
    buttonText: string
    resolve?: () => void
  }>({
    open: false,
    title: '',
    message: '',
    type: 'info',
    buttonText: 'OK',
  })

  // Confirm State
  const [confirmState, setConfirmState] = useState<{
    open: boolean
    title: string
    message: string
    confirmText: string
    cancelText: string
    variant: 'danger' | 'warning' | 'primary' | 'success'
    resolve?: (value: boolean) => void
  }>({
    open: false,
    title: '',
    message: '',
    confirmText: 'Confirmar',
    cancelText: 'Cancelar',
    variant: 'primary',
  })

  const showAlert = useCallback((options: AlertOptions | string, customTitle?: string, customType?: ModalType): Promise<void> => {
    return new Promise((resolve) => {
      let opts: AlertOptions
      if (typeof options === 'string') {
        opts = {
          message: options,
          title: customTitle,
          type: customType || 'info',
        }
      } else {
        opts = options
      }

      setAlertState({
        open: true,
        title: opts.title || (opts.type === 'error' ? 'Atenção / Erro' : opts.type === 'success' ? 'Sucesso' : 'Notificação do Sistema'),
        message: opts.message,
        type: opts.type || 'info',
        buttonText: opts.buttonText || 'Entendido',
        resolve,
      })
    })
  }, [])

  const handleCloseAlert = () => {
    if (alertState.resolve) alertState.resolve()
    setAlertState((prev) => ({ ...prev, open: false }))
  }

  const showConfirm = useCallback((options: ConfirmOptions | string, customTitle?: string): Promise<boolean> => {
    return new Promise((resolve) => {
      let opts: ConfirmOptions
      if (typeof options === 'string') {
        opts = {
          message: options,
          title: customTitle,
        }
      } else {
        opts = options
      }

      setConfirmState({
        open: true,
        title: opts.title || 'Confirmação Necessária',
        message: opts.message,
        confirmText: opts.confirmText || 'Confirmar',
        cancelText: opts.cancelText || 'Cancelar',
        variant: opts.variant || 'primary',
        resolve,
      })
    })
  }, [])

  const handleConfirmChoice = (choice: boolean) => {
    if (confirmState.resolve) confirmState.resolve(choice)
    setConfirmState((prev) => ({ ...prev, open: false }))
  }

  const getAlertIcon = (type: ModalType) => {
    switch (type) {
      case 'success':
        return <CheckCircle2 className="h-6 w-6 text-emerald-500 shrink-0" />
      case 'error':
        return <AlertCircle className="h-6 w-6 text-rose-500 shrink-0" />
      case 'warning':
        return <AlertTriangle className="h-6 w-6 text-amber-500 shrink-0" />
      case 'info':
      default:
        return <Info className="h-6 w-6 text-sky-500 shrink-0" />
    }
  }

  const getConfirmIcon = (variant: string) => {
    switch (variant) {
      case 'danger':
        return <ShieldAlert className="h-6 w-6 text-rose-500 shrink-0" />
      case 'warning':
        return <AlertTriangle className="h-6 w-6 text-amber-500 shrink-0" />
      case 'success':
        return <CheckCircle2 className="h-6 w-6 text-emerald-500 shrink-0" />
      default:
        return <Info className="h-6 w-6 text-primary shrink-0" />
    }
  }

  return (
    <SystemModalContext.Provider value={{ showAlert, showConfirm }}>
      {children}

      {/* Alert Modal Portal */}
      {alertState.open && (
        <Portal>
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="relative max-w-md w-full rounded-3xl bg-card text-card-foreground border border-border/80 shadow-[0_25px_70px_rgba(0,0,0,0.3)] p-6 md:p-8 space-y-6 animate-in zoom-in-95 duration-200 overflow-hidden">
              {/* Top Accent Strip */}
              <div className={`absolute top-0 left-0 right-0 h-1.5 ${
                alertState.type === 'success' ? 'bg-emerald-500' :
                alertState.type === 'error' ? 'bg-rose-500' :
                alertState.type === 'warning' ? 'bg-amber-500' :
                'bg-sky-500'
              }`} />

              <div className="flex items-start gap-4 pt-1">
                <div className={`p-3 rounded-2xl border shrink-0 ${
                  alertState.type === 'success' ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-400' :
                  alertState.type === 'error' ? 'bg-rose-500/15 border-rose-500/30 text-rose-600 dark:text-rose-400' :
                  alertState.type === 'warning' ? 'bg-amber-500/15 border-amber-500/30 text-amber-600 dark:text-amber-400' :
                  'bg-sky-500/15 border-sky-500/30 text-sky-600 dark:text-sky-400'
                }`}>
                  {getAlertIcon(alertState.type)}
                </div>

                <div className="flex-1 space-y-1.5 pr-2">
                  <h3 className="text-sm font-black uppercase tracking-wider text-foreground">
                    {alertState.title}
                  </h3>
                  <p className="text-xs text-foreground/80 dark:text-foreground/90 font-medium leading-relaxed whitespace-pre-line">
                    {alertState.message}
                  </p>
                </div>

                <button
                  onClick={handleCloseAlert}
                  className="text-muted-foreground hover:text-foreground p-1.5 transition-colors cursor-pointer rounded-xl hover:bg-muted/80 border border-transparent hover:border-border/50"
                  aria-label="Fechar"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={handleCloseAlert}
                  className={`w-full sm:w-auto px-7 py-3 rounded-xl text-xs font-black uppercase tracking-widest text-white shadow-lg transition-all cursor-pointer hover:brightness-110 active:scale-95 ${
                    alertState.type === 'success' ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/30' :
                    alertState.type === 'error' ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/30' :
                    alertState.type === 'warning' ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/30' :
                    'bg-primary hover:bg-primary/90 shadow-primary/30'
                  }`}
                >
                  {alertState.buttonText}
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}

      {/* Confirm Modal Portal */}
      {confirmState.open && (
        <Portal>
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="relative max-w-md w-full rounded-3xl bg-card text-card-foreground border border-border/80 shadow-[0_25px_70px_rgba(0,0,0,0.3)] p-6 md:p-8 space-y-6 animate-in zoom-in-95 duration-200 overflow-hidden">
              {/* Top Accent Strip */}
              <div className={`absolute top-0 left-0 right-0 h-1.5 ${
                confirmState.variant === 'danger' ? 'bg-rose-500' :
                confirmState.variant === 'warning' ? 'bg-amber-500' :
                confirmState.variant === 'success' ? 'bg-emerald-500' :
                'bg-primary'
              }`} />

              <div className="flex items-start gap-4 pt-1">
                <div className={`p-3 rounded-2xl border shrink-0 ${
                  confirmState.variant === 'danger' ? 'bg-rose-500/15 border-rose-500/30 text-rose-600 dark:text-rose-400' :
                  confirmState.variant === 'warning' ? 'bg-amber-500/15 border-amber-500/30 text-amber-600 dark:text-amber-400' :
                  confirmState.variant === 'success' ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-400' :
                  'bg-primary/15 border-primary/30 text-primary'
                }`}>
                  {getConfirmIcon(confirmState.variant)}
                </div>

                <div className="flex-1 space-y-1.5">
                  <h3 className="text-sm font-black uppercase tracking-wider text-foreground">
                    {confirmState.title}
                  </h3>
                  <p className="text-xs text-foreground/80 dark:text-foreground/90 font-medium leading-relaxed whitespace-pre-line">
                    {confirmState.message}
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => handleConfirmChoice(false)}
                  className="px-5 py-3 rounded-xl border border-border/80 bg-muted/40 text-xs font-black uppercase tracking-widest text-foreground hover:bg-muted hover:border-border transition-all cursor-pointer shadow-xs"
                >
                  {confirmState.cancelText}
                </button>
                <button
                  type="button"
                  onClick={() => handleConfirmChoice(true)}
                  className={`px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest text-white shadow-lg transition-all cursor-pointer hover:brightness-110 active:scale-95 ${
                    confirmState.variant === 'danger' ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/30' :
                    confirmState.variant === 'warning' ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/30' :
                    confirmState.variant === 'success' ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/30' :
                    'bg-primary hover:bg-primary/90 shadow-primary/30'
                  }`}
                >
                  {confirmState.confirmText}
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}
    </SystemModalContext.Provider>
  )
}

export function useSystemModal() {
  const context = useContext(SystemModalContext)
  if (!context) {
    throw new Error('useSystemModal deve ser usado dentro de um SystemModalProvider')
  }
  return context
}
