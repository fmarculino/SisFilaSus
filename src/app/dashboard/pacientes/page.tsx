import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { PacientesClient } from './PacientesClient'

export default async function PacientesPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string
    limit?: string
    search?: string
    municipio?: string
    unidadeReferencia?: string
  }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Obter perfil do usuário logado
  const { data: profile } = await supabase
    .from('users')
    .select('role, nome')
    .eq('id', user.id)
    .single()

  const role = profile?.role || 'OPERADOR_REGULACAO'

  // Apenas Administradores, Coordenadores e Operadores gerenciam pacientes
  const allowedRoles = ['SMS_ADMIN', 'COORDENADOR', 'OPERADOR_REGULACAO']
  if (!allowedRoles.includes(role)) {
    redirect('/dashboard')
  }

  const resolvedParams = await searchParams
  const page = parseInt(resolvedParams.page || '1', 10)
  const limit = parseInt(resolvedParams.limit || '20', 10)
  const offset = (page - 1) * limit

  let query = supabase
    .from('pacientes')
    .select('*, unidade_referencia:unidades_solicitantes(cnes, nome), pacientes_telefones(id, numero, tipo, status, prioridade, nome_contato, parentesco, observacoes)', { count: 'exact' })

  // Filtro de busca (Nome, CNS ou CPF)
  if (resolvedParams.search) {
    const searchVal = resolvedParams.search.trim()
    const cleanDigits = searchVal.replace(/\D/g, '')

    if (/^\d+$/.test(cleanDigits)) {
      if (cleanDigits.length === 15) {
        query = query.eq('cns_usuario', cleanDigits)
      } else if (cleanDigits.length === 11) {
        query = query.eq('cpf_usuario', cleanDigits)
      } else {
        query = query.or(`cns_usuario.like.%${cleanDigits}%,cpf_usuario.like.%${cleanDigits}%`)
      }
    } else {
      // Busca de nome multi-termo inteligente
      const words = searchVal.split(/\s+/).filter(w => w.length > 0)
      words.forEach(word => {
        query = query.ilike('nome_usuario', `%${word}%`)
      })
    }
  }

  if (resolvedParams.municipio) {
    query = query.eq('municipio_origem', resolvedParams.municipio)
  }

  if (resolvedParams.unidadeReferencia) {
    query = query.eq('unidade_referencia_cnes', resolvedParams.unidadeReferencia)
  }

  // Ordenar alfabeticamente
  query = query
    .order('nome_usuario', { ascending: true })
    .range(offset, offset + limit - 1)

  const [pacientesRes, municipiosRes, unidadesRes] = await Promise.all([
    query,
    supabase.from('municipios').select('nome').order('nome').limit(2000),
    supabase.from('unidades_solicitantes').select('cnes, nome').order('nome').limit(2000),
  ])

  const { data: pacientes, count } = pacientesRes

  const municipios = Array.from(
    new Set((municipiosRes.data || []).map(m => m.nome?.trim().toUpperCase()))
  ).filter(Boolean).sort() as string[]

  return (
    <PacientesClient
      role={role}
      email={user.email || ''}
      pacientes={pacientes || []}
      totalItems={count || 0}
      itemsPerPage={limit}
      currentPage={page}
      searchParam={resolvedParams.search || ''}
      municipioParam={resolvedParams.municipio || ''}
      unidadeReferenciaParam={resolvedParams.unidadeReferencia || ''}
      municipios={municipios}
      unidades={unidadesRes.data || []}
    />
  )
}
