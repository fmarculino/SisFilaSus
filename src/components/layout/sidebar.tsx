'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { 
  LayoutDashboard, ClipboardList, CalendarCheck, History,
  Users, Building2, Download, ScrollText, Settings, Lock, 
  Shield, ChevronDown, Stethoscope, UserCog, RefreshCw, CalendarDays
} from 'lucide-react'
import { AboutMenu } from './about-menu'

const ALL_ROLES = ['SMS_ADMIN', 'COORDENADOR', 'MEDICO_REGULADOR', 'OPERADOR_REGULACAO', 'AUXILIAR', 'UNIDADE_USER']
const ADMIN_COORD_OPERADOR = ['SMS_ADMIN', 'COORDENADOR', 'OPERADOR_REGULACAO']
const ADMIN_COORD = ['SMS_ADMIN', 'COORDENADOR']

const navigation = [
  { 
    name: 'Dashboard', 
    href: '/dashboard', 
    icon: LayoutDashboard, 
    roles: ALL_ROLES
  },
  { 
    name: 'Fila de Espera', 
    href: '/dashboard/fila', 
    icon: ClipboardList, 
    roles: ALL_ROLES
  },
  {
    name: 'Operações',
    icon: CalendarCheck,
    roles: ALL_ROLES,
    children: [
      { name: 'Agendas & Cirurgias', href: '/dashboard/agendas', icon: CalendarDays, roles: ADMIN_COORD_OPERADOR },
      { name: 'Convocações', href: '/dashboard/convocacao', icon: CalendarCheck, roles: ADMIN_COORD_OPERADOR },
      { name: 'Movimentações', href: '/dashboard/movimentacoes', icon: History, roles: ['SMS_ADMIN', 'COORDENADOR', 'OPERADOR_REGULACAO', 'MEDICO_REGULADOR'] },
      { name: 'Sincronização SISREG', href: '/dashboard/sincronizacao', icon: RefreshCw, roles: ADMIN_COORD_OPERADOR },
      { name: 'Relatórios Gerenciais', href: '/dashboard/relatorios', icon: ScrollText, roles: ADMIN_COORD },
    ]
  },
  {
    name: 'Cadastros',
    icon: Users,
    roles: ALL_ROLES,
    children: [
      { name: 'Pacientes', href: '/dashboard/pacientes', icon: Users, roles: ADMIN_COORD_OPERADOR },
      { name: 'Prestadores (Hospitais)', href: '/dashboard/prestadores', icon: Building2, roles: ADMIN_COORD },
      { name: 'Usuários', href: '/dashboard/usuarios', icon: UserCog, roles: ['SMS_ADMIN', 'COORDENADOR'] },
    ]
  },
  {
    name: 'Configurações',
    icon: Settings,
    roles: ALL_ROLES,
    children: [
      { name: 'Importar Arquivos', href: '/dashboard/importacao', icon: Download, roles: ADMIN_COORD },
      { name: 'Modelos de Mensagem', href: '/dashboard/mensagem', icon: ScrollText, roles: ADMIN_COORD },
      { name: 'Parâmetros Gerais', href: '/dashboard/configuracoes', icon: Settings, roles: ADMIN_COORD },
      { name: 'Auditoria de Sistema', href: '/dashboard/auditoria', icon: Shield, roles: ADMIN_COORD },
      { name: 'Acesso & Segurança', href: '/auth/update-password', icon: Lock, roles: ALL_ROLES },
    ]
  }
]

