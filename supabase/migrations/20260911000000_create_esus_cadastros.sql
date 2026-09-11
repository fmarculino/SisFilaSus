-- =========================================================
-- MIGRAÇÃO: Base Cadastral e-SUS & Enriquecimento Territorial
-- SisFilaSUS - Marabá
-- =========================================================

-- 1. Novos campos estratégicos na tabela de pacientes do SisFilaSUS
ALTER TABLE public.pacientes 
  ADD COLUMN IF NOT EXISTS data_atualizacao_esus DATE,
  ADD COLUMN IF NOT EXISTS equipe_saude_nome VARCHAR(100),
  ADD COLUMN IF NOT EXISTS equipe_saude_ine VARCHAR(20),
  ADD COLUMN IF NOT EXISTS microarea VARCHAR(20);

-- Índices de performance para localização territorial em pacientes
CREATE INDEX IF NOT EXISTS idx_pacientes_cpf_btree ON public.pacientes (cpf_usuario);
CREATE INDEX IF NOT EXISTS idx_pacientes_unidade_ref ON public.pacientes (unidade_referencia_cnes);
CREATE INDEX IF NOT EXISTS idx_pacientes_equipe_ine ON public.pacientes (equipe_saude_ine);
CREATE INDEX IF NOT EXISTS idx_pacientes_microarea ON public.pacientes (microarea);

-- 2. Tabela de Cadastros Territoriais do e-SUS (Atenção Primária)
CREATE TABLE IF NOT EXISTS public.esus_cadastros (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cpf VARCHAR(11),                     -- 11 dígitos numéricos limpos
    cns VARCHAR(15),                     -- 15 dígitos numéricos limpos
    nome VARCHAR(255) NOT NULL,
    data_nascimento DATE,
    sexo VARCHAR(20),
    endereco TEXT,
    unidade_cnes VARCHAR(10) REFERENCES public.unidades_solicitantes(cnes) ON DELETE SET NULL,
    equipe_nome VARCHAR(100),
    equipe_ine VARCHAR(20),
    microarea VARCHAR(20),
    telefones JSONB DEFAULT '[]'::jsonb NOT NULL,
    data_atualizacao_esus DATE,
    total_atualizacoes INT DEFAULT 1 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Índices ultra-rápidos para o e-SUS
CREATE UNIQUE INDEX IF NOT EXISTS idx_esus_cpf ON public.esus_cadastros(cpf) WHERE cpf IS NOT NULL AND cpf != '';
CREATE UNIQUE INDEX IF NOT EXISTS idx_esus_cns ON public.esus_cadastros(cns) WHERE cns IS NOT NULL AND cns != '';
CREATE INDEX IF NOT EXISTS idx_esus_unidade ON public.esus_cadastros(unidade_cnes);
CREATE INDEX IF NOT EXISTS idx_esus_equipe ON public.esus_cadastros(equipe_ine);

-- Trigger de updated_at automático
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_esus_cadastros_updated_at'
  ) THEN
    CREATE TRIGGER update_esus_cadastros_updated_at
      BEFORE UPDATE ON public.esus_cadastros
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- 3. Habilitar RLS
ALTER TABLE public.esus_cadastros ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Autenticados leem cadastros esus" ON public.esus_cadastros;
CREATE POLICY "Autenticados leem cadastros esus"
  ON public.esus_cadastros FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Admins e coordenadores gerenciam cadastros esus" ON public.esus_cadastros;
CREATE POLICY "Admins e coordenadores gerenciam cadastros esus"
  ON public.esus_cadastros FOR ALL
  USING (public.get_user_role() IN ('SMS_ADMIN', 'COORDENADOR', 'OPERADOR_REGULACAO'));
