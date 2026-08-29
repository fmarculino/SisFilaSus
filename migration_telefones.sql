-- =========================================================
-- MIGRAÇÃO: Tabela de Telefones Múltiplos do Paciente
-- SisFilaSUS — Marabá
-- Executar manualmente no Supabase SQL Editor
-- =========================================================

-- 1. Criar tabela de telefones do paciente
CREATE TABLE IF NOT EXISTS public.pacientes_telefones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    paciente_id UUID NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
    numero VARCHAR(20) NOT NULL,
    tipo VARCHAR(30) NOT NULL CHECK (tipo IN (
        'CELULAR_WHATSAPP',   -- Celular com WhatsApp
        'CELULAR',            -- Celular sem WhatsApp
        'FIXO',               -- Telefone fixo
        'RECADO'              -- Número de terceiro (vizinho, familiar)
    )),
    status VARCHAR(30) DEFAULT 'ATIVO' NOT NULL CHECK (status IN (
        'ATIVO',              -- Número funcional e em uso
        'INATIVO',            -- Não está mais em uso (genérico)
        'TROCOU_DONO',        -- Número trocou de proprietário
        'PERDIDO',            -- Paciente perdeu o chip/aparelho
        'DESLIGADO',          -- Número desligado/fora de serviço
        'NAO_EXISTE',         -- Número inexistente na operadora
        'NAO_ATENDE'          -- Toca, mas nunca atende
    )),
    prioridade INT DEFAULT 0 NOT NULL,  -- 0 = principal, 1, 2... maior = menor prioridade
    nome_contato VARCHAR(255),          -- Nome de quem atende (para tipo RECADO)
    parentesco VARCHAR(100),            -- Parentesco (mãe, vizinho, esposa, etc.)
    observacoes TEXT,                   -- Notas livres sobre este telefone
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Índices de performance
CREATE INDEX IF NOT EXISTS idx_tel_paciente ON public.pacientes_telefones(paciente_id);
CREATE INDEX IF NOT EXISTS idx_tel_status ON public.pacientes_telefones(status);
CREATE INDEX IF NOT EXISTS idx_tel_prioridade ON public.pacientes_telefones(paciente_id, prioridade);

-- 3. Trigger de updated_at automático (reutiliza a função já existente)
CREATE TRIGGER update_pacientes_telefones_updated_at
  BEFORE UPDATE ON public.pacientes_telefones
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Habilitar RLS
ALTER TABLE public.pacientes_telefones ENABLE ROW LEVEL SECURITY;

-- 5. Políticas de segurança
CREATE POLICY "Autenticados leem telefones de pacientes"
  ON public.pacientes_telefones FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admins, coordenadores e operadores gerenciam telefones"
  ON public.pacientes_telefones FOR ALL
  USING (public.get_user_role() IN ('SMS_ADMIN', 'COORDENADOR', 'OPERADOR_REGULACAO'));

-- 6. Migração de dados legados (telefone_1 → CELULAR_WHATSAPP, prioridade 0)
INSERT INTO public.pacientes_telefones (paciente_id, numero, tipo, status, prioridade)
SELECT id, telefone_1, 'CELULAR_WHATSAPP', 'ATIVO', 0
FROM public.pacientes
WHERE telefone_1 IS NOT NULL AND telefone_1 != ''
ON CONFLICT DO NOTHING;

-- 7. Migração de dados legados (telefone_2 → RECADO, prioridade 1)
INSERT INTO public.pacientes_telefones (paciente_id, numero, tipo, status, prioridade, observacoes)
SELECT id, telefone_2, 'RECADO', 'ATIVO', 1, 'Migrado do campo telefone_2 (recado)'
FROM public.pacientes
WHERE telefone_2 IS NOT NULL AND telefone_2 != ''
ON CONFLICT DO NOTHING;

-- NOTA: Os campos telefone_1 e telefone_2 na tabela pacientes NÃO serão removidos
-- neste momento para manter retrocompatibilidade. A UI e as actions passarão a usar
-- exclusivamente a nova tabela pacientes_telefones.
