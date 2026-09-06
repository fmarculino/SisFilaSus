-- =========================================================================
-- SCRIPT DE CORREÇÃO: SECURITY FUNCTION SEARCH PATH MUTABLE
-- 
-- Executar este script no editor SQL do Supabase para corrigir os alertas
-- de "Function Search Path Mutable" (vulnerabilidade linter).
-- 
-- Define explicitamente o search_path para evitar sequestro de escopo
-- de busca de esquemas em funções que rodam com privilégios.
-- =========================================================================

ALTER FUNCTION public.apply_fila_movement() SET search_path = public, pg_temp;
ALTER FUNCTION public.get_user_role() SET search_path = public, pg_temp;
ALTER FUNCTION public.get_user_cnes_vinculo() SET search_path = public, pg_temp;
ALTER FUNCTION public.preserve_status_interno() SET search_path = public, pg_temp;
ALTER FUNCTION public.handle_new_user() SET search_path = public, pg_temp;
ALTER FUNCTION public.update_updated_at_column() SET search_path = public, pg_temp;
ALTER FUNCTION public.process_audit_log() SET search_path = public, pg_temp;
