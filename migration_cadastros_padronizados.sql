-- =========================================================
-- MIGRAÇÃO: CADASTROS PADRONIZADOS (SISFILASUS)
-- Especialidades, Médicos, Unidades Solicitantes, Municípios e Procedimentos
-- =========================================================

-- 1. Tabela de Especialidades Médicas
CREATE TABLE IF NOT EXISTS public.especialidades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome VARCHAR(255) NOT NULL UNIQUE,
    descricao TEXT,
    active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Trigger para updated_at em especialidades
CREATE OR REPLACE TRIGGER update_especialidades_updated_at 
BEFORE UPDATE ON public.especialidades 
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Habilitar RLS em especialidades
ALTER TABLE public.especialidades ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'especialidades' AND policyname = 'Leitura de especialidades para autenticados') THEN
        CREATE POLICY "Leitura de especialidades para autenticados" ON public.especialidades FOR SELECT USING (auth.role() = 'authenticated');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'especialidades' AND policyname = 'Gestores gerenciam especialidades') THEN
        CREATE POLICY "Gestores gerenciam especialidades" ON public.especialidades FOR ALL USING (public.get_user_role() IN ('SMS_ADMIN', 'COORDENADOR'));
    END IF;
END $$;

-- Inserção inicial de especialidades mais comuns
INSERT INTO public.especialidades (nome, descricao) VALUES
('CIRURGIA GERAL', 'Procedimentos e consultas cirúrgicas gerais'),
('GINECOLOGIA E OBSTETRICIA', 'Saúde da mulher, pré-natal de alto risco e cirurgias ginecológicas'),
('ORTOPEDIA E TRAUMATOLOGIA', 'Aparelho locomotor, fraturas e cirurgias ortopédicas'),
('OFTALMOLOGIA', 'Consultas, exames oftalmológicos e cirurgias de catarata/pterígio'),
('UROLOGIA', 'Sistema urinário e reprodutor masculino'),
('CARDIOLOGIA', 'Doenças cardiovasculares, consultas e exames'),
('PEDIATRIA', 'Atendimento especializado infantil'),
('OTORRINOLARINGOLOGIA', 'Ouvido, nariz e garganta'),
('CIRURGIA PLASTICA', 'Cirurgias reparadoras'),
('NEUROCIRURGIA', 'Doenças e cirurgias do sistema nervoso'),
('CIRURGIA VASCULAR', 'Tratamento de varizes e patologias vasculares'),
('DERMATOLOGIA', 'Doenças de pele e pequenas cirurgias'),
('ENDOCRINOLOGIA', 'Distúrbios hormonais e metabólicos'),
('GASTROENTEROLOGIA', 'Aparelho digestivo e endoscopias'),
('NEFROLOGIA', 'Doenças renais e acompanhamento')
ON CONFLICT (nome) DO NOTHING;

-- 2. Tabela de Médicos
CREATE TABLE IF NOT EXISTS public.medicos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome VARCHAR(255) NOT NULL,
    crm VARCHAR(50) NOT NULL,
    uf_crm VARCHAR(2) DEFAULT 'PA' NOT NULL,
    especialidade_id UUID REFERENCES public.especialidades(id) ON DELETE SET NULL,
    especialidade_nome VARCHAR(255),
    hospital_id UUID REFERENCES public.hospitais_prestadores(id) ON DELETE SET NULL,
    telefone VARCHAR(50),
    email VARCHAR(255),
    active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT uk_crm_uf UNIQUE (crm, uf_crm)
);

-- Trigger para updated_at em médicos
CREATE OR REPLACE TRIGGER update_medicos_updated_at 
BEFORE UPDATE ON public.medicos 
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Habilitar RLS em médicos
ALTER TABLE public.medicos ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'medicos' AND policyname = 'Leitura de médicos para autenticados') THEN
        CREATE POLICY "Leitura de médicos para autenticados" ON public.medicos FOR SELECT USING (auth.role() = 'authenticated');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'medicos' AND policyname = 'Gestores e operadores gerenciam médicos') THEN
        CREATE POLICY "Gestores e operadores gerenciam médicos" ON public.medicos FOR ALL USING (public.get_user_role() IN ('SMS_ADMIN', 'COORDENADOR', 'OPERADOR_REGULACAO'));
    END IF;
END $$;

-- 3. Índices de apoio para Médicos e Especialidades
CREATE INDEX IF NOT EXISTS idx_medicos_nome ON public.medicos (nome);
CREATE INDEX IF NOT EXISTS idx_medicos_crm ON public.medicos (crm);
CREATE INDEX IF NOT EXISTS idx_medicos_especialidade ON public.medicos (especialidade_id);
CREATE INDEX IF NOT EXISTS idx_medicos_hospital ON public.medicos (hospital_id);
CREATE INDEX IF NOT EXISTS idx_especialidades_nome ON public.especialidades (nome);

-- 4. Garantir que tabelas de apoio permitam escrita por Gestores (SMS_ADMIN e COORDENADOR)
DO $$ 
BEGIN
    -- Municípios
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'municipios' AND policyname = 'Gestores gerenciam municipios') THEN
        CREATE POLICY "Gestores gerenciam municipios" ON public.municipios FOR ALL USING (public.get_user_role() IN ('SMS_ADMIN', 'COORDENADOR'));
    END IF;
    -- Unidades Solicitantes
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'unidades_solicitantes' AND policyname = 'Gestores gerenciam unidades') THEN
        CREATE POLICY "Gestores gerenciam unidades" ON public.unidades_solicitantes FOR ALL USING (public.get_user_role() IN ('SMS_ADMIN', 'COORDENADOR'));
    END IF;
    -- Procedimentos
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'procedimentos' AND policyname = 'Gestores gerenciam procedimentos') THEN
        CREATE POLICY "Gestores gerenciam procedimentos" ON public.procedimentos FOR ALL USING (public.get_user_role() IN ('SMS_ADMIN', 'COORDENADOR'));
    END IF;
END $$;
