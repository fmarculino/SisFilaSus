-- =========================================================================
-- MIGRAÇÃO: BLINDAGEM DE STATUS INTERNO E CLASSIFICAÇÃO DE RISCO NA IMPORTAÇÃO
-- SISFILASUS — MARABÁ
-- =========================================================================
-- Objetivo:
-- 1. Proteger o status 'CONVOCADO_CONFIRMADO' e demais status avançados contra
--    o rebaixamento para 'NA_FILA' durante novas importações do SISREG.
-- 2. Proteger a classificação de risco reclassificada pela equipe local de ser
--    sobrescrita pelos dados brutos do SISREG federal.
-- =========================================================================

-- 1. Adicionar coluna para rastrear reclassificação de risco local
ALTER TABLE public.fila_solicitacoes 
ADD COLUMN IF NOT EXISTS risco_reclassificado_localmente BOOLEAN DEFAULT false NOT NULL;

-- 2. Criar índice para performance em consultas filtradas
CREATE INDEX IF NOT EXISTS idx_fila_risco_reclassificado 
ON public.fila_solicitacoes (risco_reclassificado_localmente) 
WHERE risco_reclassificado_localmente = true;

-- 3. Backfill retroativo: Marcar como reclassificados registros que já tiveram movimentação de risco aprovada
UPDATE public.fila_solicitacoes f
SET risco_reclassificado_localmente = true
WHERE EXISTS (
  SELECT 1 FROM public.movimentacoes_fila m
  WHERE m.cod_solicitacao = f.cod_solicitacao
    AND m.status = 'APROVADO'
    AND m.valor_novo ? 'classificacao_risco'
);

-- 4. Atualizar a função que aplica movimentações de fila quando aprovadas
CREATE OR REPLACE FUNCTION public.apply_fila_movement()
RETURNS trigger AS $$
BEGIN
  IF (new.status = 'APROVADO' AND old.status = 'PENDENTE') THEN
    UPDATE public.fila_solicitacoes
    SET 
      classificacao_risco = COALESCE((new.valor_novo->>'classificacao_risco')::int, classificacao_risco),
      posicao_fila = CASE 
        WHEN (new.valor_novo ? 'posicao_fila') THEN (new.valor_novo->>'posicao_fila')::int 
        ELSE posicao_fila 
      END,
      risco_reclassificado_localmente = CASE
        WHEN (new.valor_novo ? 'classificacao_risco') THEN true
        ELSE risco_reclassificado_localmente
      END,
      updated_at = timezone('utc'::text, now())
    WHERE cod_solicitacao = new.cod_solicitacao;
  END IF;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Garantir trigger ativa para movimentações
DROP TRIGGER IF EXISTS trigger_apply_fila_movement ON public.movimentacoes_fila;
CREATE TRIGGER trigger_apply_fila_movement
  AFTER UPDATE ON public.movimentacoes_fila
  FOR EACH ROW EXECUTE FUNCTION public.apply_fila_movement();

-- 5. Atualizar função trigger para preservar status e classificação na importação
CREATE OR REPLACE FUNCTION public.preserve_status_interno()
RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        -- Apenas intercepta se a atualização for feita pela importação em background
        -- (service_role / admin client onde auth.uid() é NULL)
        IF auth.uid() IS NULL THEN

            -- A) PRESERVAÇÃO DA CLASSIFICAÇÃO DE RISCO:
            -- Se a equipe clínica reclassificou localmente, não aceita sobreposição do SISREG federal
            IF OLD.risco_reclassificado_localmente = true THEN
                NEW.classificacao_risco := OLD.classificacao_risco;
            END IF;

            -- B) PRESERVAÇÃO DO STATUS INTERNO:
            -- Caso 1: Importação de Fila Eletiva (traz 'NA_FILA')
            -- Se o status local já avançou (CONVOCADO_CONFIRMADO, EM_CONVOCACAO, SEM_CONTATO, etc.), não volta para NA_FILA!
            IF NEW.status_interno = 'NA_FILA' AND OLD.status_interno <> 'NA_FILA' THEN
                NEW.status_interno := OLD.status_interno;

            -- Caso 2: Importação Ambulatorial (traz 'CONVOCADO_CONFIRMADO')
            -- Se o status local já for avançado/terminal (ENCAMINHADO, INTERNADO, OBITO, etc.), preserva o status local
            ELSIF NEW.status_interno = 'CONVOCADO_CONFIRMADO' 
                  AND OLD.status_interno IN ('ENCAMINHADO', 'INTERNADO', 'PROCEDIMENTO_REALIZADO', 'ALTA', 'DESISTENCIA', 'OBITO', 'CONVOCADO_RECUSOU') THEN
                NEW.status_interno := OLD.status_interno;

            -- Caso 3: Importação tenta marcar como ausente ('NAO_ENCONTRADO_SISREG')
            -- Preserva se o status local não for meramente de fila/contato inicial
            ELSIF NEW.status_interno = 'NAO_ENCONTRADO_SISREG'
                  AND OLD.status_interno NOT IN ('NA_FILA', 'EM_CONVOCACAO', 'SEM_CONTATO', 'NAO_ENCONTRADO_SISREG') THEN
                NEW.status_interno := OLD.status_interno;
            END IF;

        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Recriar trigger em fila_solicitacoes
DROP TRIGGER IF EXISTS trigger_preserve_status_interno ON public.fila_solicitacoes;
CREATE TRIGGER trigger_preserve_status_interno
BEFORE UPDATE ON public.fila_solicitacoes
FOR EACH ROW EXECUTE FUNCTION public.preserve_status_interno();
