'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function fetchDivergenciasAction() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('divergencias_sisreg')
    .select(`
      id,
      tipo_divergencia,
      status_sisreg_importado,
      status_interno_local,
      created_at,
      solicitacao:fila_solicitacoes!inner (
        cod_solicitacao,
        posicao_fila,
        pacientes!inner (nome_usuario, cns_usuario, cpf_usuario),
        procedimentos!inner (cod_sigtap, desc_sigtap)
      )
    `)
    .eq('resolvido', false)
    .order('created_at', { ascending: false })
    // Teto explicito no lugar do corte silencioso de 1000 linhas do PostgREST.
    .limit(500)

  if (error) {
    console.error('Erro ao buscar divergências:', error.message)
    return { success: false, error: error.message, data: [] }
  }

  const mappedData = (data || []).map((d: any) => {
    const sol = Array.isArray(d.solicitacao) ? d.solicitacao[0] : d.solicitacao
    const paciente = Array.isArray(sol?.pacientes) ? sol.pacientes[0] : sol?.pacientes
    const procedimento = Array.isArray(sol?.procedimentos) ? sol.procedimentos[0] : sol?.procedimentos

    return {
      id: d.id,
      tipo_divergencia: d.tipo_divergencia,
      status_sisreg_importado: d.status_sisreg_importado,
      status_interno_local: d.status_interno_local,
      created_at: d.created_at,
      solicitacao: {
        cod_solicitacao: Number(sol?.cod_solicitacao),
        posicao_fila: sol?.posicao_fila ? Number(sol.posicao_fila) : null,
        pacientes: {
          nome_usuario: String(paciente?.nome_usuario || ''),
          cns_usuario: String(paciente?.cns_usuario || ''),
          cpf_usuario: paciente?.cpf_usuario ? String(paciente.cpf_usuario) : null
        },
        procedimentos: {
          cod_sigtap: String(procedimento?.cod_sigtap || ''),
          desc_sigtap: String(procedimento?.desc_sigtap || '')
        }
      }
    }
  })

  return { success: true, data: mappedData as any[] }
}

export async function resolveDivergenciaAction(divergenciaId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Usuário não autenticado.' }
  }

  const { error } = await supabase
    .from('divergencias_sisreg')
    .update({
      resolvido: true,
      resolvido_por: user.id,
      resolvido_em: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', divergenciaId)

  if (error) {
    console.error('Erro ao resolver divergência:', error.message)
    return { success: false, error: error.message }
  }

  revalidatePath('/dashboard/sincronizacao')
  return { success: true }
}
