import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { AgendasClient } from '@/app/dashboard/agendas/AgendasClient'

export default async function AgendasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Obter perfil do usuário
  const { data: profile } = await supabase
    .from('users')
    .select('role, nome, hospital_id')
    .eq('id', user.id)
    .single()

  const role = profile?.role || 'OPERADOR_REGULACAO'
  const userHospitalId = profile?.hospital_id || null

  const allowedRoles = ['SMS_ADMIN', 'COORDENADOR', 'OPERADOR_REGULACAO', 'AUXILIAR', 'PRESTADOR_USER']
  if (!allowedRoles.includes(role)) {
    redirect('/dashboard')
  }

  // Buscar prestadores ativos
  const { data: prestadores } = await supabase
    .from('hospitais_prestadores')
    .select('id, cnes, nome, especialidades')
    .eq('active', true)
    .order('nome')

  // Buscar médicos cadastrados ativos
  const { data: medicos } = await supabase
    .from('medicos')
    .select('id, nome, crm, uf_crm, especialidade_id, especialidade_nome, hospital_id')
    .eq('active', true)
    .order('nome')

  // Buscar especialidades ativas
  const { data: especialidades } = await supabase
    .from('especialidades')
    .select('id, nome')
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

  let query = supabase
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

  if (role === 'PRESTADOR_USER' && userHospitalId) {
    query = query.eq('hospital_id', userHospitalId)
  }

  const { data: agendas } = await query

  return (
    <AgendasClient
      role={role}
      email={user.email || ''}
      userHospitalId={userHospitalId}
      prestadores={prestadores || []}
      medicos={medicos || []}
      especialidades={especialidades || []}
      templates={templates || []}
      initialAgendas={agendas || []}
    />
  )
}
