'use server'

import { createAdminClient } from '@/utils/supabase/admin'

function maskName(name: string): string {
  if (!name) return ''
  const parts = name.trim().toUpperCase().split(/\s+/)
  return parts.map((part, idx) => {
    if (part.length <= 2) return part // e.g., "DA", "DE"
    // Keep the first character and replace the rest with asterisks
    return part[0] + '*'.repeat(Math.min(part.length - 1, 4))
  }).join(' ')
}

function maskCpf(cpf: string | null): string {
  if (!cpf) return ''
  const clean = cpf.replace(/\D/g, '')
  if (clean.length !== 11) return cpf
  return `***.***.${clean.substring(6, 9)}-**`
}

function maskCns(cns: string): string {
  if (!cns) return ''
  const clean = cns.replace(/\D/g, '')
  if (clean.length !== 15) return cns
  return `${clean.substring(0, 3)}****.****.${clean.substring(11, 15)}`
}

export async function searchCitizenWaitlist(identifier: string) {
  const cleanId = identifier.replace(/\D/g, '')
  if (cleanId.length !== 11 && cleanId.length !== 15) {
    throw new Error('Identificador inválido. Digite um CPF (11 dígitos) ou CNS (15 dígitos) válido.')
  }

  const supabase = createAdminClient()
  let patientQuery = supabase.from('pacientes').select('id, nome_usuario, cns_usuario, cpf_usuario')

  if (cleanId.length === 11) {
    patientQuery = patientQuery.eq('cpf_usuario', cleanId)
  } else {
    patientQuery = patientQuery.eq('cns_usuario', cleanId)
  }

  const { data: patient, error: patientError } = await patientQuery.maybeSingle()

  if (patientError) {
    console.error('Error fetching patient:', patientError)
    throw new Error('Erro ao consultar os dados do paciente.')
  }

  if (!patient) {
    throw new Error('Paciente não encontrado na base de regulação. Verifique se o CPF/CNS está correto ou se a importação do relatório já foi concluída.')
  }

  // Buscar solicitações ativas
  const { data: solicitacoes, error: solError } = await supabase
    .from('fila_solicitacoes')
    .select(`
      cod_solicitacao,
      data_solicitacao,
      posicao_fila,
      tipo_fila,
      status_interno,
      status_sisreg,
      procedimentos (desc_sigtap)
    `)
    .eq('paciente_id', patient.id)
    .eq('active', true)
    .order('data_solicitacao', { ascending: true })

  if (solError) {
    console.error('Error fetching patient solicitations:', solError)
    throw new Error('Erro ao consultar a lista de solicitações.')
  }

  return {
    patient: {
      nome: maskName(patient.nome_usuario),
      cns: maskCns(patient.cns_usuario),
      cpf: maskCpf(patient.cpf_usuario)
    },
    solicitacoes: (solicitacoes || []).map(sol => {
      const procedObj = sol.procedimentos as any
      const descSigtap = Array.isArray(procedObj)
        ? procedObj[0]?.desc_sigtap
        : procedObj?.desc_sigtap

      return {
        cod_solicitacao: sol.cod_solicitacao,
        data_solicitacao: sol.data_solicitacao,
        posicao_fila: sol.posicao_fila,
        tipo_fila: sol.tipo_fila,
        status_interno: sol.status_interno,
        status_sisreg: sol.status_sisreg,
        procedimento: descSigtap || 'Procedimento Não Especificado'
      }
    })
  }
}
