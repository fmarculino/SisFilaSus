import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import { DashboardShell } from '@/components/layout/DashboardShell'
import { 
  ClipboardList, CalendarCheck, Download, 
  Clock, Flame, AlertCircle, FileText, 
  ArrowRight, Activity, TrendingUp, CheckCircle2
} from 'lucide-react'

export default async function DashboardPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  // Obter perfil do usuário
  const { data: profile } = await supabase
    .from('users')
    .select('role, nome')
    .eq('id', user.id)
    .single()

  const role = profile?.role || 'OPERADOR_REGULACAO'
  const nome = profile?.nome || user.email || 'Operador'

  // Fetch KPI and chart view data in parallel
  const [
    kpisRes,
    topProcedsRes,
    riscoRes,
    evolucaoRes
  ] = await Promise.all([
    supabase.from('vw_dashboard_kpis').select('*').single(),
    supabase.from('vw_dashboard_top_procedimentos').select('*'),
    supabase.from('vw_dashboard_risco').select('*'),
    supabase.from('vw_dashboard_evolucao').select('*')
  ])

  const kpis = kpisRes.data || { fila_total_ativa: 0, aguardando_cirurgias: 0, media_espera_anos: 0, contatos_hoje: 0 }
  const topProcedimentos = topProcedsRes.data || []
  const riscoData = riscoRes.data || []
  const evolucaoData = evolucaoRes.data || []

  // Mapeamento de rótulos de risco
  const getRiskLabel = (risco: number) => {
    switch (risco) {
      case 0: return 'Emergência'
      case 1: return 'Urgência'
      case 2: return 'Prioridade'
      case 3: return 'Eletivo'
      case 4: return 'Especial'
      default: return 'Outros'
    }
  }

  const getRiskColor = (risco: number) => {
    switch (risco) {
      case 0: return 'bg-rose-500 text-white'
      case 1: return 'bg-red-500 text-red-500 bg-red-500/10'
      case 2: return 'bg-amber-500 text-amber-500 bg-amber-500/10'
      case 3: return 'bg-teal-500 text-teal-500 bg-teal-500/10'
      case 4: return 'bg-purple-500 text-purple-500 bg-purple-500/10'
      default: return 'bg-muted text-muted-foreground bg-muted/10'
    }
  }

  return (
    <DashboardShell role={role} email={user.email || ''}>
      <div className="space-y-8">
        {/* Banner de Boas Vindas */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-3xl font-black text-foreground tracking-tighter uppercase">
              Bem-vindo, <span className="text-primary italic">{nome}</span>
            </h2>
            <p className="text-sm text-muted-foreground mt-2">
              Aqui está a visão geral da regulação de consultas, exames e cirurgias eletivas de Marabá.
            </p>
          </div>
          <div className="flex items-center gap-2 bg-muted/40 backdrop-blur-md rounded-2xl border border-border/30 px-4 py-2 w-fit">
            <Activity className="h-4 w-4 text-primary animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Sistema Operacional</span>
          </div>
        </div>

        {/* Bento Grid dos Indicadores Principais (KPIs) */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {/* Card 1: Fila Total Ativa */}
          <div className="bento-card p-6 flex flex-col justify-between h-44 relative overflow-hidden group hover:border-primary/40 transition-all duration-300">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Fila Total Ativa</span>
              <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform duration-300">
                <ClipboardList className="h-4 w-4" />
              </div>
            </div>
            <div>
              <span className="text-4xl font-black text-foreground tracking-tighter">
                {kpis.fila_total_ativa.toLocaleString('pt-BR')}
              </span>
              <div className="text-[9px] text-teal-500 font-black uppercase tracking-widest mt-2">
                Pacientes aguardando
              </div>
            </div>
            <div className="absolute right-0 bottom-0 translate-x-4 translate-y-4 opacity-5 group-hover:scale-125 transition-transform duration-500">
              <ClipboardList className="h-32 w-32 text-primary" />
            </div>
          </div>

          {/* Card 2: Aguardando Cirurgias */}
          <div className="bento-card p-6 flex flex-col justify-between h-44 relative overflow-hidden group hover:border-teal-500/40 transition-all duration-300">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Aguardando Cirurgias</span>
              <div className="h-8 w-8 rounded-xl bg-teal-500/10 flex items-center justify-center text-teal-500 group-hover:scale-110 transition-transform duration-300">
                <Flame className="h-4 w-4" />
              </div>
            </div>
            <div>
              <span className="text-4xl font-black text-foreground tracking-tighter">
                {kpis.aguardando_cirurgias.toLocaleString('pt-BR')}
              </span>
              <div className="text-[9px] text-teal-500 font-black uppercase tracking-widest mt-2">
                Eletivas de internação
              </div>
            </div>
            <div className="absolute right-0 bottom-0 translate-x-4 translate-y-4 opacity-5 group-hover:scale-125 transition-transform duration-500">
              <Flame className="h-32 w-32 text-teal-500" />
            </div>
          </div>

          {/* Card 3: Média de Espera */}
          <div className="bento-card p-6 flex flex-col justify-between h-44 relative overflow-hidden group hover:border-rose-500/40 transition-all duration-300">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Tempo Médio de Espera</span>
              <div className="h-8 w-8 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-500 group-hover:scale-110 transition-transform duration-300">
                <Clock className="h-4 w-4" />
              </div>
            </div>
            <div>
              <span className="text-4xl font-black text-foreground tracking-tighter">
                {Number(kpis.media_espera_anos).toFixed(1).replace('.', ',')}
              </span>
              <span className="text-lg font-black text-foreground ml-1">anos</span>
              <div className="text-[9px] text-rose-500 font-black uppercase tracking-widest mt-2">
                Fila ativa cronológica
              </div>
            </div>
            <div className="absolute right-0 bottom-0 translate-x-4 translate-y-4 opacity-5 group-hover:scale-125 transition-transform duration-500">
              <Clock className="h-32 w-32 text-rose-500" />
            </div>
          </div>

          {/* Card 4: Contatos Hoje */}
          <div className="bento-card p-6 flex flex-col justify-between h-44 relative overflow-hidden group hover:border-emerald-500/40 transition-all duration-300">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Contatos Hoje</span>
              <div className="h-8 w-8 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 group-hover:scale-110 transition-transform duration-300">
                <CheckCircle2 className="h-4 w-4" />
              </div>
            </div>
            <div>
              <span className="text-4xl font-black text-foreground tracking-tighter">
                {kpis.contatos_hoje.toLocaleString('pt-BR')}
              </span>
              <div className="text-[9px] text-emerald-500 font-black uppercase tracking-widest mt-2">
                Busca ativa concluída hoje
              </div>
            </div>
            <div className="absolute right-0 bottom-0 translate-x-4 translate-y-4 opacity-5 group-hover:scale-125 transition-transform duration-500">
              <CheckCircle2 className="h-32 w-32 text-emerald-500" />
            </div>
          </div>
        </div>

        {/* Bento Grid Principal: Widgets e Distribuições */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Widget 1: Top 5 Procedimentos mais Solicitados */}
          <div className="bento-card p-6 md:p-8 lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-primary">Concentração da Demanda</span>
                <h3 className="text-lg font-black text-foreground uppercase mt-1">Procedimentos com Maior Fila</h3>
              </div>
              <TrendingUp className="h-5 w-5 text-muted-foreground/40" />
            </div>

            <div className="space-y-5">
              {topProcedimentos.length === 0 ? (
                <p className="text-xs text-muted-foreground font-bold">Nenhum procedimento registrado.</p>
              ) : (
                topProcedimentos.map((proc: any, index: number) => {
                  const percent = kpis.fila_total_ativa > 0 
                    ? (proc.total / kpis.fila_total_ativa) * 100 
                    : 0
                  return (
                    <div key={proc.cod_sigtap} className="space-y-2">
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span className="text-foreground uppercase truncate pr-4">{index + 1}. {proc.desc_sigtap.trim()}</span>
                        <span className="text-muted-foreground font-mono shrink-0">
                          {proc.total.toLocaleString('pt-BR')} ({percent.toFixed(1).replace('.', ',')}%)
                        </span>
                      </div>
                      <div className="h-2 w-full bg-muted/50 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-primary to-teal-500 rounded-full transition-all duration-500" 
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Widget 2: Acesso Rápido e Distribuição de Risco */}
          <div className="space-y-6">
            {/* Bloco 1: Acesso Rápido */}
            <div className="bento-card p-6 space-y-4">
              <span className="text-[10px] font-black uppercase tracking-widest text-primary">Painel de Controle</span>
              <h3 className="text-base font-black text-foreground uppercase">Atalhos Operacionais</h3>
              <div className="grid gap-3 pt-2">
                <Link 
                  href="/dashboard/fila"
                  className="flex items-center justify-between p-3.5 bg-muted/40 hover:bg-muted/70 border border-border/30 rounded-xl text-xs font-bold text-foreground transition-all group animate-pulse-subtle"
                >
                  <div className="flex items-center gap-3">
                    <ClipboardList className="h-4.5 w-4.5 text-primary" />
                    <span>Gerenciar Fila de Espera</span>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
                </Link>

                <Link 
                  href="/dashboard/convocacao"
                  className="flex items-center justify-between p-3.5 bg-muted/40 hover:bg-muted/70 border border-border/30 rounded-xl text-xs font-bold text-foreground transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <CalendarCheck className="h-4.5 w-4.5 text-emerald-500" />
                    <span>Lista de Busca Ativa</span>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
                </Link>

                {(role === 'SMS_ADMIN' || role === 'COORDENADOR') && (
                  <Link 
                    href="/dashboard/importacao"
                    className="flex items-center justify-between p-3.5 bg-muted/40 hover:bg-muted/70 border border-border/30 rounded-xl text-xs font-bold text-foreground transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <Download className="h-4.5 w-4.5 text-teal-500" />
                      <span>Importar Relatório SISREG</span>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
                  </Link>
                )}
              </div>
            </div>

            {/* Bloco 2: Distribuição por Risco */}
            <div className="bento-card p-6 space-y-4">
              <span className="text-[10px] font-black uppercase tracking-widest text-primary">Classificação Rápida</span>
              <h3 className="text-base font-black text-foreground uppercase">Distribuição por Risco</h3>
              <div className="space-y-3 pt-2">
                {riscoData.length === 0 ? (
                  <p className="text-xs text-muted-foreground opacity-60">Nenhum dado cadastrado.</p>
                ) : (
                  riscoData.map((r: any) => (
                    <div key={r.classificacao_risco} className="flex items-center justify-between text-xs font-bold p-2.5 bg-muted/20 border border-border/10 rounded-xl">
                      <span className={`px-2 py-0.5 text-[8px] font-black uppercase rounded ${getRiskColor(r.classificacao_risco)}`}>
                        {getRiskLabel(r.classificacao_risco)}
                      </span>
                      <span className="font-mono text-foreground">{r.total.toLocaleString('pt-BR')}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Widget 3: Histórico de Evolução */}
        {evolucaoData.length > 0 && (
          <div className="bento-card p-6 md:p-8 space-y-6">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-primary">Linha do Tempo</span>
              <h3 className="text-lg font-black text-foreground uppercase mt-1">Lotes de Importação SISREG</h3>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-border/20 text-[9px] font-black uppercase tracking-wider text-muted-foreground">
                    <th className="pb-3 pr-4">Data Importação</th>
                    <th className="pb-3 pr-4">Nome do Arquivo</th>
                    <th className="pb-3 pr-4 text-right">Solicitações Ativas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/10 font-semibold text-muted-foreground">
                  {evolucaoData.map((item: any) => (
                    <tr key={item.importacao_id} className="hover:bg-muted/10 transition-colors">
                      <td className="py-3.5 pr-4 text-foreground">
                        {new Date(item.data_importacao).toLocaleDateString('pt-BR', {
                          day: '2-digit', month: '2-digit', year: 'numeric',
                          hour: '2-digit', minute: '2-digit'
                        })}
                      </td>
                      <td className="py-3.5 pr-4 font-mono truncate max-w-xs">{item.nome_arquivo}</td>
                      <td className="py-3.5 pr-4 text-right text-foreground font-bold font-mono">
                        {item.total_registros.toLocaleString('pt-BR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </DashboardShell>
  )
}
