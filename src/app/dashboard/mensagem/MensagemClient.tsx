'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { DashboardShell } from '@/components/layout/DashboardShell'
import { Plus, Edit2, Trash2, X, FileText, Sparkles, MessageSquare, AlertCircle, RefreshCw } from 'lucide-react'
import { Portal } from '@/components/ui/Portal'
import { saveTemplateAction, deleteTemplateAction, seedDefaultTemplatesAction } from './actions'

interface Template {
  id: string
  titulo: string
  corpo: string
  active: boolean
  created_at: string
}

interface MensagemClientProps {
  role: string
  email: string
  templates: Template[]
}

export function MensagemClient({ role, email, templates: initialTemplates }: MensagemClientProps) {
  const router = useRouter()
  const [templates, setTemplates] = useState<Template[]>(initialTemplates)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | undefined>(undefined)

  // Campos do Formulário
  const [titulo, setTitulo] = useState('')
  const [corpo, setCorpo] = useState('')
  const [active, setActive] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [seeding, setSeeding] = useState(false)

  // Variáveis dinâmicas para o operador inserir
  const availableTags = [
    { tag: '{nome_usuario}', label: 'Nome do Paciente', desc: 'Nome completo do cidadão' },
    { tag: '{desc_sigtap}', label: 'Procedimento', desc: 'Descrição do procedimento médico' },
    { tag: '{posicao_fila}', label: 'Posição na Fila', desc: 'Número da posição na fila de espera' },
    { tag: '{data_execucao}', label: 'Data de Execução', desc: 'Data do agendamento / realização' },
    { tag: '{nome_executante}', label: 'Local de Atendimento', desc: 'Unidade de saúde executante' },
    { tag: '{chave_confirmacao}', label: 'Chave de Confirmação', desc: 'Código de agendamento (SISREG)' },
  ]

  const insertTag = (tag: string) => {
    const textarea = document.getElementById('corpo-textarea') as HTMLTextAreaElement
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const text = textarea.value
    const before = text.substring(0, start)
    const after = text.substring(end, text.length)

    setCorpo(before + tag + after)

    // Ajustar foco e cursor
    setTimeout(() => {
      textarea.focus()
      textarea.selectionStart = textarea.selectionEnd = start + tag.length
    }, 50)
  }

  const handleOpenCreate = () => {
    setEditingId(undefined)
    setTitulo('')
    setCorpo('')
    setActive(true)
    setModalOpen(true)
  }

  const handleOpenEdit = (t: Template) => {
    setEditingId(t.id)
    setTitulo(t.titulo)
    setCorpo(t.corpo)
    setActive(t.active)
    setModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!titulo.trim()) {
      alert('O título do modelo é obrigatório.')
      return
    }

    if (!corpo.trim()) {
      alert('O corpo da mensagem é obrigatório.')
      return
    }

    setSubmitting(true)
    try {
      const res = await saveTemplateAction(editingId, {
        titulo,
        corpo,
        active
      })

      if (!res.success) throw new Error(res.error)

      alert(editingId ? 'Modelo atualizado com sucesso!' : 'Modelo cadastrado com sucesso!')
      
      // Recarregar dados
      window.location.reload()
      setModalOpen(false)
    } catch (err: any) {
      alert(err.message || 'Erro ao salvar modelo de mensagem.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Tem certeza de que deseja remover permanentemente o modelo "${title}"?`)) {
      return
    }

    try {
      const res = await deleteTemplateAction(id)
      if (!res.success) throw new Error(res.error)
      setTemplates(prev => prev.filter(t => t.id !== id))
      alert('Modelo removido com sucesso!')
    } catch (err: any) {
      alert(err.message || 'Erro ao remover modelo.')
    }
  }

  const handleSeedDefaults = async () => {
    setSeeding(true)
    try {
      const res = await seedDefaultTemplatesAction()
      if (!res.success) throw new Error(res.error)
      alert('Modelos padrão inseridos com sucesso!')
      window.location.reload()
    } catch (err: any) {
      alert(err.message || 'Erro ao gerar modelos padrão.')
    } finally {
      setSeeding(false)
    }
  }

  // Filtragem de busca local
  const filteredTemplates = templates.filter(t => 
    t.titulo.toLowerCase().includes(search.toLowerCase()) ||
    t.corpo.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <DashboardShell role={role} email={email}>
      <div className="space-y-8 max-w-6xl">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-3xl font-black text-foreground tracking-tighter uppercase">
              Modelos de <span className="text-primary italic">Mensagem</span>
            </h2>
            <p className="text-sm text-muted-foreground mt-2">
              Gerencie os templates de WhatsApp usados pelos operadores nas convocações e buscas ativas.
            </p>
          </div>

          <div className="flex gap-2.5">
            {templates.length === 0 && (
              <button
                onClick={handleSeedDefaults}
                disabled={seeding}
                className="px-5 py-3 rounded-2xl border border-border/60 hover:bg-muted/50 text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer flex items-center gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${seeding ? 'animate-spin' : ''}`} />
                <span>Gerar Modelos Padrão</span>
              </button>
            )}

            <button
              onClick={handleOpenCreate}
              className="px-5 py-3 rounded-2xl bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-widest hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer shadow-md shadow-primary/10 flex items-center gap-2 w-fit shrink-0"
            >
              <Plus className="h-4 w-4" />
              <span>Novo Modelo</span>
            </button>
          </div>
        </div>

        {/* Bento de Busca e Filtro */}
        <div className="bento-card p-6 md:p-8">
          <div className="group">
            <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2 px-1">Buscar Modelo de Mensagem</label>
            <div className="relative">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="block w-full rounded-2xl border border-border/50 bg-background/50 py-3.5 px-4 text-xs text-foreground outline-none focus:border-primary transition-all placeholder:text-muted-foreground/50"
                placeholder="Pesquise por título ou conteúdo das mensagens..."
              />
            </div>
          </div>
        </div>

        {/* Listagem */}
        <div className="grid gap-6 md:grid-cols-2">
          {filteredTemplates.length === 0 ? (
            <div className="bento-card p-12 text-center col-span-2 space-y-4">
              <MessageSquare className="h-10 w-10 text-muted-foreground/40 mx-auto" />
              <div>
                <p className="text-sm font-bold text-foreground">Nenhum modelo de mensagem localizado.</p>
                <p className="text-xs text-muted-foreground mt-1">Crie um novo modelo clicando no botão acima ou gere os modelos padrão.</p>
              </div>
            </div>
          ) : (
            filteredTemplates.map((t) => (
              <div 
                key={t.id} 
                className={`bento-card p-6 flex flex-col justify-between transition-all border ${
                  t.active ? 'border-border/30' : 'border-border/10 opacity-60'
                }`}
              >
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <span className={`px-2 py-0.5 text-[8px] font-black uppercase tracking-wider rounded-md ${
                        t.active ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                      }`}>
                        {t.active ? 'Ativo' : 'Rascunho'}
                      </span>
                      <h4 className="text-sm font-black text-foreground uppercase tracking-tight mt-1">{t.titulo}</h4>
                    </div>

                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={() => handleOpenEdit(t)}
                        className="p-2 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors cursor-pointer"
                        title="Editar"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(t.id, t.titulo)}
                        className="p-2 rounded-lg hover:bg-rose-500/10 text-muted-foreground hover:text-rose-500 transition-colors cursor-pointer"
                        title="Excluir"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="bg-background/40 p-4 rounded-xl border border-border/20">
                    <p className="text-xs font-medium text-muted-foreground leading-relaxed whitespace-pre-wrap font-sans">
                      {t.corpo}
                    </p>
                  </div>
                </div>

                <div className="border-t border-border/10 pt-4 mt-6 flex items-center justify-between text-[9px] font-bold text-muted-foreground/60">
                  <span>Código UUID: {t.id.substring(0, 8)}...</span>
                  <span>Criado em: {new Date(t.created_at).toLocaleDateString('pt-BR')}</span>
                </div>
              </div>
            ))
          )}
        </div>

      </div>

      {/* Drawer Lateral - Formulário de Criação/Edição */}
      {modalOpen && (
        <Portal>
          <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-background/80 backdrop-blur-sm transition-opacity duration-300"
            onClick={() => setModalOpen(false)}
          />
          <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-2xl bg-card border-l border-border/40 shadow-2xl flex flex-col h-full overflow-y-auto animate-in slide-in-from-right duration-350">
              
              {/* Header */}
              <div className="p-6 md:p-8 border-b border-border/10 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Modelador de Resposta</span>
                    <h3 className="text-lg font-black text-foreground uppercase mt-1">
                      {editingId ? 'Editar Modelo' : 'Novo Modelo'}
                    </h3>
                  </div>
                </div>
                <button 
                  onClick={() => setModalOpen(false)}
                  className="p-2 rounded-full hover:bg-muted/50 transition-colors cursor-pointer"
                >
                  <X className="h-5 w-5 text-muted-foreground" />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="flex-1 p-6 md:p-8 flex flex-col justify-between">
                <div className="space-y-6">
                  
                  {/* Título */}
                  <div className="group">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2 px-1">Título do Modelo</label>
                    <input
                      type="text"
                      required
                      value={titulo}
                      onChange={(e) => setTitulo(e.target.value)}
                      className="block w-full rounded-2xl border border-border/50 bg-background/50 py-3.5 px-4 text-xs text-foreground outline-none focus:border-primary transition-all uppercase"
                      placeholder="Ex: CONVOCACAO CONSULTA ORTOPEDIA"
                    />
                  </div>

                  {/* Variáveis Dinâmicas */}
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2 text-primary">
                      <Sparkles className="h-4 w-4" />
                      <span className="text-[10px] font-black uppercase tracking-widest">Variáveis Dinâmicas</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground px-1">
                      Clique em uma das variáveis abaixo para inseri-la automaticamente na posição do cursor no corpo da mensagem:
                    </p>
                    
                    <div className="grid gap-2 grid-cols-2 sm:grid-cols-3">
                      {availableTags.map((t) => (
                        <button
                          key={t.tag}
                          type="button"
                          onClick={() => insertTag(t.tag)}
                          className="p-2.5 text-left border border-border/30 hover:border-primary/40 rounded-xl bg-background/30 hover:bg-primary/5 transition-all text-xs font-semibold cursor-pointer group"
                        >
                          <span className="block font-mono text-[10px] text-primary group-hover:underline">{t.tag}</span>
                          <span className="block text-[9px] text-muted-foreground/60 mt-0.5">{t.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Corpo da Mensagem */}
                  <div className="group">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2 px-1">Corpo da Mensagem (WhatsApp)</label>
                    <textarea
                      id="corpo-textarea"
                      required
                      value={corpo}
                      onChange={(e) => setCorpo(e.target.value)}
                      rows={8}
                      className="block w-full rounded-2xl border border-border/50 bg-background/50 py-3.5 px-4 text-xs text-foreground outline-none focus:border-primary transition-all font-sans leading-relaxed"
                      placeholder="Olá, {nome_usuario}. Sua solicitação de {desc_sigtap} está agendada..."
                    />
                  </div>

                  {/* Status Ativo */}
                  <div className="flex items-center gap-3 px-1">
                    <label className="flex items-center gap-3 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={active}
                        onChange={(e) => setActive(e.target.checked)}
                        className="w-4.5 h-4.5 rounded border-border/50 text-primary bg-background/50 focus:ring-primary focus:ring-2 accent-primary cursor-pointer animate-all"
                      />
                      <span className="text-xs font-black text-foreground uppercase tracking-widest">Modelo Ativo para Uso</span>
                    </label>
                  </div>

                </div>

                {/* Form Actions */}
                <div className="flex gap-3 pt-8 border-t border-border/10 mt-8">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="w-1/2 py-3 border border-border/40 text-muted-foreground hover:bg-muted/50 hover:text-foreground text-[10px] font-black uppercase tracking-widest rounded-xl transition-all cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-1/2 py-3 bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-widest rounded-xl hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer disabled:opacity-50"
                  >
                    {submitting ? 'Salvando...' : 'Salvar Modelo'}
                  </button>
                </div>
              </form>

            </div>
          </div>
        </div>
        </Portal>
      )}
    </DashboardShell>
  )
}
