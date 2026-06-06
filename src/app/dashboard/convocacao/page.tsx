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
  const { data: solicitacoes } = await supabase
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
      pacientes (id, nome_usuario, cns_usuario, cpf_usuario, telefone_1, telefone_2),
      procedimentos (cod_sigtap, desc_sigtap),
      unidades_solicitantes (nome)
    `)
    .eq('active', true)
    .in('status_interno', ['EM_CONVOCACAO', 'SEM_CONTATO'])
    .order('posicao_fila', { ascending: true, nullsFirst: false })

  // Buscar templates de mensagem ativos
  const { data: templates } = await supabase
    .from('templates_mensagem')
    .select('id, titulo, corpo')
    .eq('active', true)

  return (
    <ConvocacaoClient 
      role={role}
      email={user.email || ''}
      solicitacoes={solicitacoes || []}
      templates={templates || []}
    />
  )
}
