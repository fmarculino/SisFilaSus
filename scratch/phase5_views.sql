-- Views for Phase 5: Management Reports

-- 1. Espera por Procedimento
DROP VIEW IF EXISTS public.vw_relatorio_espera_procedimento;

CREATE OR REPLACE VIEW public.vw_relatorio_espera_procedimento 
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

-- 2. Espera por Risco
DROP VIEW IF EXISTS public.vw_relatorio_espera_risco;

CREATE OR REPLACE VIEW public.vw_relatorio_espera_risco 
WITH (security_invoker = true)
AS
SELECT 
  classificacao_risco,
  COUNT(*) as total_pacientes,
  COALESCE(AVG(EXTRACT(epoch FROM (now() - data_solicitacao))) / (365.25 * 86400), 0) as media_espera_anos
FROM public.fila_solicitacoes
WHERE active = true
GROUP BY classificacao_risco;

-- 3. Produtividade do Operador
DROP VIEW IF EXISTS public.vw_relatorio_produtividade_operador;

CREATE OR REPLACE VIEW public.vw_relatorio_produtividade_operador 
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

-- 4. Distribuição por Status
DROP VIEW IF EXISTS public.vw_relatorio_status_distribuicao;

CREATE OR REPLACE VIEW public.vw_relatorio_status_distribuicao 
WITH (security_invoker = true)
AS
SELECT 
  status_interno,
  COUNT(*) as total
FROM public.fila_solicitacoes
WHERE active = true
GROUP BY status_interno;

-- Grant permissions
GRANT SELECT ON public.vw_relatorio_espera_procedimento TO authenticated;
GRANT SELECT ON public.vw_relatorio_espera_risco TO authenticated;
GRANT SELECT ON public.vw_relatorio_produtividade_operador TO authenticated;
GRANT SELECT ON public.vw_relatorio_status_distribuicao TO authenticated;
