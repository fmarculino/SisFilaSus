-- Dropar a view antiga para permitir a recriação com novo limite
DROP VIEW IF EXISTS public.vw_dashboard_top_procedimentos;

-- Recriar a view com o limite de 10 procedimentos
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

-- Garantir permissão de leitura para usuários autenticados
GRANT SELECT ON public.vw_dashboard_top_procedimentos TO authenticated;
