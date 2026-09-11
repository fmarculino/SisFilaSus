import fs from 'fs'
import { createClient } from '@supabase/supabase-js'

const envFile = fs.readFileSync('.env.local', 'utf8')
const env = Object.fromEntries(
  envFile.split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#') && line.includes('='))
    .map(line => {
      const idx = line.indexOf('=')
      return [line.slice(0, idx).trim(), line.slice(idx + 1).trim()]
    })
)

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

export const NOVAS_ESPECIALIDADES = [
  {
    nome: 'RADIOLOGIA E DIAGNÓSTICO POR IMAGEM',
    descricao: 'Exames radiológicos, ultrassonografias, tomografias, ressonâncias e mamografias'
  },
  {
    nome: 'CLÍNICA MÉDICA',
    descricao: 'Atendimento clínico geral, diagnósticos e tratamentos ambulatoriais e hospitalares'
  },
  {
    nome: 'INFECTOLOGIA',
    descricao: 'Doenças infecciosas, parasitárias, bacterianas, virais e arboviroses'
  },
  {
    nome: 'PNEUMOLOGIA',
    descricao: 'Doenças do aparelho respiratório e vias aéreas inferiores'
  },
  {
    nome: 'CIRURGIA TORÁCICA',
    descricao: 'Cirurgias e procedimentos invasivos do tórax e mediastino'
  },
  {
    nome: 'CIRURGIA BUCOMAXILOFACIAL',
    descricao: 'Cirurgias e reconstruções maxilares, mandibulares e do esqueleto facial'
  },
  {
    nome: 'COLOPROCTOLOGIA',
    descricao: 'Afecções e cirurgias do intestino grosso, reto e ânus'
  },
  {
    nome: 'MASTOLOGIA',
    descricao: 'Diagnóstico e cirurgias das glândulas mamárias'
  },
  {
    nome: 'ONCOLOGIA',
    descricao: 'Tratamento clínico e cirúrgico de neoplasias e tumores'
  },
  {
    nome: 'HEMATOLOGIA',
    descricao: 'Doenças do sangue, órgãos hematopoéticos e coagulopatias'
  },
  {
    nome: 'REUMATOLOGIA',
    descricao: 'Doenças articulares, autoimunes e do tecido conjuntivo'
  },
  {
    nome: 'PSIQUIATRIA',
    descricao: 'Transtornos mentais, comportamentais e atenção psicossocial'
  },
  {
    nome: 'PSICOLOGIA',
    descricao: 'Avaliação psicológica, neuropsicologia e psicopedagogia'
  },
  {
    nome: 'FISIOTERAPIA',
    descricao: 'Reabilitação física, motora, neurofuncional e respiratória'
  },
  {
    nome: 'FONOAUDIOLOGIA',
    descricao: 'Reabilitação fonoaudiológica, distúrbios da comunicação, voz e audição'
  },
  {
    nome: 'PATOLOGIA CLÍNICA',
    descricao: 'Exames laboratoriais, biópsias e análises citopatológicas'
  },
  {
    nome: 'EQUIPE MULTIDISCIPLINAR',
    descricao: 'Práticas integrativas, terapias complementares e equipe multiprofissional'
  }
]

