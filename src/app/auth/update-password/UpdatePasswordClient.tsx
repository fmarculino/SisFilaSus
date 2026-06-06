'use client'

import React, { useState } from 'react'
import { DashboardShell } from '@/components/layout/DashboardShell'
import { Lock, Key, Eye, EyeOff, Save, Info, ShieldCheck } from 'lucide-react'
import { updatePasswordAction } from './actions'

interface UpdatePasswordClientProps {
  role: string
  email: string
}

export function UpdatePasswordClient({ role, email }: UpdatePasswordClientProps) {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)

    if (password.length < 6) {
      setMessage({ type: 'error', text: 'A nova senha deve ter no mínimo 6 caracteres.' })
      return
    }

    if (password !== confirmPassword) {
      setMessage({ type: 'error', text: 'As senhas informadas não coincidem.' })
      return
    }

    setSubmitting(true)
    try {
      const res = await updatePasswordAction(password)
      if (!res.success) {
        throw new Error(res.error)
      }

      setMessage({ type: 'success', text: 'Sua senha foi atualizada com sucesso!' })
      setPassword('')
      setConfirmPassword('')
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Erro ao atualizar a senha.' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <DashboardShell role={role} email={email}>
      <div className="space-y-8 max-w-xl">
        
        {/* Header */}
        <div>
          <h2 className="text-3xl font-black text-foreground tracking-tighter uppercase">
            Acesso & <span className="text-primary italic">Segurança</span>
          </h2>
          <p className="text-sm text-muted-foreground mt-2">
            Altere as suas credenciais de segurança e redefina a sua senha de acesso ao sistema.
          </p>
        </div>

        {/* Feedback Alert */}
        {message && (
          <div className={`p-4 rounded-2xl border text-xs font-bold uppercase tracking-wide animate-in fade-in slide-in-from-top-2 duration-300 ${
            message.type === 'success' 
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' 
              : 'bg-rose-500/10 border-rose-500/20 text-rose-500'
          }`}>
            <div className="flex items-center gap-2">
              {message.type === 'success' ? (
                <ShieldCheck className="h-4 w-4 shrink-0" />
              ) : (
                <Info className="h-4 w-4 shrink-0" />
              )}
              <span>{message.text}</span>
            </div>
          </div>
        )}

        {/* Form Container */}
        <div className="bento-card p-6 md:p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* E-mail de Login (Readonly) */}
            <div className="group opacity-70">
              <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2 px-1">
                E-mail da sua Conta
              </label>
              <input
                type="text"
                disabled
                value={email}
                className="block w-full rounded-2xl border border-border/50 bg-muted/10 py-3.5 px-4 text-xs text-muted-foreground font-mono outline-none cursor-not-allowed"
              />
            </div>

            {/* Nova Senha */}
            <div className="group">
              <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2 px-1">
                Nova Senha
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full rounded-2xl border border-border/50 bg-background/50 py-3.5 px-4 pr-10 text-xs text-foreground outline-none focus:border-primary transition-all"
                  placeholder="Mínimo de 6 caracteres"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/30 hover:text-muted-foreground transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Confirmar Nova Senha */}
            <div className="group">
              <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2 px-1">
                Confirmar Nova Senha
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="block w-full rounded-2xl border border-border/50 bg-background/50 py-3.5 px-4 pr-10 text-xs text-foreground outline-none focus:border-primary transition-all"
                  placeholder="Repita a nova senha"
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/30">
                  <Key className="h-4 w-4" />
                </div>
              </div>
            </div>

            {/* Submit */}
            <div className="flex justify-end pt-4 border-t border-border/10">
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-3.5 bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-widest rounded-xl hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer disabled:opacity-50 shadow-md shadow-primary/10 flex items-center gap-2"
              >
                <Save className="h-4.5 w-4.5" />
                <span>{submitting ? 'Salvando...' : 'Atualizar Senha'}</span>
              </button>
            </div>

          </form>
        </div>

      </div>
    </DashboardShell>
  )
}
