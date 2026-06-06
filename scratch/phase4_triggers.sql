-- Trigger and functions for Phase 4: Auditing & Movements

-- 1. Function for audit logs
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
  -- Obtain authenticated user ID from Supabase context
  v_usuario_id := auth.uid();

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

-- Create triggers for auditing
DROP TRIGGER IF EXISTS audit_fila_solicitacoes ON public.fila_solicitacoes;
CREATE TRIGGER audit_fila_solicitacoes 
  AFTER INSERT OR UPDATE OR DELETE ON public.fila_solicitacoes 
  FOR EACH ROW EXECUTE FUNCTION public.process_audit_log();

DROP TRIGGER IF EXISTS audit_pacientes ON public.pacientes;
CREATE TRIGGER audit_pacientes 
  AFTER INSERT OR UPDATE OR DELETE ON public.pacientes 
  FOR EACH ROW EXECUTE FUNCTION public.process_audit_log();

DROP TRIGGER IF EXISTS audit_contatos ON public.contatos;
CREATE TRIGGER audit_contatos 
  AFTER INSERT ON public.contatos 
  FOR EACH ROW EXECUTE FUNCTION public.process_audit_log();

DROP TRIGGER IF EXISTS audit_movimentacoes_fila ON public.movimentacoes_fila;
CREATE TRIGGER audit_movimentacoes_fila 
  AFTER INSERT OR UPDATE OR DELETE ON public.movimentacoes_fila 
  FOR EACH ROW EXECUTE FUNCTION public.process_audit_log();


-- 2. Function for applying waitlist movements on approval
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
      updated_at = timezone('utc'::text, now())
    WHERE cod_solicitacao = new.cod_solicitacao;
  END IF;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for applying movements
DROP TRIGGER IF EXISTS trigger_apply_fila_movement ON public.movimentacoes_fila;
CREATE TRIGGER trigger_apply_fila_movement
  AFTER UPDATE ON public.movimentacoes_fila
  FOR EACH ROW EXECUTE FUNCTION public.apply_fila_movement();
