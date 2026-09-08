-- ==============================================================================
-- Adicionar Unidade de Referência Territorial (APS) no Cadastro de Pacientes
-- ==============================================================================

-- 1. Adicionar a coluna unidade_referencia_cnes na tabela pacientes
ALTER TABLE public.pacientes 
ADD COLUMN IF NOT EXISTS unidade_referencia_cnes VARCHAR(10) 
REFERENCES public.unidades_solicitantes(cnes) ON DELETE SET NULL;

-- 2. Comentário explicativo na coluna
COMMENT ON COLUMN public.pacientes.unidade_referencia_cnes IS 
'CNES da UBS/USF de cobertura do domicílio do paciente na Atenção Primária à Saúde (APS). Diferente do cnes_solicitante da guia, esta unidade acompanha o endereço atual do cidadão.';

-- 3. Criar índice para buscas e filtros rápidos na Fila e na listagem de Pacientes
CREATE INDEX IF NOT EXISTS idx_pacientes_unidade_referencia 
ON public.pacientes(unidade_referencia_cnes);