export function Sidebar({ role, onLinkClick }: { role: string; onLinkClick?: () => void }) {
  const pathname = usePathname()
  const [openGroups, setOpenGroups] = useState<string[]>([])
  
  // Estados para gerenciar a instalação do PWA
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [isInstallable, setIsInstallable] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setIsInstallable(true)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true)
    }

    const handleAppInstalled = () => {
      setIsInstalled(true)
      setIsInstallable(false)
      setDeferredPrompt(null)
    }
    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  const handleInstallClick = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    console.log(`PWA: Escolha de instalação - ${outcome}`)
    setDeferredPrompt(null)
    setIsInstallable(false)
  }

  // Auto-expand group if a child is active
  useEffect(() => {
    const activeGroup = navigation.find(item => 
      item.children?.some(child => pathname.startsWith(child.href))
    )
    if (activeGroup && !openGroups.includes(activeGroup.name)) {
      setOpenGroups(prev => [...prev, activeGroup.name])
    }
  }, [pathname])

  const toggleGroup = (name: string) => {
    setOpenGroups(prev => 
      prev.includes(name) ? prev.filter(g => g !== name) : [...prev, name]
    )
  }

  const isGroupVisible = (item: any) => {
    if (item.children) {
      return item.children.some((child: any) => child.roles.includes(role))
    }
    return item.roles.includes(role)
  }

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'SMS_ADMIN': return 'Administrador'
      case 'COORDENADOR': return 'Coordenador'
      case 'MEDICO_REGULADOR': return 'Médico Regulador'
      case 'OPERADOR_REGULACAO': return 'Operador'
      case 'AUXILIAR': return 'Auxiliar Regulação'
      case 'UNIDADE_USER': return 'Unidade Solicitante'
      default: return 'Usuário'
    }
  }

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto border-r border-border/40 bg-card/50 backdrop-blur-xl no-scrollbar">
      <div className="flex h-24 shrink-0 items-center px-8 mb-4">
        <div className="flex items-center justify-center h-12 w-12 rounded-2xl bg-primary shadow-lg shadow-primary/20 mr-4 group/logo cursor-pointer transition-transform active:scale-95">
          <Stethoscope className="h-7 w-7 text-primary-foreground group-hover/logo:scale-110 transition-transform duration-300" />
        </div>
        <div className="flex flex-col">
          <span className="text-2xl font-black bg-gradient-to-br from-foreground to-foreground/50 bg-clip-text text-transparent tracking-tighter leading-none">
            SisFilaSus
          </span>
          <span className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mt-1 opacity-80">
            Regulação SMS
          </span>
        </div>
      </div>
      
      <nav className="flex-1 space-y-1 px-4 py-4">
        {navigation.filter(isGroupVisible).map((item) => {
          if (item.children) {
            const isOpen = openGroups.includes(item.name)
            const hasActiveChild = item.children.some(child => pathname.startsWith(child.href))
            const visibleChildren = item.children.filter(child => child.roles.includes(role))

            if (visibleChildren.length === 0) return null

            return (
              <div key={item.name} className="space-y-1">
                <button
                  onClick={() => toggleGroup(item.name)}
                  className={`
                    w-full group flex items-center justify-between px-4 py-3 text-[11px] font-black uppercase tracking-widest rounded-xl transition-all duration-300
                    ${hasActiveChild ? 'text-primary' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'}
                  `}
                >
                  <div className="flex items-center">
                    <item.icon className={`mr-4 h-4.5 w-4.5 ${hasActiveChild ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'}`} />
                    <span>{item.name}</span>
                  </div>
                  <ChevronDown className={`h-4 w-4 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                
                {isOpen && (
                  <div className="ml-4 pl-4 border-l border-border/40 space-y-1 animate-in slide-in-from-top-2 duration-300">
                    {visibleChildren.map((child) => {
                      const isActive = pathname === child.href
                      return (
                        <Link
                          key={child.name}
                          href={child.href}
                          onClick={onLinkClick}
                          className={`
                            group flex items-center px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all
                            ${isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground/70 hover:text-foreground hover:bg-muted/30'}
                          `}
                        >
                          <child.icon className={`mr-3 h-3.5 w-3.5 ${isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'}`} />
                          {child.name}
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          }

          const isActive = pathname === item.href
          return (
            <Link
              key={item.name}
              href={item.href!}
              onClick={onLinkClick}
              className={`
                group flex items-center px-4 py-3 text-[11px] font-black uppercase tracking-widest rounded-xl transition-all duration-300
                ${isActive ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'}
              `}
            >
              <item.icon className={`mr-4 h-5 w-5 ${isActive ? 'text-primary-foreground' : 'text-muted-foreground group-hover:text-foreground'}`} />
              {item.name}
            </Link>
          )
        })}
      </nav>

      {isInstallable && !isInstalled && (
        <div className="px-4 pb-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <button
            onClick={handleInstallClick}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-gradient-to-br from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-750 text-white rounded-2xl shadow-lg shadow-teal-500/20 text-xs font-black uppercase tracking-widest transition-all active:scale-95 duration-300 group border border-teal-400/20"
          >
            <Download className="h-4.5 w-4.5 stroke-[2.5]" />
            <span>Instalar Aplicativo</span>
          </button>
        </div>
      )}

      <div className="mt-auto px-4 pb-4">
        <AboutMenu />
      </div>

      <div className="p-4 border-t border-border/20">
        <div className="bg-muted/20 p-4 rounded-2xl border border-border/10">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Shield className="h-4 w-4 text-primary" />
            </div>
            <div className="flex flex-col overflow-hidden">
              <span className="text-[10px] font-black text-foreground uppercase tracking-widest truncate">{getRoleLabel(role)}</span>
              <span className="text-[9px] text-muted-foreground font-medium truncate opacity-50">Acesso Restrito</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
