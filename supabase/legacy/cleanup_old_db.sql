-- =========================================================
-- SCRIPT DE LIMPEZA DO BANCO COMPARTILHADO (SisTEA)
-- =========================================================
-- Remove apenas estruturas e tabelas exclusivas do SisFilaSus,
-- mantendo o SisTEA intacto e preservando a tabela public.users.

-- 1. Remover Views do SisFilaSus
DROP VIEW IF EXISTS public.vw_relatorio_espera_procedimento;
DROP VIEW IF EXISTS public.vw_relatorio_espera_risco;
DROP VIEW IF EXISTS public.vw_relatorio_produtividade_operador;
DROP VIEW IF EXISTS public.vw_relatorio_status_distribuicao;
DROP VIEW IF EXISTS public.vw_dashboard_kpis;
DROP VIEW IF EXISTS public.vw_dashboard_top_procedimentos;
DROP VIEW IF EXISTS public.vw_dashboard_risco;
DROP VIEW IF EXISTS public.vw_dashboard_evolucao;

-- 2. Remover Triggers e Funções específicas do SisFilaSus
DROP TRIGGER IF EXISTS audit_fila_solicitacoes ON public.fila_solicitacoes;
DROP TRIGGER IF EXISTS audit_pacientes ON public.pacientes;
DROP TRIGGER IF EXISTS audit_contatos ON public.contatos;
DROP TRIGGER IF EXISTS audit_movimentacoes_fila ON public.movimentacoes_fila;
DROP TRIGGER IF EXISTS audit_hospitais_prestadores ON public.hospitais_prestadores;
DROP TRIGGER IF EXISTS trigger_apply_fila_movement ON public.movimentacoes_fila;

DROP FUNCTION IF EXISTS public.process_audit_log();
DROP FUNCTION IF EXISTS public.apply_fila_movement();

-- 3. Remover Tabelas do SisFilaSus (em ordem de chave estrangeira)
DROP TABLE IF EXISTS public.audit_log CASCADE;
DROP TABLE IF EXISTS public.movimentacoes_fila CASCADE;
DROP TABLE IF EXISTS public.contatos CASCADE;
DROP TABLE IF EXISTS public.fila_snapshots CASCADE;
DROP TABLE IF EXISTS public.fila_solicitacoes CASCADE;
DROP TABLE IF EXISTS public.importacoes CASCADE;
DROP TABLE IF EXISTS public.pacientes CASCADE;
DROP TABLE IF EXISTS public.hospitais_prestadores CASCADE;
DROP TABLE IF EXISTS public.unidades_solicitantes CASCADE;
DROP TABLE IF EXISTS public.procedimentos CASCADE;
DROP TABLE IF EXISTS public.cids CASCADE;
DROP TABLE IF EXISTS public.templates_mensagem CASCADE;
DROP TABLE IF EXISTS public.configuracoes CASCADE;

-- 4. Reverter restrições adicionadas na tabela compartilhada public.users
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS cnes_vinculo_required_for_unidade;
