import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { AgendasClient } from './AgendasClient'

export default async function AgendasPage() {
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

  const allowedRoles = ['SMS_ADMIN', 'COORDENADOR', 'OPERADOR_REGULACAO', 'AUXILIAR']
  if (!allowedRoles.includes(role)) {
    redirect('/dashboard')
  }

  // Buscar prestadores ativos
  const { data: prestadores } = await supabase
    .from('hospitais_prestadores')
    .select('id, cnes, nome, especialidades')
    .eq('active', true)
    .order('nome')

  // Buscar templates de mensagem ativos
  const { data: templates } = await supabase
    .from('templates_mensagem')
    .select('id, titulo, corpo')
    .eq('active', true)

  // Buscar agendas do mês atual
  const today = new Date()
  const firstDay = new Date(today.getFullYear(), today.getMonth() - 1, 1).toISOString().split('T')[0]
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 2, 0).toISOString().split('T')[0]

  const { data: agendas } = await supabase
    .from('agendas_prestadores')
    .select(`
      id,
      medico_nome,
      especialidade,
      data_agenda,
      horario_inicio,
      quantidade_vagas,
      tipo_agenda,
      observacoes_bloqueio,
      active,
      hospitais_prestadores (id, cnes, nome),
      agendamentos_procedimentos (
        id,
        cod_solicitacao,
        status_agendamento,
        compareceu_consulta,
        cirurgia_realizada,
        data_cirurgia_agendada,
        exportado_sisreg
      )
    `)
    .eq('active', true)
    .gte('data_agenda', firstDay)
    .lte('data_agenda', lastDay)
    .order('data_agenda', { ascending: true })
    .order('horario_inicio', { ascending: true })

  return (
    <AgendasClient
      role={role}
      email={user.email || ''}
      prestadores={prestadores || []}
      templates={templates || []}
      initialAgendas={agendas || []}
    />
  )
}
