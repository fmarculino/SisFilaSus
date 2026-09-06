-- =========================================================================
-- SCRIPT DE CORREÇÃO: VIEWS DE DASHBOARD & RELATÓRIOS (SECURITY INVOKER)
-- 
-- Executar este script no editor SQL do Supabase para corrigir os alertas
-- de "Security Definer View" (vulnerabilidade linter).
-- =========================================================================

-- 1. View para KPIs principais do Dashboard
DROP VIEW IF EXISTS public.vw_dashboard_kpis;
CREATE VIEW public.vw_dashboard_kpis 
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

GRANT SELECT ON public.vw_dashboard_kpis TO authenticated;


-- 2. View para os top procedimentos na fila
DROP VIEW IF EXISTS public.vw_dashboard_top_procedimentos;
CREATE VIEW public.vw_dashboard_top_procedimentos 
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

GRANT SELECT ON public.vw_dashboard_top_procedimentos TO authenticated;


-- 3. View para distribuição por risco no Dashboard
DROP VIEW IF EXISTS public.vw_dashboard_risco;
CREATE VIEW public.vw_dashboard_risco 
WITH (security_invoker = true)
AS
SELECT 
  classificacao_risco,
  COUNT(*) as total
FROM public.fila_solicitacoes
WHERE active = true
GROUP BY classificacao_risco;

GRANT SELECT ON public.vw_dashboard_risco TO authenticated;


-- 4. View para histórico de evolução por importação
DROP VIEW IF EXISTS public.vw_dashboard_evolucao;
CREATE VIEW public.vw_dashboard_evolucao 
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

GRANT SELECT ON public.vw_dashboard_evolucao TO authenticated;


-- 5. View de Relatório: Espera por Procedimento
DROP VIEW IF EXISTS public.vw_relatorio_espera_procedimento;
CREATE VIEW public.vw_relatorio_espera_procedimento 
WITH (security_invoker = true)
AS
SELECT 
  p.cod_sigtap,
  p.desc_sigtap,
  COUNT(*) as total_pacientes,
  COALESCE(AVG(EXTRACT(epoch FROM (now() - f.data_solicitacao))) / (365.25 * 86400), 0) as media_espera_anos
FROM public.fila_solicitacoes f
JOIN public.procedimentos p ON f.cod_sigtap = p.cod_sigtap
WHERE f.active = true
GROUP BY p.cod_sigtap, p.desc_sigtap
ORDER BY media_espera_anos DESC;

GRANT SELECT ON public.vw_relatorio_espera_procedimento TO authenticated;


-- 6. View de Relatório: Espera por Risco
DROP VIEW IF EXISTS public.vw_relatorio_espera_risco;
CREATE VIEW public.vw_relatorio_espera_risco 
WITH (security_invoker = true)
AS
SELECT 
  classificacao_risco,
  COUNT(*) as total_pacientes,
  COALESCE(AVG(EXTRACT(epoch FROM (now() - data_solicitacao))) / (365.25 * 86400), 0) as media_espera_anos
FROM public.fila_solicitacoes
WHERE active = true
GROUP BY classificacao_risco;

GRANT SELECT ON public.vw_relatorio_espera_risco TO authenticated;


-- 7. View de Relatório: Produtividade do Operador
DROP VIEW IF EXISTS public.vw_relatorio_produtividade_operador;
CREATE VIEW public.vw_relatorio_produtividade_operador 
WITH (security_invoker = true)
AS
SELECT 
  u.nome as operador_nome,
  u.email as operador_email,
  COUNT(c.id) as total_contatos,
  COUNT(CASE WHEN c.resultado = 'SUCESSO_CONFIRMOU' THEN 1 END) as contatos_sucesso,
  COUNT(CASE WHEN c.resultado = 'SUCESSO_RECUSOU' THEN 1 END) as contatos_recusa,
  COUNT(CASE WHEN c.resultado = 'SEM_RESPOSTA' THEN 1 END) as contatos_sem_resposta
FROM public.contatos c
JOIN public.users u ON c.operador_id = u.id
GROUP BY u.nome, u.email;

GRANT SELECT ON public.vw_relatorio_produtividade_operador TO authenticated;


-- 8. View de Relatório: Distribuição por Status
DROP VIEW IF EXISTS public.vw_relatorio_status_distribuicao;
CREATE VIEW public.vw_relatorio_status_distribuicao 
WITH (security_invoker = true)
AS
SELECT 
  status_interno,
  COUNT(*) as total
FROM public.fila_solicitacoes
WHERE active = true
GROUP BY status_interno;

GRANT SELECT ON public.vw_relatorio_status_distribuicao TO authenticated;
