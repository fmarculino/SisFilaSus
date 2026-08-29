-- =========================================================
-- MIGRAÇÃO: Módulo de Agendamentos & Cirurgias Eletivas
-- SisFilaSUS — Marabá
-- Executar manualmente no Supabase SQL Editor
-- =========================================================

-- 1. Tabela de Oferta de Agendas / Vagas pelos Prestadores
CREATE TABLE IF NOT EXISTS public.agendas_prestadores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hospital_id UUID REFERENCES public.hospitais_prestadores(id) ON DELETE SET NULL,
    medico_nome VARCHAR(255) NOT NULL,
    especialidade VARCHAR(100) NOT NULL,          -- Ex: CIRURGIA GERAL, UROLOGIA, PEQUENAS CIRURGIAS, etc.
    data_agenda DATE NOT NULL,
    horario_inicio VARCHAR(10) NOT NULL DEFAULT '08:00',
    quantidade_vagas INT NOT NULL DEFAULT 15,
    tipo_agenda VARCHAR(50) NOT NULL DEFAULT 'CONSULTA_PRE_OP' CHECK (
        tipo_agenda IN ('CONSULTA_PRE_OP', 'CIRURGIA_ELETIVA', 'PEQUENA_CIRURGIA', 'EXAME_ESPECIALIZADO')
    ),
    observacoes_bloqueio TEXT,                   -- Ex: Sala 2, Trazer exames pré-op
    active BOOLEAN DEFAULT true NOT NULL,
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Tabela de Agendamentos dos Pacientes nas Agendas
CREATE TABLE IF NOT EXISTS public.agendamentos_procedimentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agenda_id UUID NOT NULL REFERENCES public.agendas_prestadores(id) ON DELETE CASCADE,
    cod_solicitacao BIGINT NOT NULL REFERENCES public.fila_solicitacoes(cod_solicitacao) ON DELETE CASCADE,
    paciente_id UUID NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
    
    -- Controle da Consulta Pré-Operatória
    compareceu_consulta BOOLEAN,                  -- NULL=Pendente, true=SIM, false=NÃO
    data_consulta_realizada DATE,
    parecer_pre_op VARCHAR(50) CHECK (
        parecer_pre_op IN ('APTO_CIRURGIA', 'INAPTO_TEMPORARIO', 'INAPTO_DEFINITIVO', 'ENCAMINHADO_OUTRO_SERVICO')
    ),
    
    -- Controle do Procedimento Cirúrgico
    data_cirurgia_agendada DATE,
    cirurgia_realizada BOOLEAN,                  -- NULL=Pendente, true=SIM, false=NÃO
    data_cirurgia_execucao DATE,
    data_internacao DATE,
    data_alta DATE,
    data_retorno_pos_op DATE,
    
    -- Status do Fluxo / Kanban
    status_agendamento VARCHAR(50) DEFAULT 'AGENDADO_PRE_OP' NOT NULL CHECK (
        status_agendamento IN (
            'EM_CONVOCACAO',             -- Operador contactando
            'AGENDADO_PRE_OP',           -- Consulta agendada
            'CONSULTA_REALIZADA',        -- Compareceu e avaliado
            'AGUARDANDO_CIRURGIA',       -- Apto, aguardando data de cirurgia
            'CIRURGIA_AGENDADA',         -- Cirurgia agendada com data
            'CIRURGIA_REALIZADA',        -- Cirurgia executada com sucesso
            'ABSENTEISMO_CONSULTA',      -- Faltou à consulta pré-op
            'ABSENTEISMO_CIRURGIA',      -- Faltou no dia da cirurgia
            'INAPTO_RISCO_CIRURGICO',    -- Reprovado por risco cardiológico/anestésico
            'DESISTENCIA_PACIENTE',      -- Paciente recusou ou desistiu
            'ENCAMINHADO_ALTA_COMPLEXIDADE' -- Ex: HMM / UTI / Hospital Regional
        )
    ),
    
    observacoes_clinicas TEXT,                   -- Anotações livres (ex: "Cardiologista não autorizou")
    exportado_sisreg BOOLEAN DEFAULT false NOT NULL, -- Flag para relatório de devolutiva
    data_exportacao_sisreg TIMESTAMPTZ,
    
    agendado_por UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    -- Restrição: uma solicitação não pode estar duplicada na mesma agenda
    CONSTRAINT uk_solicitacao_agenda UNIQUE (agenda_id, cod_solicitacao)
);

-- 3. Índices de performance
CREATE INDEX IF NOT EXISTS idx_agendas_data ON public.agendas_prestadores(data_agenda, hospital_id);
CREATE INDEX IF NOT EXISTS idx_agendas_especialidade ON public.agendas_prestadores(especialidade);
CREATE INDEX IF NOT EXISTS idx_agendamentos_agenda ON public.agendamentos_procedimentos(agenda_id);
CREATE INDEX IF NOT EXISTS idx_agendamentos_sol ON public.agendamentos_procedimentos(cod_solicitacao);
CREATE INDEX IF NOT EXISTS idx_agendamentos_paciente ON public.agendamentos_procedimentos(paciente_id);
CREATE INDEX IF NOT EXISTS idx_agendamentos_status ON public.agendamentos_procedimentos(status_agendamento);
CREATE INDEX IF NOT EXISTS idx_agendamentos_exportado ON public.agendamentos_procedimentos(exportado_sisreg);

-- 4. Triggers de updated_at
CREATE TRIGGER update_agendas_prestadores_updated_at
  BEFORE UPDATE ON public.agendas_prestadores
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_agendamentos_procedimentos_updated_at
  BEFORE UPDATE ON public.agendamentos_procedimentos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Habilitar RLS
ALTER TABLE public.agendas_prestadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agendamentos_procedimentos ENABLE ROW LEVEL SECURITY;

-- 6. Políticas RLS
CREATE POLICY "Autenticados leem agendas"
  ON public.agendas_prestadores FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admins, coordenadores e operadores gerenciam agendas"
  ON public.agendas_prestadores FOR ALL
  USING (public.get_user_role() IN ('SMS_ADMIN', 'COORDENADOR', 'OPERADOR_REGULACAO'));

CREATE POLICY "Autenticados leem agendamentos"
  ON public.agendamentos_procedimentos FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admins, coordenadores e operadores gerenciam agendamentos"
  ON public.agendamentos_procedimentos FOR ALL
  USING (public.get_user_role() IN ('SMS_ADMIN', 'COORDENADOR', 'OPERADOR_REGULACAO', 'AUXILIAR'));
