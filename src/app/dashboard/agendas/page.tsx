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

  // As quatro listas de apoio nao dependem umas das outras nem da consulta de
  // agendas: sao carregadas em paralelo com ela. Antes rodavam em sequencia,
  // somando cinco idas e voltas ao banco antes de a pagina comecar a renderizar.
  const [
    agendasRes,
    prestadoresRes,
    medicosRes,
    especialidadesRes,
    templatesRes,
  ] = await Promise.all([
    query,
    supabase
      .from('hospitais_prestadores')
      .select('id, cnes, nome, especialidades')
      .eq('active', true)
      .order('nome')
      .limit(1000),
    supabase
      .from('medicos')
      .select('id, nome, crm, uf_crm, especialidade_id, especialidade_nome, hospital_id')
      .eq('active', true)
      .order('nome')
      .limit(1000),
    supabase
      .from('especialidades')
      .select('id, nome')
      .eq('active', true)
      .order('nome')
      .limit(1000),
    supabase
      .from('templates_mensagem')
      .select('id, titulo, corpo')
      .eq('active', true)
      .limit(200),
  ])

  const agendas = agendasRes.data
  const prestadores = prestadoresRes.data
  const medicos = medicosRes.data
  const especialidades = especialidadesRes.data
  const templates = templatesRes.data

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
