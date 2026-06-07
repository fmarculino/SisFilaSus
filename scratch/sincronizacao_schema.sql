-- =========================================================================
-- SCRIPT DE CRIAÇÃO: MOTOR DE SINCRONIZAÇÃO E GESTÃO DE DIVERGÊNCIAS
-- SISFILASUS — MARABÁ
-- =========================================================================
--
-- INSTRUÇÕES DE EXECUÇÃO:
-- 1. Abra o painel do Supabase da sua aplicação.
-- 2. Vá em "SQL Editor" no menu lateral esquerdo.
-- 3. Clique em "New Query".
-- 4. Cole todo o conteúdo deste arquivo e clique em "Run".
--
-- =========================================================================

-- 1. Criar a Tabela de Divergências
CREATE TABLE IF NOT EXISTS public.divergencias_sisreg (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cod_solicitacao BIGINT NOT NULL REFERENCES public.fila_solicitacoes(cod_solicitacao) ON DELETE CASCADE,
    importacao_id UUID NOT NULL REFERENCES public.importacoes(id) ON DELETE CASCADE,
    tipo_divergencia VARCHAR(50) NOT NULL CHECK (tipo_divergencia IN (
        'OBITO_ATIVO',           -- Óbito confirmado localmente, mas ativo no SISREG
        'DESISTENCIA_ATIVA',     -- Desistência confirmada localmente, mas ativa no SISREG
        'RECUSA_ATIVA',          -- Recusa/já operou particular, mas ativa no SISREG
        'INTERNADO_ATIVO'        -- Internado localmente, mas sem agendamento no SISREG
    )),
    status_sisreg_importado VARCHAR(50),
    status_interno_local VARCHAR(50) NOT NULL,
    resolvido BOOLEAN DEFAULT false NOT NULL,
    resolvido_por UUID REFERENCES public.users(id) ON DELETE SET NULL,
    resolvido_em TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_solicitacao_divergencia UNIQUE (cod_solicitacao)
);

-- 2. Habilitar RLS (Row Level Security)
ALTER TABLE public.divergencias_sisreg ENABLE ROW LEVEL SECURITY;

-- 3. Criar políticas de acesso baseadas em perfis autorizados
DROP POLICY IF EXISTS "Equipe de regulação lê divergências" ON public.divergencias_sisreg;
CREATE POLICY "Equipe de regulação lê divergências" 
ON public.divergencias_sisreg FOR SELECT 
USING (public.get_user_role() IN ('SMS_ADMIN', 'COORDENADOR', 'OPERADOR_REGULACAO'));

DROP POLICY IF EXISTS "Equipe de regulação atualiza divergências" ON public.divergencias_sisreg;
CREATE POLICY "Equipe de regulação atualiza divergências" 
ON public.divergencias_sisreg FOR UPDATE 
USING (public.get_user_role() IN ('SMS_ADMIN', 'COORDENADOR', 'OPERADOR_REGULACAO'));

-- 4. Gatilho SQL para impedir a sobrescrita do status operacional nas importações
CREATE OR REPLACE FUNCTION public.preserve_status_interno()
RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        -- Se a importação tenta atualizar para status padrão, mas o status local já avançou, mantém o local
        IF (NEW.status_interno IN ('NA_FILA', 'CONVOCADO_CONFIRMADO'))
           AND (OLD.status_interno NOT IN ('NA_FILA', 'CONVOCADO_CONFIRMADO')) THEN
            NEW.status_interno := OLD.status_interno;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Dropar se já existir para evitar conflito
DROP TRIGGER IF EXISTS trigger_preserve_status_interno ON public.fila_solicitacoes;

CREATE TRIGGER trigger_preserve_status_interno
BEFORE UPDATE ON public.fila_solicitacoes
FOR EACH ROW EXECUTE FUNCTION public.preserve_status_interno();

-- 5. Índices de Performance
CREATE INDEX IF NOT EXISTS idx_divergencias_resolvido ON public.divergencias_sisreg(resolvido);
CREATE INDEX IF NOT EXISTS idx_divergencias_solicitacao ON public.divergencias_sisreg(cod_solicitacao);
