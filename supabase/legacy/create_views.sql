-- Views para o Dashboard do SisFilaSus

-- 1. View para KPIs principais
DROP VIEW IF EXISTS public.vw_dashboard_kpis;

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

-- 2. View para os top procedimentos na fila
DROP VIEW IF EXISTS public.vw_dashboard_top_procedimentos;

CREATE OR REPLACE VIEW public.vw_dashboard_top_procedimentos 
WITH (security_invoker = true)
AS
SELECT 
  p.cod_sigtap,
  p.desc_sigtap,
  COUNT(*) as total
FROM public.fila_solicitacoes f
JOIN public.procedimentos p ON f.cod_sigtap = p.cod_sigtap
WHERE f.active = true
GROUP BY p.cod_sigtap, p.desc_sigtap
ORDER BY total DESC
LIMIT 10;

-- 3. View para distribuição por risco
DROP VIEW IF EXISTS public.vw_dashboard_risco;

CREATE OR REPLACE VIEW public.vw_dashboard_risco 
WITH (security_invoker = true)
AS
SELECT 
  classificacao_risco,
  COUNT(*) as total
FROM public.fila_solicitacoes
WHERE active = true
GROUP BY classificacao_risco;

-- 4. View para histórico de evolução por importação
DROP VIEW IF EXISTS public.vw_dashboard_evolucao;

CREATE OR REPLACE VIEW public.vw_dashboard_evolucao 
WITH (security_invoker = true)
AS
SELECT
  id as importacao_id,
  nome_arquivo,
  COALESCE(data_exportacao_sisreg, created_at) as data_importacao,
  total_registros
FROM public.importacoes
ORDER BY COALESCE(data_exportacao_sisreg, created_at) DESC
LIMIT 10;

-- Permitir acesso para usuários autenticados
GRANT SELECT ON public.vw_dashboard_kpis TO authenticated;
GRANT SELECT ON public.vw_dashboard_top_procedimentos TO authenticated;
GRANT SELECT ON public.vw_dashboard_risco TO authenticated;
GRANT SELECT ON public.vw_dashboard_evolucao TO authenticated;
