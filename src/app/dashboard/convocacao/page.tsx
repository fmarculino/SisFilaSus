import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { ConvocacaoClient } from './ConvocacaoClient'

export default async function ConvocacaoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = profile?.role || 'OPERADOR_REGULACAO'

  // Restrição de acesso
  const allowedRoles = ['SMS_ADMIN', 'COORDENADOR', 'OPERADOR_REGULACAO', 'AUXILIAR']
  if (!allowedRoles.includes(role)) {
    redirect('/dashboard')
  }

  // Buscar solicitações cuja convocação está em andamento (EM_CONVOCACAO ou SEM_CONTATO)
  // As duas consultas sao independentes e rodam em paralelo.
  const [solicitacoesRes, templatesRes] = await Promise.all([
    supabase
    .from('fila_solicitacoes')
    .select(`
      cod_solicitacao,
      data_solicitacao,
      classificacao_risco,
      posicao_fila,
      tipo_fila,
      status_interno,
      data_execucao,
      chave_confirmacao,
      nome_executante,
      pacientes (id, nome_usuario, cns_usuario, cpf_usuario, telefone_1, telefone_2, pacientes_telefones (id, numero, tipo, status, prioridade, nome_contato)),
      procedimentos (cod_sigtap, desc_sigtap),
      unidades_solicitantes (nome)
    `)
    .eq('active', true)
    .in('status_interno', ['EM_CONVOCACAO', 'SEM_CONTATO'])
    .order('posicao_fila', { ascending: true, nullsFirst: false })
    // Teto explicito: sem ele o PostgREST corta em 1000 linhas sem avisar,
    // e a lista de busca ativa esconderia pacientes silenciosamente.
    .limit(500),

    // Buscar templates de mensagem ativos
    supabase
      .from('templates_mensagem')
      .select('id, titulo, corpo')
      .eq('active', true)
      .limit(200),
  ])

  const solicitacoes = solicitacoesRes.data
  const templates = templatesRes.data

  return (
    <ConvocacaoClient 
      role={role}
      email={user.email || ''}
      solicitacoes={solicitacoes || []}
      templates={templates || []}
    />
  )
}