export function classificarProcedimento(p) {
  const cod = p.cod_sigtap.trim()
  const desc = (p.desc_sigtap || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const grupoAtual = (p.grupo_descricao || '').toUpperCase().trim()

  // Se já possui uma especialidade válida estabelecida manualmente (exceto "GERAL" ou rótulos brutos "GRUPO - ...")
  if (grupoAtual && !grupoAtual.includes('GERAL') && !grupoAtual.startsWith('GRUPO - ') && grupoAtual !== 'SEM_GRUPO') {
    // Normalizar nomes conhecidos
    if (grupoAtual === 'CIRURGIA PLASTICA') return 'CIRURGIA PLASTICA'
    return grupoAtual
  }

  // 1. Códigos Municipais / Internos SISREG (iniciados com 90)
  if (cod.startsWith('90')) {
    // Ortopedia
    if (
      desc.includes('FRATURA') || desc.includes('RADIO') || desc.includes('ULNA') || 
      desc.includes('PERNA') || desc.includes('HALUX') || desc.includes('TARSO') || 
      desc.includes('SINDACTILIA') || desc.includes('PE TORTO') || desc.includes('TORNOZELO') || 
      desc.includes('ANTEBRACO') || desc.includes('AMPUTACAO') || desc.includes('POLIDACTILIA') || 
      desc.includes('TUMOR OSSEO') || desc.includes('TUNEL DO CARPO') || desc.includes('ARTRODESE') || 
      desc.includes('TIBIAL') || desc.includes('TIBIA') || desc.includes('BURSECTOMIA') || 
      desc.includes('OSTEOTOMIA') || desc.includes('PSEUDARTROSE') || desc.includes('LUXACAO') || 
      desc.includes('LIGAMENTO') || desc.includes('MENISCO') || desc.includes('JOELHO') || 
      desc.includes('FEMUR') || desc.includes('OMBRO') || desc.includes('COTOVELO') || 
      desc.includes('QUADRIL') || desc.includes('FASCITE') || desc.includes('TENDINITIS') || 
      desc.includes('TENDA') || desc.includes('TENOSINOVITE') || desc.includes('TENOSIVECTOMIA') || 
      desc.includes('CARPO') || desc.includes('CUBITO') || desc.includes('BRACO') || 
      desc.includes('UMERO') || desc.includes('CLAVICULA') || desc.includes('ESCAPULA') || 
      desc.includes('PINO') || desc.includes('FIO') || desc.includes('PLACA') || 
      desc.includes('PARAFUSO') || desc.includes('METACARPIANO') || desc.includes('METATARSO') ||
      desc.includes('DEFORMIDADES ADQUIRIDAS DO TORNOZELO')
    ) {
      return 'ORTOPEDIA E TRAUMATOLOGIA'
    }

    // Urologia
    if (
      desc.includes('VARICOCELE') || desc.includes('PROSTATA') || desc.includes('PREPUCIO') || 
      desc.includes('URETRA') || desc.includes('BEXIGA') || desc.includes('POSTECTOMIA') || 
      desc.includes('HIDROCELE') || desc.includes('FIMOSE') || desc.includes('ORQUIDOPEXIA') || 
      desc.includes('VASECTOMIA') || desc.includes('CISTO SEBACEO PREPUCIO') || 
      desc.includes('HIPOSPADIA') || desc.includes('FREIO PENIANO') || desc.includes('CALCULO URETRAL') || 
      desc.includes('CAUTERIZACAO PENIANA') || desc.includes('LESÃO GENITAL') || 
      desc.includes('URETROTOMIA') || desc.includes('URETROPLASTIA') || desc.includes('DUPLO J') ||
      desc.includes('RTU DA PROSTATA') || desc.includes('VESICAL')
    ) {
      return 'UROLOGIA'
    }

    // Coloproctologia
    if (
      desc.includes('PROLAPSO ANAL') || desc.includes('HEMORROID') || desc.includes('FISTULA ANAL') || 
      desc.includes('FISSURA ANAL') || desc.includes('ESFINCTEROTOMIA') || desc.includes('ESFINCTEROPLASTIA') ||
      desc.includes('FISTULA DE RETO') || desc.includes('ANU-RETAL')
    ) {
      return 'COLOPROCTOLOGIA'
    }

    // Cirurgia Geral
    if (
      desc.includes('HERNIA') || desc.includes('VESICULA') || desc.includes('COLECIST') || 
      desc.includes('APENDIC') || desc.includes('LIPOMA') || desc.includes('SEBACEO') || 
      desc.includes('EXTIRPACAO E SUPRESSAO DE LESAO') || desc.includes('CISTO EPIDERMICO') ||
      desc.includes('CISTO DERMOIDE')
    ) {
      return 'CIRURGIA GERAL'
    }

    // Cirurgia Plástica
    if (desc.includes('ENXERTO DE PELE') || desc.includes('ROTACAO DE RETALHO')) {
      return 'CIRURGIA PLASTICA'
    }

    // Oftalmologia
    if (desc.includes('CATARATA') || desc.includes('PTERIGIO') || desc.includes('OLHO')) {
      return 'OFTALMOLOGIA'
    }
  }

  // 2. SIGTAP Prefix 02: Procedimentos Diagnósticos
  if (cod.startsWith('0204') || cod.startsWith('0205') || cod.startsWith('0206') || cod.startsWith('0207')) {
    return 'RADIOLOGIA E DIAGNÓSTICO POR IMAGEM'
  }
  if (cod.startsWith('0209')) {
    return 'GASTROENTEROLOGIA'
  }
  if (cod.startsWith('0201')) {
    if (desc.includes('PROSTATA')) return 'UROLOGIA'
    return 'PATOLOGIA CLÍNICA'
  }
  if (cod.startsWith('0211')) {
    if (desc.includes('PSICO')) return 'PSICOLOGIA'
    if (desc.includes('NEURO') || desc.includes('ENMG') || desc.includes('ELETROENCEFALO')) return 'NEUROLOGIA'
    if (desc.includes('ESFORCO') || desc.includes('ERGOMETR') || desc.includes('CARDIO') || desc.includes('ECG') || desc.includes('HOLTER') || desc.includes('MAPA') || desc.includes('ECOCARDIOGRAMA')) return 'CARDIOLOGIA'
    if (desc.includes('AUDIOMETRIA') || desc.includes('IMITANCIO') || desc.includes('POTENCIAL EVOCADO AUDITIVO')) return 'FONOAUDIOLOGIA'
    if (desc.includes('ESPIROMETRIA')) return 'PNEUMOLOGIA'
    return 'CARDIOLOGIA'
  }
  if (cod.startsWith('0816')) return 'PATOLOGIA CLÍNICA'

  // 3. SIGTAP Prefix 04: Cirurgias
  if (cod.startsWith('0408')) return 'ORTOPEDIA E TRAUMATOLOGIA'
  if (cod.startsWith('0405')) return 'OFTALMOLOGIA'
  if (cod.startsWith('0403')) return 'NEUROCIRURGIA'
  if (cod.startsWith('0410')) return 'MASTOLOGIA'
  if (cod.startsWith('0411')) return 'GINECOLOGIA E OBSTETRICIA'
  if (cod.startsWith('0412')) return 'CIRURGIA TORÁCICA'
  if (cod.startsWith('0413')) return 'CIRURGIA PLASTICA'
  if (cod.startsWith('0414')) return 'CIRURGIA BUCOMAXILOFACIAL'
  if (cod.startsWith('0402')) return 'CIRURGIA CABEÇA E PESCOÇO'

  if (cod.startsWith('0404')) {
    if (
      desc.includes('MANDIBULA') || desc.includes('MAXILA') || desc.includes('ZIGOMATICO') || 
      desc.includes('DENTE') || desc.includes('MAXILO') || desc.includes('BUCO')
    ) {
      return 'CIRURGIA BUCOMAXILOFACIAL'
    }
    if (
      desc.includes('TIREOIDE') || desc.includes('PAROTIDA') || desc.includes('CISTO BRANQUIAL') || 
      desc.includes('PESCOCO') || desc.includes('SUBLINGUAL') || desc.includes('SUBMANDIBULAR')
    ) {
      return 'CIRURGIA CABEÇA E PESCOÇO'
    }
    return 'OTORRINOLARINGOLOGIA'
  }

  if (cod.startsWith('0406')) return 'CIRURGIA VASCULAR'

  if (cod.startsWith('0407')) {
    if (
      desc.includes('PROCTO') || desc.includes('HEMORROID') || desc.includes('ANAL') || 
      desc.includes('FISSURA') || desc.includes('FISTULA RET') || desc.includes('ESFINCTER') ||
      desc.includes('COLON') || desc.includes('COLECTOMIA') || desc.includes('RETO')
    ) {
      return 'COLOPROCTOLOGIA'
    }
    return 'CIRURGIA GERAL'
  }

  if (cod.startsWith('0409')) {
    if (
      desc.includes('HISTER') || desc.includes('COLPO') || desc.includes('VAGIN') || 
      desc.includes('VULV') || desc.includes('OVAR') || desc.includes('TUBA') || 
      desc.includes('SALPING') || desc.includes('UTER') || desc.includes('ENDOMETR') || 
      desc.includes('CURETAGEM') || desc.includes('PARTO')
    ) {
      return 'GINECOLOGIA E OBSTETRICIA'
    }
    return 'UROLOGIA'
  }

  if (cod.startsWith('0416')) {
    if (
      desc.includes('NEFRECTOMIA') || desc.includes('PROSTATECTOMIA') || 
      desc.includes('ORQUIECTOMIA') || desc.includes('PENIS') || desc.includes('BEXIGA')
    ) {
      return 'UROLOGIA'
    }
    if (desc.includes('MAMA') || desc.includes('MASTECTOMIA')) return 'MASTOLOGIA'
    return 'ONCOLOGIA'
  }

  if (cod.startsWith('0401')) {
    if (desc.includes('CISTO BRANQUIAL')) return 'CIRURGIA CABEÇA E PESCOÇO'
    if (desc.includes('PLASTICA') || desc.includes('RETALHO') || desc.includes('ENXERTO')) return 'CIRURGIA PLASTICA'
    return 'CIRURGIA GERAL'
  }

  if (cod.startsWith('0415')) return 'CIRURGIA GERAL'

  // 4. SIGTAP Prefix 03: Procedimentos Clínicos
  if (cod.startsWith('0302')) return 'FISIOTERAPIA'
  if (cod.startsWith('0304')) return 'ONCOLOGIA'
  if (cod.startsWith('0310')) return 'GINECOLOGIA E OBSTETRICIA'
  if (cod.startsWith('0305')) return 'NEFROLOGIA'

  if (cod.startsWith('0301')) {
    if (desc.includes('COMUNICACAO ALTERNATIVA') || desc.includes('FONOAUDIOLOG') || desc.includes('AUDITIVA')) return 'FONOAUDIOLOGIA'
    if (desc.includes('NEUROPSICOLOG') || desc.includes('PSICOPEDAGOG') || desc.includes('PSICOLOG')) return 'PSICOLOGIA'
    if (desc.includes('FISIOTERAP') || desc.includes('REABILITACAO DO DESENVOLVIMENTO NEUROPSICOMOTOR') || desc.includes('MULTIPLAS DEFICIENCIAS')) return 'FISIOTERAPIA'
    if (desc.includes('CIRURGICA')) return 'CIRURGIA GERAL'
    if (desc.includes('PEDIATRIA') || desc.includes('RECEM-NASCIDO')) return 'PEDIATRIA'
    return 'CLÍNICA MÉDICA'
  }

  if (cod.startsWith('0303')) {
    // 03.03.01 - Infecciosas
    if (cod.startsWith('030301')) return 'INFECTOLOGIA'
    // 03.03.02 - Hematologia / Metabolismo
    if (cod.startsWith('030302')) return 'HEMATOLOGIA'
    // 03.03.03 - Endocrinologia
    if (cod.startsWith('030303')) return 'ENDOCRINOLOGIA'
    // 03.03.04 - Neurologia
    if (cod.startsWith('030304')) return 'NEUROLOGIA'
    // 03.03.05 - Oftalmologia
    if (cod.startsWith('030305')) return 'OFTALMOLOGIA'
    // 03.03.06 - Cardiologia / Circulatório
    if (cod.startsWith('030306')) {
      if (desc.includes('CHOQUE ANAFILATICO')) return 'CLÍNICA MÉDICA'
      if (desc.includes('LINFADENITE')) return 'INFECTOLOGIA'
      if (desc.includes('VASCULOPATIA')) return 'CIRURGIA VASCULAR'
      return 'CARDIOLOGIA'
    }
    // 03.03.07 - Gastroenterologia
    if (cod.startsWith('030307')) return 'GASTROENTEROLOGIA'
    // 03.03.08 - Dermatologia / Infecciosas
    if (cod.startsWith('030308')) {
      if (desc.includes('ESTAFILO') || desc.includes('ESTREPTO') || desc.includes('SEPSE')) return 'INFECTOLOGIA'
      return 'DERMATOLOGIA'
    }
    // 03.03.09 - Ortopedia / Reumatologia
    if (cod.startsWith('030309')) return 'ORTOPEDIA E TRAUMATOLOGIA'
    // 03.03.10 - Ginecologia / Obstetrícia
    if (cod.startsWith('030310')) return 'GINECOLOGIA E OBSTETRICIA'
    // 03.03.11 - Malformações osteomusculares
    if (cod.startsWith('030311')) return 'ORTOPEDIA E TRAUMATOLOGIA'
    // 03.03.14 - Respiratório
    if (cod.startsWith('030314')) {
      if (desc.includes('VIAS AEREAS SUPERIORES')) return 'OTORRINOLARINGOLOGIA'
      return 'PNEUMOLOGIA'
    }
    // 03.03.15 - Nefrologia / Urologia / Ginecologia
    if (cod.startsWith('030315')) {
      if (desc.includes('GENITAIS MASCULINOS')) return 'UROLOGIA'
      if (desc.includes('PELVICOS FEMININOS')) return 'GINECOLOGIA E OBSTETRICIA'
      return 'NEFROLOGIA'
    }
    // 03.03.16 - Perinatal / Pediatria
    if (cod.startsWith('030316')) return 'PEDIATRIA'
    // 03.03.17 - Psiquiatria / Saúde mental
    if (cod.startsWith('030317')) return 'PSIQUIATRIA'
    // 03.03.18 - HIV / Infectologia
    if (cod.startsWith('030318')) return 'INFECTOLOGIA'

    // Fallback inteligente para subgrupos de 0303
    if (desc.includes('CEREBRO') || desc.includes('MEDULA') || desc.includes('SISTEMA NERVOSO') || desc.includes('AVC')) return 'NEUROLOGIA'
    if (desc.includes('CARDIACO') || desc.includes('CORACAO') || desc.includes('ARRITMIA')) return 'CARDIOLOGIA'
    if (desc.includes('RESPIRAT') || desc.includes('PNEUM') || desc.includes('PULMAO')) return 'PNEUMOLOGIA'
    if (desc.includes('INFEC') || desc.includes('COVID') || desc.includes('DENGUE')) return 'INFECTOLOGIA'
    if (desc.includes('RENAL') || desc.includes('RINS')) return 'NEFROLOGIA'
    return 'CLÍNICA MÉDICA'
  }

  if (cod.startsWith('0308')) return 'CLÍNICA MÉDICA'
  if (cod.startsWith('0101')) return 'EQUIPE MULTIDISCIPLINAR'
  if (cod.startsWith('0906')) return 'GINECOLOGIA E OBSTETRICIA'
  if (cod.startsWith('0902')) return 'CARDIOLOGIA'

  return 'CLÍNICA MÉDICA'
}

async function runEnrichment() {
  console.log('--- INICIANDO VINCULAÇÃO DE ESPECIALIDADES E PROCEDIMENTOS ---')

  // 1. Inserir/Garantir Novas Especialidades
  console.log('\n1. Verificando e criando especialidades no banco...')
  let espCriadas = 0
  for (const esp of NOVAS_ESPECIALIDADES) {
    const { data: existing } = await supabase
      .from('especialidades')
      .select('id')
      .eq('nome', esp.nome)
      .maybeSingle()

    if (!existing) {
      const { error } = await supabase.from('especialidades').insert({
        nome: esp.nome,
        descricao: esp.descricao,
        active: true
      })
      if (error) {
        console.error(`Erro ao criar especialidade ${esp.nome}:`, error.message)
      } else {
        console.log(`[+] Especialidade criada: ${esp.nome}`)
        espCriadas++
      }
    }
  }
  console.log(`Total de novas especialidades criadas: ${espCriadas}`)

  // 2. Buscar todos os procedimentos
  console.log('\n2. Buscando catálogo de procedimentos...')
  const { data: procedimentos, error: errProc } = await supabase
    .from('procedimentos')
    .select('cod_sigtap, desc_sigtap, grupo_descricao')

  if (errProc || !procedimentos) {
    throw new Error(`Erro ao buscar procedimentos: ${errProc?.message}`)
  }

  console.log(`Total de procedimentos no banco: ${procedimentos.length}`)

  // 3. Classificar e atualizar procedimentos
  let atualizados = 0
  let inalterados = 0
  const resumoPorEspecialidade = {}

  console.log('\n3. Atualizando especialidade/grupo dos procedimentos...')

  for (const p of procedimentos) {
    const especialidadeCalculada = classificarProcedimento(p)
    resumoPorEspecialidade[especialidadeCalculada] = (resumoPorEspecialidade[especialidadeCalculada] || 0) + 1

    // Se o grupo atual for diferente da especialidade calculada, atualizar
    if (p.grupo_descricao !== especialidadeCalculada) {
      const { error: errUpd } = await supabase
        .from('procedimentos')
        .update({
          grupo_descricao: especialidadeCalculada
        })
        .eq('cod_sigtap', p.cod_sigtap)

      if (errUpd) {
        console.error(`Erro ao atualizar procedimento ${p.cod_sigtap}:`, errUpd.message)
      } else {
        atualizados++
      }
    } else {
      inalterados++
    }
  }

  console.log('\n--- RESULTADO DA VINCULAÇÃO ---')
  console.log(`Procedimentos atualizados: ${atualizados}`)
  console.log(`Procedimentos já alinhados: ${inalterados}`)
  console.log(`Total geral: ${procedimentos.length}`)
  console.log('\nDistribuição por Especialidade:')
  console.table(
    Object.entries(resumoPorEspecialidade)
      .sort((a, b) => b[1] - a[1])
      .map(([especialidade, total]) => ({ Especialidade: especialidade, Quantidade: total }))
  )
  console.log('\n--- PROCESSO CONCLUÍDO COM SUCESSO! ---')
}

runEnrichment().catch(err => {
  console.error('Falha fatal na execução:', err)
  process.exit(1)
})

