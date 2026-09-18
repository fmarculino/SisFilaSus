-- =========================================================================
-- MIGRAÇÃO: FILA DE JOBS DE SINCRONIZAÇÃO e-SUS PEC (AGENTE LOCAL)
-- SISFILASUS — MARABÁ
-- =========================================================================
--
-- INSTRUÇÕES DE EXECUÇÃO:
-- 1. Abra o painel do Supabase da sua aplicação (Coolify).
-- 2. Vá em "SQL Editor" no menu lateral esquerdo.
-- 3. Clique em "New Query".
-- 4. Cole todo o conteúdo deste arquivo e clique em "Run".
--
-- =========================================================================

-- 1. Criar a Tabela de Jobs de Sincronização e-SUS
CREATE TABLE IF NOT EXISTS public.esus_sync_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status VARCHAR(30) DEFAULT 'PENDENTE' NOT NULL CHECK (status IN (
        'PENDENTE',        -- Solicitado pelo usuário na Web, aguardando agente local
        'PROCESSANDO',     -- Agente local conectou no e-SUS e está processando
        'CONCLUIDO',       -- Sincronização finalizada com sucesso
        'ERRO',            -- Falha na sincronização
        'CANCELADO'        -- Cancelado pelo operador
    )),
    solicitado_por VARCHAR(255),
    solicitado_por_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    parametros JSONB DEFAULT '{"dias": 30}'::jsonb NOT NULL,
    stats JSONB DEFAULT '{}'::jsonb NOT NULL,
    mensagem_status TEXT,
    mensagem_erro TEXT,
    agente_identificador VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Índices para busca rápida de jobs pendentes e histórico
CREATE INDEX IF NOT EXISTS idx_esus_sync_jobs_status ON public.esus_sync_jobs(status);
CREATE INDEX IF NOT EXISTS idx_esus_sync_jobs_created_at ON public.esus_sync_jobs(created_at DESC);

-- 3. Trigger para atualização automática de updated_at
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_esus_sync_jobs_updated_at'
  ) THEN
    CREATE TRIGGER update_esus_sync_jobs_updated_at
      BEFORE UPDATE ON public.esus_sync_jobs
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- 4. Habilitar RLS (Row Level Security)
ALTER TABLE public.esus_sync_jobs ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso
DROP POLICY IF EXISTS "Equipe de regulação lê jobs de sincronização" ON public.esus_sync_jobs;
CREATE POLICY "Equipe de regulação lê jobs de sincronização" 
ON public.esus_sync_jobs FOR SELECT 
USING (
    auth.uid() IS NOT NULL
);

DROP POLICY IF EXISTS "Equipe de regulação cria jobs de sincronização" ON public.esus_sync_jobs;
CREATE POLICY "Equipe de regulação cria jobs de sincronização" 
ON public.esus_sync_jobs FOR INSERT 
WITH CHECK (
    auth.uid() IS NOT NULL
);

DROP POLICY IF EXISTS "Equipe de regulação e service_role atualizam jobs" ON public.esus_sync_jobs;
CREATE POLICY "Equipe de regulação e service_role atualizam jobs" 
ON public.esus_sync_jobs FOR UPDATE 
USING (
    auth.uid() IS NOT NULL OR auth.role() = 'service_role'
);
