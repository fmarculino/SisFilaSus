import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { ConfiguracoesClient } from './ConfiguracoesClient'
import { getCommunicationConfig } from '@/lib/communication'

export default async function ConfiguracoesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Obter perfil do usuário logado
  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = profile?.role || 'OPERADOR_REGULACAO'

  // Restrição de acesso: Apenas SMS_ADMIN e COORDENADOR podem gerenciar parâmetros gerais
  const allowedRoles = ['SMS_ADMIN', 'COORDENADOR']
  if (!allowedRoles.includes(role)) {
    redirect('/dashboard')
  }

  // Buscar as configurações gerais no banco de dados
  const { data: configRow } = await supabase
    .from('configuracoes')
    .select('valor')
    .eq('chave', 'geral')
    .maybeSingle()

  // Valores padrão de fallback
  const defaultConfig = {
    limite_tentativas_contato: 3,
    anos_limpeza_fila: 5,
    municipio_sede: 'MARABÁ',
    omitir_fora_sisreg_padrao: true
  }

  const config = configRow?.valor 
    ? { ...defaultConfig, ...(configRow.valor as any) }
    : defaultConfig

  // Buscar configurações de comunicação (DB + env fallbacks)
  const communicationConfig = await getCommunicationConfig()

  return (
    <ConfiguracoesClient
      role={role}
      email={user.email || ''}
      config={config}
      communicationConfig={communicationConfig}
    />
  )
}
