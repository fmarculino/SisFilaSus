'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { Stethoscope, Mail, ArrowLeft, CheckCircle2, AlertCircle, Send } from 'lucide-react'
import { requestPasswordResetAction } from './actions'

export default function EsqueciASenhaPage() {
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      const res = await requestPasswordResetAction(email)
      if (!res.success) {
        throw new Error(res.error)
      }
      setSent(true)
    } catch (err: any) {
      setError(err.message || 'Erro ao enviar e-mail de recuperação.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-12 sm:px-6 lg:px-8">
      {/* Background Blurs */}
      <div className="absolute top-0 -left-4 w-72 h-72 bg-primary/20 rounded-full blur-[120px] animate-pulse" />
      <div className="absolute bottom-0 -right-4 w-96 h-96 bg-accent/20 rounded-full blur-[140px] animate-pulse delay-1000" />

      <div className="relative w-full max-w-[440px]">
        <div className="bento-card p-10 md:p-12">
          {/* Top Logo */}
          <div className="flex flex-col items-center">
            <div className="group relative flex h-20 w-20 items-center justify-center rounded-[2rem] bg-primary shadow-2xl shadow-primary/30">
              <Stethoscope className="h-10 w-10 text-primary-foreground" />
            </div>

            <div className="mt-6 text-center">
              <h2 className="text-3xl font-black tracking-tighter text-foreground uppercase">
                Recuperar <span className="text-primary italic">Acesso</span>
              </h2>
              <p className="mt-2 text-xs text-muted-foreground">
                Informe o seu e-mail cadastrado no SisFilaSUS para receber as instruções de redefinição de senha.
              </p>
            </div>
          </div>

          {sent ? (
            <div className="mt-8 space-y-6 animate-in fade-in zoom-in-95 duration-300">
              <div className="p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center space-y-3">
                <div className="flex justify-center text-emerald-500">
                  <CheckCircle2 className="h-12 w-12" />
                </div>
                <h3 className="text-sm font-black uppercase text-foreground">E-mail Enviado!</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Enviamos um link seguro de recuperação para <strong className="text-foreground">{email}</strong>. Verifique sua caixa de entrada e spam.
                </p>
              </div>

              <Link
                href="/login"
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-border/50 bg-background/50 py-4 text-xs font-black uppercase tracking-widest text-foreground hover:bg-accent/10 transition-all"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Voltar para o Login</span>
              </Link>
            </div>
          ) : (
            <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
              <div className="group">
                <label htmlFor="email" className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2 px-1 group-focus-within:text-primary transition-colors">
                  E-mail de Cadastro
                </label>
                <div className="relative">
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full rounded-2xl border border-border/50 bg-background/50 py-4 px-5 pr-12 text-sm text-foreground outline-none ring-primary/20 transition-all focus:border-primary focus:ring-4 placeholder:text-muted-foreground/50"
                    placeholder="exemplo@saude.gov.br"
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/30">
                    <Mail className="h-4 w-4" />
                  </div>
                </div>
              </div>

              {error && (
                <div className="text-[10px] text-destructive font-black uppercase tracking-widest bg-destructive/5 py-3 px-4 rounded-xl border border-destructive/20 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-primary py-4 px-4 text-xs font-black uppercase tracking-[0.2em] text-primary-foreground shadow-xl shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
                <span>{submitting ? 'Enviando...' : 'Enviar Link de Recuperação'}</span>
              </button>

              <div className="pt-2 text-center">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Retornar à tela de autenticação</span>
                </Link>
              </div>
            </form>
          )}

          {/* Footer */}
          <div className="mt-8 pt-6 border-t border-border/10 text-center">
            <span className="text-[9px] font-black uppercase tracking-[0.3em] text-muted-foreground/60">
              SMS Marabá • SisFilaSUS
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
