-- =========================================================================
-- MIGRAÇÃO SQL: RESTRIÇÃO DE AUDITORIA A ATIVIDADES HUMANAS (LOGADOS)
-- SISFILASUS — MARABÁ
-- =========================================================================
--
-- INSTRUÇÕES DE EXECUÇÃO:
-- 1. Abra o painel do Supabase da sua aplicação.
-- 2. Vá em "SQL Editor" no menu lateral esquerdo.
-- 3. Clique em "New Query".
-- 4. Cole todo o conteúdo deste arquivo e clique em "Run".
--
-- =========================================================================

CREATE OR REPLACE FUNCTION public.process_audit_log()
RETURNS trigger AS $$
DECLARE
  v_usuario_id UUID;
  v_dados_anteriores JSONB := NULL;
  v_dados_novos JSONB := NULL;
  v_acao TEXT;
  v_tabela TEXT := TG_TABLE_NAME;
  v_registro_id TEXT;
BEGIN
  -- Obter o ID do usuário autenticado no contexto do Supabase
  v_usuario_id := auth.uid();

  -- IMPORTANTE: Se não houver usuário logado (ex: importação de planilha em background,
  -- migração ou scripts do sistema), ignora a auditoria para não inundar o banco de dados.
  IF v_usuario_id IS NULL THEN
    RETURN COALESCE(new, old);
  END IF;

  IF (TG_OP = 'INSERT') THEN
    v_acao := 'INSERT';
    v_dados_novos := to_jsonb(new);
    IF v_tabela = 'fila_solicitacoes' THEN 
      v_registro_id := new.cod_solicitacao::text;
    ELSE 
      v_registro_id := new.id::text;
    END IF;
  ELSIF (TG_OP = 'UPDATE') THEN
    v_acao := 'UPDATE';
    v_dados_anteriores := to_jsonb(old);
    v_dados_novos := to_jsonb(new);
    IF v_tabela = 'fila_solicitacoes' THEN 
      v_registro_id := new.cod_solicitacao::text;
    ELSE 
      v_registro_id := new.id::text;
    END IF;
  ELSIF (TG_OP = 'DELETE') THEN
    v_acao := 'DELETE';
    v_dados_anteriores := to_jsonb(old);
    IF v_tabela = 'fila_solicitacoes' THEN 
      v_registro_id := old.cod_solicitacao::text;
    ELSE 
      v_registro_id := old.id::text;
    END IF;
  END IF;

  INSERT INTO public.audit_log (tabela, registro_id, acao, usuario_id, dados_anteriores, dados_novos)
  VALUES (v_tabela, v_registro_id, v_acao, v_usuario_id, v_dados_anteriores, v_dados_novos);

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
