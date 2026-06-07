-- Dropar a view antiga para permitir alteração dos nomes e ordens das colunas
DROP VIEW IF EXISTS public.vw_dashboard_kpis;

-- Atualizar a view do dashboard para incluir contadores detalhados de modalidade de fila
CREATE OR REPLACE VIEW public.vw_dashboard_kpis 
WITH (security_invoker = true)
AS
SELECT
  (SELECT COUNT(*) FROM public.fila_solicitacoes WHERE active = true) AS fila_total_ativa,
  (SELECT COUNT(*) FROM public.fila_solicitacoes WHERE active = true AND modalidade_fila = 0) AS aguardando_consultas,
  (SELECT COUNT(*) FROM public.fila_solicitacoes WHERE active = true AND modalidade_fila = 1) AS aguardando_exames,
  (SELECT COUNT(*) FROM public.fila_solicitacoes WHERE active = true AND modalidade_fila = 2) AS aguardando_cirurgias,
  (SELECT COUNT(*) FROM public.fila_solicitacoes WHERE active = true AND (modalidade_fila = 3 OR modalidade_fila IS NULL)) AS demais_procedimentos,
  COALESCE((SELECT AVG(EXTRACT(epoch FROM (now() - data_solicitacao))) / (365.25 * 86400) FROM public.fila_solicitacoes WHERE active = true), 0) AS media_espera_anos,
  (SELECT COUNT(*) FROM public.contatos WHERE created_at >= timezone('utc'::text, CURRENT_DATE)) AS contatos_hoje;

-- Re-garantir permissão de leitura para usuários autenticados
GRANT SELECT ON public.vw_dashboard_kpis TO authenticated;
