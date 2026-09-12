-- =========================================================================
-- MIGRAÇÃO: CADASTRO DINÂMICO DE STATUS INTERNO DA FILA
-- SISFILASUS — MARABÁ
-- =========================================================================

-- 1. Criar a tabela de status_solicitacao
CREATE TABLE IF NOT EXISTS public.status_solicitacao (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo VARCHAR(50) UNIQUE NOT NULL,
    nome VARCHAR(100) NOT NULL,
    origem VARCHAR(50) DEFAULT 'SisFilaSus' NOT NULL,
    cor VARCHAR(30) NOT NULL DEFAULT 'blue',
    descricao TEXT,
    active BOOLEAN DEFAULT true NOT NULL,
    bloqueado_edicao_codigo BOOLEAN DEFAULT false NOT NULL,
    ordem INT DEFAULT 0 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Remover a restrição CHECK estática de fila_solicitacoes para permitir novos status dinâmicos
ALTER TABLE public.fila_solicitacoes DROP CONSTRAINT IF EXISTS fila_solicitacoes_status_interno_check;

-- 3. Índices de busca e ordenação
CREATE INDEX IF NOT EXISTS idx_status_solicitacao_active ON public.status_solicitacao (active, ordem);
CREATE INDEX IF NOT EXISTS idx_status_solicitacao_codigo ON public.status_solicitacao (codigo);

-- 4. Habilitar RLS na tabela status_solicitacao
ALTER TABLE public.status_solicitacao ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Todos autenticados e anonimos leem status" ON public.status_solicitacao;
CREATE POLICY "Todos autenticados e anonimos leem status" 
ON public.status_solicitacao 
FOR SELECT 
USING (true);

DROP POLICY IF EXISTS "Apenas admins e coordenadores gerenciam status" ON public.status_solicitacao;
CREATE POLICY "Apenas admins e coordenadores gerenciam status" 
ON public.status_solicitacao 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.users u 
    WHERE u.id = auth.uid() 
      AND u.role IN ('SMS_ADMIN', 'COORDENADOR')
  )
);

-- 5. Seed inicial com os 13 status oficiais pré-configurados com cores temáticas
INSERT INTO public.status_solicitacao (codigo, nome, origem, cor, descricao, active, bloqueado_edicao_codigo, ordem)
VALUES
    ('NA_FILA', 'Na Fila', 'SISREG', 'slate', 'Paciente aguardando chamado na regulação oficial.', true, true, 10),
    ('EM_CONVOCACAO', 'Em Convocação', 'SisFilaSus', 'blue', 'Operador iniciou tentativas de contato ou agendamento.', true, true, 20),
    ('CONVOCADO_CONFIRMADO', 'Confirmado', 'SisFilaSus', 'emerald', 'Paciente contactado e confirmou presença no procedimento.', true, true, 30),
    ('CONVOCADO_RECUSOU', 'Recusou', 'SisFilaSus', 'rose', 'Paciente contactado e recusou a convocação para o procedimento.', true, true, 40),
    ('SEM_CONTATO', 'Sem Contato', 'SisFilaSus', 'amber', 'Tentativa de contato realizada sem sucesso/resposta.', true, true, 50),
    ('ABSENTEISMO', 'Absenteísmo', 'SisFilaSus', 'orange', 'Paciente confirmou porém faltou à consulta/procedimento.', true, true, 60),
    ('ENCAMINHADO', 'Encaminhado Hospital/Clínica', 'SisFilaSus', 'sky', 'Encaminhado formalmente a prestador hospitalar ou clínica.', true, true, 70),
    ('INTERNADO', 'Internado', 'SisFilaSus', 'indigo', 'Paciente com internação hospitalar registrada para cirurgia.', true, true, 80),
    ('PROCEDIMENTO_REALIZADO', 'Procedimento Realizado', 'SisFilaSus', 'teal', 'Cirurgia ou exame executado com sucesso.', true, true, 90),
    ('ALTA', 'Alta', 'SisFilaSus', 'green', 'Paciente recebeu alta pós-procedimento.', true, true, 100),
    ('DESISTENCIA', 'Desistência', 'SisFilaSus', 'purple', 'Paciente formalizou desistência do procedimento.', true, true, 110),
    ('OBITO', 'Óbito', 'SisFilaSus', 'neutral', 'Registro de óbito do paciente na regulação.', true, true, 120),
    ('NAO_ENCONTRADO_SISREG', 'Fora do SISREG', 'SISREG', 'amber', 'Registro não constou no arquivo mais recente do SISREG.', true, true, 130)
ON CONFLICT (codigo) DO UPDATE SET
    nome = EXCLUDED.nome,
    origem = EXCLUDED.origem,
    cor = EXCLUDED.cor,
    descricao = EXCLUDED.descricao,
    bloqueado_edicao_codigo = EXCLUDED.bloqueado_edicao_codigo,
    ordem = EXCLUDED.ordem;
