'use client'

import React, { useState } from 'react'
import { DashboardShell } from '@/components/layout/DashboardShell'
import { 
  Plus, Edit2, X, User, Check, Key, UserCheck, UserX,
  ShieldCheck, ShieldAlert, UserCog
} from 'lucide-react'
import { Portal } from '@/components/ui/Portal'
import { createUserAction, updateUserAction } from './actions'
import { useSystemModal } from '@/components/ui/SystemModal'

interface UserProfile {
  id: string
  email: string
  nome: string
  role: string
  cnes_vinculo: string | null
  active: boolean
  created_at: string
}

interface Unidade {
  cnes: string
  nome: string
}

interface UsuariosClientProps {
  role: string
  email: string
  users: UserProfile[]
  unidades: Unidade[]
}

const DISPONIVEIS_ROLES = [
  { value: 'SMS_ADMIN', label: 'Administrador (SMS)' },
  { value: 'COORDENADOR', label: 'Coordenador da Regulação' },
  { value: 'MEDICO_REGULADOR', label: 'Médico Regulador / Autorizador' },
  { value: 'OPERADOR_REGULACAO', label: 'Operador de Regulação (Convocador)' },
  { value: 'AUXILIAR', label: 'Auxiliar Administrativo' },
  { value: 'UNIDADE_USER', label: 'Unidade Solicitante (Vínculo CNES)' }
]

