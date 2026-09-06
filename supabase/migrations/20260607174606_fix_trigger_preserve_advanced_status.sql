-- =========================================================================
-- SCRIPT DE CORREÇÃO: PRESERVAÇÃO DE STATUS AVANÇADOS NA IMPORTAÇÃO DO SISREG
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

CREATE OR REPLACE FUNCTION public.preserve_status_interno()
RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        -- Apenas preserva o status se a atualização NÃO for feita por um usuário autenticado
        -- (ou seja, se for uma importação em background via service_role/admin client, onde auth.uid() é NULL)
        IF auth.uid() IS NULL THEN
            -- Se a importação tenta atualizar para status padrão, mas o status local já avançou, mantém o local
            IF (NEW.status_interno IN ('NA_FILA', 'CONVOCADO_CONFIRMADO'))
               AND (OLD.status_interno NOT IN ('NA_FILA', 'CONVOCADO_CONFIRMADO')) THEN
                NEW.status_interno := OLD.status_interno;
            
            -- Se a importação tenta marcar como ausente (NAO_ENCONTRADO_SISREG), mas o status local é avançado (não é de fila/contato), mantém o local
            ELSIF (NEW.status_interno = 'NAO_ENCONTRADO_SISREG')
               AND (OLD.status_interno NOT IN ('NA_FILA', 'EM_CONVOCACAO', 'SEM_CONTATO', 'NAO_ENCONTRADO_SISREG')) THEN
                NEW.status_interno := OLD.status_interno;
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recria o trigger para garantir a aplicação da nova função
DROP TRIGGER IF EXISTS trigger_preserve_status_interno ON public.fila_solicitacoes;

CREATE TRIGGER trigger_preserve_status_interno
BEFORE UPDATE ON public.fila_solicitacoes
FOR EACH ROW EXECUTE FUNCTION public.preserve_status_interno();
