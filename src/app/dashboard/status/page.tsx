import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { StatusClient } from './StatusClient'

// Lista de fallback caso a tabela ainda não tenha sido populada
const DEFAULT_STATUS_FALLBACK = [
  { codigo: 'NA_FILA', nome: 'Na Fila', origem: 'SISREG', cor: 'slate', ordem: 10, active: true },
  { codigo: 'EM_CONVOCACAO', nome: 'Em Convocação', origem: 'SisFilaSus', cor: 'blue', ordem: 20, active: true },
  { codigo: 'CONVOCADO_CONFIRMADO', nome: 'Confirmado', origem: 'SisFilaSus', cor: 'emerald', ordem: 30, active: true },
  { codigo: 'CONVOCADO_RECUSOU', nome: 'Recusou', origem: 'SisFilaSus', cor: 'rose', ordem: 40, active: true },
  { codigo: 'SEM_CONTATO', nome: 'Sem Contato', origem: 'SisFilaSus', cor: 'amber', ordem: 50, active: true },
  { codigo: 'ABSENTEISMO', nome: 'Absenteísmo', origem: 'SisFilaSus', cor: 'orange', ordem: 60, active: true },
  { codigo: 'ENCAMINHADO', nome: 'Encaminhado Hospital/Clínica', origem: 'SisFilaSus', cor: 'sky', ordem: 70, active: true },
  { codigo: 'INTERNADO', nome: 'Internado', origem: 'SisFilaSus', cor: 'indigo', ordem: 80, active: true },
  { codigo: 'PROCEDIMENTO_REALIZADO', nome: 'Procedimento Realizado', origem: 'SisFilaSus', cor: 'teal', ordem: 90, active: true },
  { codigo: 'ALTA', nome: 'Alta', origem: 'SisFilaSus', cor: 'green', ordem: 100, active: true },
  { codigo: 'DESISTENCIA', nome: 'Desistência', origem: 'SisFilaSus', cor: 'purple', ordem: 110, active: true },
  { codigo: 'OBITO', nome: 'Óbito', origem: 'SisFilaSus', cor: 'neutral', ordem: 120, active: true },
  { codigo: 'NAO_ENCONTRADO_SISREG', nome: 'Fora do SISREG', origem: 'SISREG', cor: 'amber', ordem: 130, active: true }
]

export default async function StatusPage() {
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

  const allowedRoles = ['SMS_ADMIN', 'COORDENADOR']
  if (!allowedRoles.includes(role)) {
    redirect('/dashboard')
  }

  // Buscar status do banco de dados ordenados
  const { data: dbStatus, error } = await supabase
    .from('status_solicitacao')
    .select('*')
    .order('ordem', { ascending: true })

  let initialStatusList = dbStatus || []
  if (error || initialStatusList.length === 0) {
    if (error) console.error('Aviso: Tabela status_solicitacao ainda não carregada:', error.message)
    initialStatusList = DEFAULT_STATUS_FALLBACK
  }

  return (
    <StatusClient
      role={role}
      email={user.email || ''}
      initialStatusList={initialStatusList}
    />
  )
}