export function UsuariosClient({ 
  role: userRole, 
  email: userEmail, 
  users: initialUsers, 
  unidades 
}: UsuariosClientProps) {
  const { showAlert, showConfirm } = useSystemModal()
  const [users, setUsers] = useState<UserProfile[]>(initialUsers)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | undefined>(undefined)

  // Filtros
  const [search, setSearch] = useState('')
  const [filterRole, setFilterRole] = useState('')
  const [filterActive, setFilterActive] = useState('')

  // Campos do Formulário
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('OPERADOR_REGULACAO')
  const [cnesVinculo, setCnesVinculo] = useState<string>('')
  const [active, setActive] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const handleOpenCreate = () => {
    setEditingId(undefined)
    setNome('')
    setEmail('')
    setPassword('')
    setRole('OPERADOR_REGULACAO')
    setCnesVinculo('')
    setActive(true)
    setModalOpen(true)
  }

  const handleOpenEdit = (u: UserProfile) => {
    setEditingId(u.id)
    setNome(u.nome || '')
    setEmail(u.email || '')
    setPassword('') // Senha vazia significa "não alterar" no update
    setRole(u.role || 'OPERADOR_REGULACAO')
    setCnesVinculo(u.cnes_vinculo || '')
    setActive(u.active)
    setModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!nome.trim()) {
      await showAlert({ title: 'Atenção', message: 'O nome do usuário é obrigatório.', type: 'warning' })
      return
    }

    if (!email.trim() || !email.includes('@')) {
      await showAlert({ title: 'Atenção', message: 'Informe um e-mail válido.', type: 'warning' })
      return
    }

    if (!editingId && (!password || password.length < 6)) {
      await showAlert({ title: 'Atenção', message: 'A senha é obrigatória para novas contas e deve ter pelo menos 6 caracteres.', type: 'warning' })
      return
    }

    if (role === 'UNIDADE_USER' && !cnesVinculo) {
      await showAlert({ title: 'Atenção', message: 'Usuários do tipo Unidade Solicitante devem possuir vínculo com um CNES.', type: 'warning' })
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        nome,
        email: email.trim().toLowerCase(),
        role,
        cnes_vinculo: role === 'UNIDADE_USER' ? cnesVinculo : null,
        active,
        password
      }

      if (editingId) {
        const res = await updateUserAction(editingId, payload)
        if (!res.success) throw new Error(res.error)
        await showAlert({ title: 'Sucesso', message: 'Usuário atualizado com sucesso!', type: 'success' })
        
        // Atualizar lista localmente
        setUsers(prev => prev.map(u => {
          if (u.id === editingId) {
            return { 
              ...u, 
              nome, 
              email: email.trim().toLowerCase(), 
              role, 
              cnes_vinculo: role === 'UNIDADE_USER' ? cnesVinculo : null, 
              active 
            }
          }
          return u
        }))
      } else {
        const res = await createUserAction(payload)
        if (!res.success) throw new Error(res.error)
        await showAlert({ title: 'Sucesso', message: 'Usuário cadastrado com sucesso!', type: 'success' })
        
        // Como o ID é gerado no Auth/DB, recarrega a página para puxar a lista limpa e atualizada
        window.location.reload()
      }
      
      setModalOpen(false)
    } catch (err: any) {
      await showAlert({ title: 'Erro', message: err.message || 'Erro ao salvar usuário.', type: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  const handleToggleActive = async (u: UserProfile) => {
    if (u.email.toLowerCase() === userEmail.toLowerCase()) {
      await showAlert({ title: 'Atenção', message: 'Você não pode suspender ou alterar o status de sua própria conta atualmente logada!', type: 'warning' })
      return
    }

    const newActiveState = !u.active
    const actionText = newActiveState ? 'ativar' : 'inativar'
    
    const confirmed = await showConfirm({
      title: 'Confirmação',
      message: `Tem certeza de que deseja ${actionText} o usuário "${u.nome}" (${u.email})?`,
      confirmText: 'Confirmar',
      variant: newActiveState ? 'success' : 'danger'
    })
    
    if (!confirmed) return

    try {
      const res = await updateUserAction(u.id, {
        nome: u.nome,
        email: u.email,
        role: u.role,
        cnes_vinculo: u.cnes_vinculo,
        active: newActiveState
      })
      if (!res.success) throw new Error(res.error)
      
      setUsers(prev => prev.map(item => {
        if (item.id === u.id) {
          return { ...item, active: newActiveState }
        }
        return item
      }))
      await showAlert({
        title: 'Status Alterado',
        message: `Usuário ${newActiveState ? 'ativado' : 'inativado'} com sucesso!`,
        type: 'success'
      })
    } catch (err: any) {
      await showAlert({
        title: 'Erro ao Alterar Status',
        message: err.message || 'Erro ao alterar status do usuário.',
        type: 'error'
      })
    }
  }

  const getRoleBadge = (roleName: string) => {
    switch (roleName) {
      case 'SMS_ADMIN':
        return <span className="px-2.5 py-1 text-[9px] font-black uppercase rounded-lg bg-rose-500/10 text-rose-500 border border-rose-500/20">Administrador</span>
      case 'COORDENADOR':
        return <span className="px-2.5 py-1 text-[9px] font-black uppercase rounded-lg bg-purple-500/10 text-purple-500 border border-purple-500/20">Coordenador</span>
      case 'MEDICO_REGULADOR':
        return <span className="px-2.5 py-1 text-[9px] font-black uppercase rounded-lg bg-blue-500/10 text-blue-500 border border-blue-500/20">Médico Regulador</span>
      case 'OPERADOR_REGULACAO':
        return <span className="px-2.5 py-1 text-[9px] font-black uppercase rounded-lg bg-teal-500/10 text-teal-500 border border-teal-500/20">Operador</span>
      case 'AUXILIAR':
        return <span className="px-2.5 py-1 text-[9px] font-black uppercase rounded-lg bg-zinc-500/10 text-zinc-500 border border-zinc-500/20">Auxiliar</span>
      case 'UNIDADE_USER':
        return <span className="px-2.5 py-1 text-[9px] font-black uppercase rounded-lg bg-amber-500/10 text-amber-500 border border-amber-500/20">Unidade</span>
      default:
        return <span className="px-2.5 py-1 text-[9px] font-black uppercase rounded-lg bg-muted text-muted-foreground">Usuário</span>
    }
  }

  // Filtragem local dos usuários na tabela
  const filteredUsers = users.filter(u => {
    const matchesSearch = u.nome.toLowerCase().includes(search.toLowerCase()) || 
                          u.email.toLowerCase().includes(search.toLowerCase())
    const matchesRole = filterRole === '' || u.role === filterRole
    const matchesActive = filterActive === '' || 
                          (filterActive === 'true' && u.active) || 
                          (filterActive === 'false' && !u.active)
    return matchesSearch && matchesRole && matchesActive
  })

  return (
    <DashboardShell role={userRole} email={userEmail}>
      <div className="space-y-8">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-3xl font-black text-foreground tracking-tighter uppercase">
              Gerenciar <span className="text-primary italic">Usuários</span>
            </h2>
            <p className="text-sm text-muted-foreground mt-2">
              Controle de contas de operadores, médicos e auxiliares que acessam o SisFilaSus.
            </p>
          </div>

          <button
            onClick={handleOpenCreate}
            className="px-5 py-3 rounded-2xl bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-widest hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer shadow-md shadow-primary/10 flex items-center gap-2 w-fit shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span>Adicionar Usuário</span>
          </button>
        </div>

        {/* Bento de Filtros Rápidos */}
        <div className="bento-card p-6 md:p-8">
          <div className="grid gap-6 sm:grid-cols-3">
            <div className="group">
              <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2 px-1">Buscar Usuário</label>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="block w-full rounded-2xl border border-border/50 bg-background/50 py-3.5 px-4 text-xs text-foreground outline-none focus:border-primary transition-all placeholder:text-muted-foreground/50"
                placeholder="Nome ou e-mail..."
              />
            </div>

            <div className="group">
              <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2 px-1">Filtrar por Perfil</label>
              <select
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
                className="block w-full rounded-2xl border border-border/50 bg-background/50 py-3.5 px-4 text-xs text-foreground outline-none focus:border-primary transition-all"
              >
                <option value="">Todos os Perfis</option>
                {DISPONIVEIS_ROLES.map(r => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>

            <div className="group">
              <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2 px-1">Status da Conta</label>
              <select
                value={filterActive}
                onChange={(e) => setFilterActive(e.target.value)}
                className="block w-full rounded-2xl border border-border/50 bg-background/50 py-3.5 px-4 text-xs text-foreground outline-none focus:border-primary transition-all"
              >
                <option value="">Todos</option>
                <option value="true">Apenas Ativos</option>
                <option value="false">Apenas Suspensos (Inativos)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Tabela de Usuários */}
        <div className="bento-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border/20 bg-muted/20 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                  <th className="py-5 px-6">Nome Completo</th>
                  <th className="py-5 px-6">E-mail de Acesso</th>
                  <th className="py-5 px-6">Perfil / Role</th>
                  <th className="py-5 px-6">Vínculo CNES</th>
                  <th className="py-5 px-6">Status</th>
                  <th className="py-5 px-6 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/10 text-xs font-semibold">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-muted-foreground font-bold">
                      Nenhum usuário correspondente aos filtros.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => {
                    const unitName = u.cnes_vinculo 
                      ? unidades.find(un => un.cnes === u.cnes_vinculo)?.nome || u.cnes_vinculo
                      : 'Acesso Municipal (Sem Unidade)'
                    
                    return (
                      <tr key={u.id} className="hover:bg-muted/10 transition-colors">
                        <td className="py-4 px-6 font-bold text-foreground text-sm uppercase">{u.nome}</td>
                        <td className="py-4 px-6 text-muted-foreground font-mono">{u.email}</td>
                        <td className="py-4 px-6">{getRoleBadge(u.role)}</td>
                        <td className="py-4 px-6 text-muted-foreground max-w-xs truncate uppercase text-[10px]">{unitName}</td>
                        <td className="py-4 px-6">
                          {u.active ? (
                            <span className="px-2.5 py-0.5 text-[8px] font-black uppercase rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">Ativo</span>
                          ) : (
                            <span className="px-2.5 py-0.5 text-[8px] font-black uppercase rounded bg-rose-500/10 text-rose-500 border border-rose-500/20">Inativo</span>
                          )}
                        </td>
                        <td className="py-4 px-6 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => handleOpenEdit(u)}
                              className="p-2 rounded-xl hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors cursor-pointer"
                              title="Editar Usuário"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleToggleActive(u)}
                              disabled={u.email.toLowerCase() === userEmail.toLowerCase()}
                              className={`p-2 rounded-xl transition-colors cursor-pointer ${
                                u.active 
                                  ? 'hover:bg-rose-500/10 text-muted-foreground hover:text-rose-500' 
                                  : 'hover:bg-emerald-500/10 text-muted-foreground hover:text-emerald-500'
                              } disabled:opacity-30 disabled:hover:bg-transparent`}
                              title={u.active ? "Inativar Usuário" : "Ativar Usuário"}
                            >
                              {u.active ? (
                                <UserX className="h-4 w-4" />
                              ) : (
                                <UserCheck className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* Drawer Lateral para Cadastro / Edição */}
      {modalOpen && (
        <Portal>
          <div className="fixed inset-0 z-50 overflow-hidden">
          <div 
            className="absolute inset-0 bg-background/80 backdrop-blur-sm transition-opacity duration-300"
            onClick={() => setModalOpen(false)}
          />
          <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-xl bg-card border-l border-border/40 shadow-2xl flex flex-col h-full overflow-y-auto animate-in slide-in-from-right duration-350">
              
              {/* Header */}
              <div className="p-6 md:p-8 border-b border-border/10 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                    <UserCog className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Controle de Acesso</span>
                    <h3 className="text-lg font-black text-foreground uppercase mt-1">
                      {editingId ? 'Editar Usuário' : 'Novo Usuário'}
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
              <form onSubmit={handleSubmit} className="flex-1 p-6 md:p-8 space-y-6">
                
                {/* Nome */}
                <div className="group">
                  <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2 px-1">Nome Completo</label>
                  <input
                    type="text"
                    required
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    className="block w-full rounded-2xl border border-border/50 bg-background/50 py-3.5 px-4 text-xs text-foreground outline-none focus:border-primary transition-all uppercase"
                    placeholder="Ex: FERNANDO GOMES SILVA"
                  />
                </div>

                {/* E-mail */}
                <div className="group">
                  <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2 px-1">E-mail de Login</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full rounded-2xl border border-border/50 bg-background/50 py-3.5 px-4 text-xs text-foreground outline-none focus:border-primary transition-all font-mono"
                    placeholder="Ex: operador@saude.gov"
                  />
                </div>

                {/* Senha */}
                <div className="group">
                  <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2 px-1">
                    Senha {editingId ? '(Deixe em branco para manter)' : 'de Acesso'}
                  </label>
                  <input
                    type="password"
                    required={!editingId}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full rounded-2xl border border-border/50 bg-background/50 py-3.5 px-4 text-xs text-foreground outline-none focus:border-primary transition-all"
                    placeholder={editingId ? 'Digite para alterar a senha...' : 'Mínimo 6 caracteres'}
                  />
                </div>

                {/* Perfil/Role */}
                <div className="group">
                  <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2 px-1">Perfil de Permissão</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="block w-full rounded-2xl border border-border/50 bg-background/50 py-3.5 px-4 text-xs text-foreground outline-none focus:border-primary transition-all"
                  >
                    {DISPONIVEIS_ROLES.map(r => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>

                {/* Vínculo CNES (Dinâmico para UNIDADE_USER) */}
                {role === 'UNIDADE_USER' && (
                  <div className="group animate-in slide-in-from-top-2 duration-300">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2 px-1">Selecione a Unidade Solicitante</label>
                    <select
                      value={cnesVinculo}
                      required={role === 'UNIDADE_USER'}
                      onChange={(e) => setCnesVinculo(e.target.value)}
                      className="block w-full rounded-2xl border border-border/50 bg-background/50 py-3.5 px-4 text-xs text-foreground outline-none focus:border-primary transition-all uppercase"
                    >
                      <option value="">Selecione uma unidade...</option>
                      {unidades.map(u => (
                        <option key={u.cnes} value={u.cnes}>{u.cnes} - {u.nome}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Status Switch (Active) */}
                <div className="flex items-center justify-between p-4 bg-muted/20 border border-border/10 rounded-2xl">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-foreground">Status do Acesso</span>
                    <span className="text-[10px] text-muted-foreground">Usuários inativos têm seu login bloqueado imediatamente.</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActive(!active)}
                    className={`p-1.5 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer flex items-center gap-1.5 ${
                      active 
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500' 
                        : 'bg-rose-500/10 border-rose-500/30 text-rose-500'
                    }`}
                  >
                    {active ? (
                      <>
                        <UserCheck className="h-4 w-4" />
                        <span>Ativo</span>
                      </>
                    ) : (
                      <>
                        <UserX className="h-4 w-4" />
                        <span>Suspenso</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Form Actions */}
                <div className="flex gap-3 pt-6 border-t border-border/10">
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
                    {submitting ? 'Salvando...' : 'Salvar Usuário'}
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
