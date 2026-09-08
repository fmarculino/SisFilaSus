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

export type CitizenWaitlistResponse = {
  success: boolean
  error?: string
  data?: {
    patient: {
      nome: string
      cns: string
      cpf: string
    }
    solicitacoes: Array<{
      cod_solicitacao: number
      data_solicitacao: string
      posicao_fila: number | null
      tipo_fila: number
      status_interno: string
      status_sisreg: string | null
      procedimento: string
    }>
  }
}

export async function searchCitizenWaitlist(identifier: string): Promise<CitizenWaitlistResponse> {
  try {
    const cleanId = identifier.replace(/\D/g, '')
    if (cleanId.length !== 11 && cleanId.length !== 15) {
      return {
        success: false,
        error: 'Identificador inválido. Por favor, digite um CPF com 11 dígitos ou o Cartão SUS (CNS) com 15 dígitos.'
      }
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
      return {
        success: false,
        error: 'Não foi possível consultar os dados no momento. Por favor, tente novamente em instantes.'
      }
    }

    if (!patient) {
      const tipoDoc = cleanId.length === 11 ? 'CPF' : 'Cartão SUS (CNS)'
      return {
        success: false,
        error: `Nenhum registro encontrado para este ${tipoDoc}. Verifique se o número foi digitado corretamente ou se o cadastro já foi inserido pela regulação municipal.`
      }
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
      return {
        success: false,
        error: 'Erro ao consultar a lista de solicitações. Por favor, tente novamente mais tarde.'
      }
    }

    return {
      success: true,
      data: {
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
  } catch (err: any) {
    console.error('Unexpected error in searchCitizenWaitlist:', err)
    return {
      success: false,
      error: 'Ocorreu uma instabilidade na consulta. Por favor, verifique sua conexão e tente novamente.'
    }
  }
}
