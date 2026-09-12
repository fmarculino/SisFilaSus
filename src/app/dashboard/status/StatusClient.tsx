'use client'

import React, { useState, useMemo } from 'react'
import { DashboardShell } from '@/components/layout/DashboardShell'
import { 
  Plus, Edit2, X, Check, Search, Tag, 
  CheckCircle2, Power, ShieldCheck, Palette, Info
} from 'lucide-react'
import { Portal } from '@/components/ui/Portal'
import { useSystemModal } from '@/components/ui/SystemModal'
import { StatusBadge, STATUS_COLORS_MAP, StatusItem } from '@/components/ui/StatusBadge'
import { saveStatusAction, toggleStatusActiveAction } from './actions'

interface StatusClientProps {
  role: string
  email: string
  initialStatusList: StatusItem[]
}

export function StatusClient({ role, email, initialStatusList }: StatusClientProps) {
  const { showAlert } = useSystemModal()
  const [statusList, setStatusList] = useState<StatusItem[]>(initialStatusList)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<StatusItem | null>(null)

  // Form states
  const [codigo, setCodigo] = useState('')
  const [nome, setNome] = useState('')
  const [origem, setOrigem] = useState('SisFilaSus')
  const [cor, setCor] = useState('blue')
  const [descricao, setDescricao] = useState('')
  const [active, setActive] = useState(true)
  const [ordem, setOrdem] = useState(50)
  const [submitting, setSubmitting] = useState(false)

  // Filtro
  const filteredStatus = useMemo(() => {
    if (!search.trim()) return statusList
    const q = search.toLowerCase()
    return statusList.filter(s => 
      s.nome.toLowerCase().includes(q) || 
      s.codigo.toLowerCase().includes(q) ||
      (s.descricao && s.descricao.toLowerCase().includes(q))
    )
  }, [statusList, search])

  const handleOpenCreate = () => {
    setEditingItem(null)
    setCodigo('')
    setNome('')
    setOrigem('SisFilaSus')
    setCor('emerald')
    setDescricao('')
    setActive(true)
    setOrdem(statusList.length * 10 + 10)
    setModalOpen(true)
  }

  const handleOpenEdit = (item: StatusItem) => {
    setEditingItem(item)
    setCodigo(item.codigo)
    setNome(item.nome)
    setOrigem(item.origem || 'SisFilaSus')
    setCor(item.cor || 'blue')
    setDescricao(item.descricao || '')
    setActive(item.active ?? true)
    setOrdem(item.ordem ?? 50)
    setModalOpen(true)
  }

  const handleNomeChange = (val: string) => {
    setNome(val)
    // Se for novo cadastro, gerar sugestão automática de código
    if (!editingItem) {
      const generated = val
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
      setCodigo(generated)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!nome.trim()) {
      await showAlert({
        title: 'Nome Obrigatório',
        message: 'Por favor, informe o nome descritivo do status.',
        type: 'warning'
      })
      return
    }

    if (!codigo.trim()) {
      await showAlert({
        title: 'Código Obrigatório',
        message: 'Por favor, informe o código identificador do status.',
        type: 'warning'
      })
      return
    }

    setSubmitting(true)
    try {
      const saved = await saveStatusAction(editingItem?.id, {
        codigo,
        nome,
        origem,
        cor,
        descricao,
        active,
        ordem
      })

      await showAlert({
        title: 'Sucesso',
        message: editingItem ? 'Status atualizado com sucesso!' : 'Novo status cadastrado com sucesso!',
        type: 'success'
      })

      // Atualizar lista local
      if (editingItem) {
        setStatusList(prev => prev.map(s => s.id === editingItem.id ? { ...s, ...saved } : s))
      } else {
        setStatusList(prev => [...prev, saved])
      }

      setModalOpen(false)
    } catch (err: any) {
      await showAlert({
        title: 'Erro ao Salvar',
        message: err.message || 'Falha ao salvar status.',
        type: 'error'
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleToggleActive = async (item: StatusItem) => {
    try {
      if (!item.id) return
      const res = await toggleStatusActiveAction(item.id, item.active ?? true)
      setStatusList(prev => prev.map(s => s.id === item.id ? { ...s, active: res.active } : s))
    } catch (err: any) {
      await showAlert({
        title: 'Erro',
        message: err.message || 'Falha ao alterar situação do status.',
        type: 'error'
      })
    }
  }

  return (
    <DashboardShell role={role} email={email}>
      <div className="space-y-8">
        {/* Cabeçalho */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-3xl font-black text-foreground tracking-tighter uppercase">
              Status da <span className="text-primary italic">Fila</span>
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Gerencie a lista de status operacionais e suas respectivas cores de destaque visual.
            </p>
          </div>

          <button
            type="button"
            onClick={handleOpenCreate}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-primary text-primary-foreground text-xs font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Status</span>
          </button>
        </div>

        {/* Banner Informativo sobre Desativação sem Exclusão */}
        <div className="bento-card p-5 bg-card/60 border border-primary/20">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary shrink-0 mt-0.5">
              <Info className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-foreground">Regra de Segurança de Dados e Histórico</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Os itens de status não podem ser excluídos fisicamente para proteger a rastreabilidade e a integridade de solicitações antigas. 
                Caso um status não deva mais ser utilizado pela equipe, basta <strong>desativá-lo</strong>. Status inativos não aparecerão mais nos menus e seletores da fila.
              </p>
            </div>
          </div>
        </div>

        {/* Tabela de Status */}
        <div className="bento-card overflow-hidden">
          <div className="p-6 border-b border-border/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nome, código ou descrição..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-background/50 border border-border/50 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary transition-all"
              />
            </div>
            <span className="text-xs text-muted-foreground font-semibold">
              {filteredStatus.length} status cadastrado{filteredStatus.length !== 1 ? 's' : ''}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border/40 bg-muted/20 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                  <th className="py-3.5 px-6">Identificação Visual</th>
                  <th className="py-3.5 px-6">Código Técnico</th>
                  <th className="py-3.5 px-6">Origem</th>
                  <th className="py-3.5 px-6">Descrição</th>
                  <th className="py-3.5 px-6 text-center">Situação</th>
                  <th className="py-3.5 px-6 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20 text-xs">
                {filteredStatus.map((item) => (
                  <tr 
                    key={item.id || item.codigo} 
                    className={`hover:bg-muted/30 transition-colors ${!item.active ? 'opacity-50' : ''}`}
                  >
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <StatusBadge 
                          codigo={item.codigo} 
                          nome={item.nome} 
                          cor={item.cor} 
                        />
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className="font-mono text-[11px] text-muted-foreground font-semibold">
                        {item.codigo}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-[11px] font-medium text-foreground">
                        {item.origem || 'SisFilaSus'}
                      </span>
                    </td>
                    <td className="py-4 px-6 max-w-xs">
                      <span className="text-xs text-muted-foreground truncate block" title={item.descricao}>
                        {item.descricao || '—'}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-center">
                      <button
                        type="button"
                        onClick={() => handleToggleActive(item)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold transition-all cursor-pointer ${
                          item.active 
                            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20' 
                            : 'bg-muted text-muted-foreground hover:bg-muted/80'
                        }`}
                        title={item.active ? 'Clique para desativar' : 'Clique para ativar'}
                      >
                        <Power className="w-3 h-3" />
                        <span>{item.active ? 'Ativo' : 'Inativo'}</span>
                      </button>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(item)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border/60 hover:border-primary/40 hover:bg-primary/5 text-foreground text-xs font-semibold transition-all cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-primary" />
                        <span>Editar</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal de Criação / Edição */}
      {modalOpen && (
        <Portal>
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-fadeIn">
            <div className="bento-card w-full max-w-lg p-6 sm:p-8 bg-card border border-border/80 shadow-2xl relative space-y-6">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="absolute right-5 top-5 p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted/60 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-primary">
                  {editingItem ? 'Editar Status' : 'Cadastrar Novo Status'}
                </span>
                <h3 className="text-xl font-bold text-foreground">
                  {editingItem ? editingItem.nome : 'Novo Status Operacional'}
                </h3>
              </div>

              {/* Preview em Tempo Real do Badge */}
              <div className="p-4 rounded-2xl bg-muted/20 border border-border/40 flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-semibold">Pré-visualização do Badge:</span>
                <StatusBadge 
                  codigo={codigo || 'STATUS'} 
                  nome={nome || 'Exemplo de Status'} 
                  cor={cor} 
                />
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Nome */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-foreground">Nome de Exibição *</label>
                  <input
                    type="text"
                    value={nome}
                    onChange={(e) => handleNomeChange(e.target.value)}
                    placeholder="Ex: Em Preparo Cirúrgico"
                    className="w-full px-4 py-2.5 rounded-xl bg-background/50 border border-border/50 text-xs text-foreground outline-none focus:border-primary transition-all font-semibold"
                    required
                  />
                </div>

                {/* Código */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-foreground">
                    Código Técnico (Identificador) *
                  </label>
                  <input
                    type="text"
                    value={codigo}
                    onChange={(e) => setCodigo(e.target.value.toUpperCase().replace(/\s+/g, '_'))}
                    placeholder="Ex: EM_PREPARO_CIRURGICO"
                    disabled={editingItem?.bloqueado_edicao_codigo}
                    className="w-full px-4 py-2.5 rounded-xl bg-background/50 border border-border/50 text-xs font-mono text-foreground outline-none focus:border-primary transition-all uppercase disabled:opacity-50 disabled:cursor-not-allowed"
                    required
                  />
                  {editingItem?.bloqueado_edicao_codigo && (
                    <span className="text-[10px] text-muted-foreground block">
                      🔒 O código deste status nativo é protegido para garantir compatibilidade com as regras do SISREG.
                    </span>
                  )}
                </div>

                {/* Origem */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-foreground">Origem do Status</label>
                    <select
                      value={origem}
                      onChange={(e) => setOrigem(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl bg-background/50 border border-border/50 text-xs text-foreground outline-none focus:border-primary transition-all font-semibold"
                    >
                      <option value="SisFilaSus">SisFilaSus (Municipal)</option>
                      <option value="SISREG">SISREG (Federal)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-foreground">Ordem de Exibição</label>
                    <input
                      type="number"
                      value={ordem}
                      onChange={(e) => setOrdem(parseInt(e.target.value, 10) || 0)}
                      className="w-full px-3 py-2.5 rounded-xl bg-background/50 border border-border/50 text-xs text-foreground outline-none focus:border-primary transition-all font-semibold"
                    />
                  </div>
                </div>

                {/* Seletor Visual de Cores */}
                <div className="space-y-2 pt-1">
                  <label className="block text-xs font-bold text-foreground flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Palette className="w-3.5 h-3.5 text-primary" />
                      <span>Marcador Visual de Cor *</span>
                    </span>
                    <span className="text-[11px] font-semibold text-primary">
                      {STATUS_COLORS_MAP[cor]?.label || cor}
                    </span>
                  </label>

                  <div className="grid grid-cols-7 gap-2 p-3 rounded-2xl bg-muted/20 border border-border/40">
                    {Object.entries(STATUS_COLORS_MAP).map(([colorKey, cfg]) => {
                      const isSelected = cor === colorKey
                      return (
                        <button
                          key={colorKey}
                          type="button"
                          onClick={() => setCor(colorKey)}
                          className={`group relative flex flex-col items-center justify-center p-2 rounded-xl transition-all cursor-pointer ${
                            isSelected 
                              ? 'bg-card shadow-md scale-105 ring-2 ring-primary ring-offset-2 ring-offset-background' 
                              : 'hover:bg-muted/40 opacity-80 hover:opacity-100'
                          }`}
                          title={cfg.label}
                        >
                          <span 
                            className="w-5 h-5 rounded-full shadow-inner flex items-center justify-center text-white"
                            style={{ backgroundColor: cfg.hex }}
                          >
                            {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Descrição */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-foreground">Descrição Operacional</label>
                  <textarea
                    value={descricao}
                    onChange={(e) => setDescricao(e.target.value)}
                    placeholder="Explicação sobre quando aplicar este status..."
                    rows={2}
                    className="w-full px-4 py-2.5 rounded-xl bg-background/50 border border-border/50 text-xs text-foreground outline-none focus:border-primary transition-all"
                  />
                </div>

                {/* Botões do Modal */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-border/30">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl border border-border/60 hover:bg-muted/60 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold shadow-md shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {submitting ? 'Salvando...' : editingItem ? 'Salvar Alterações' : 'Cadastrar Status'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </Portal>
      )}
    </DashboardShell>
  )
}
