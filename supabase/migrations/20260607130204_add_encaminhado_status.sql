-- =========================================================================
-- SCRIPT DE MIGRAÇÃO: ADICIONAR STATUS 'ENCAMINHADO' NA FILA DE SOLICITAÇÕES
-- SISFILASUS — MARABÁ
-- =========================================================================
--
-- INSTRUÇÕES DE EXECUÇÃO:
-- 1. Abra o painel do Supabase da sua aplicação (Supabase Studio).
-- 2. Vá em "SQL Editor" no menu lateral esquerdo.
-- 3. Clique em "New Query".
-- 4. Cole todo o conteúdo deste arquivo e clique em "Run".
--
-- =========================================================================

-- 1. Remover a restrição antiga
ALTER TABLE public.fila_solicitacoes DROP CONSTRAINT IF EXISTS fila_solicitacoes_status_interno_check;

-- 2. Recriar a restrição com o novo status 'ENCAMINHADO'
ALTER TABLE public.fila_solicitacoes ADD CONSTRAINT fila_solicitacoes_status_interno_check CHECK (
    status_interno IN (
        'NA_FILA',
        'EM_CONVOCACAO',
        'CONVOCADO_CONFIRMADO',
        'CONVOCADO_RECUSOU',
        'SEM_CONTATO',
        'ABSENTEISMO',
        'ENCAMINHADO', -- Adicionado
        'INTERNADO',
        'PROCEDIMENTO_REALIZADO',
        'ALTA',
        'DESISTENCIA',
        'OBITO',
        'NAO_ENCONTRADO_SISREG'
    )
);
