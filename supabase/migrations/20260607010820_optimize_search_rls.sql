-- =========================================================================
-- SCRIPT DE OTIMIZAÇÃO: BUSCA OPERACIONAL E POLÍTICAS DE SEGURANÇA (RLS)
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

-- 1. OTIMIZAÇÃO DAS FUNÇÕES DO RLS (POLÍTICAS DE SEGURANÇA)
-- Por padrão, funções PostgreSQL sem classificação de volatilidade são VOLATILE.
-- Isso faz com que sejam re-executadas em subqueries para cada linha avaliada no banco de dados.
-- Mudando para STABLE e SECURITY DEFINER, o PostgreSQL avalia-as apenas uma vez por query statement.

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_user_cnes_vinculo()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT cnes_vinculo FROM public.users WHERE id = auth.uid();
$$;

-- 2. CRIAÇÃO DE ÍNDICE ESTRANGEIRO (FOREIGN KEY INDEX)
-- PostgreSQL não cria índices automáticos nas chaves estrangeiras.
-- Sem este índice, a junção (INNER JOIN) entre 'fila_solicitacoes' e 'pacientes'
-- requer uma varredura sequencial completa das tabelas ao filtrar.
CREATE INDEX IF NOT EXISTS idx_fila_solicitacoes_paciente_id 
ON public.fila_solicitacoes(paciente_id);

-- 3. CRIAÇÃO DE ÍNDICE B-TREE PARA FILTRAGEM TEXTUAL
-- O índice atual 'idx_pacientes_nome' é do tipo GIN (FTS vector), que não é otimizado
-- para buscas baseadas em fragmentos usando ILIKE '%termo%'.
-- Um índice B-Tree convencional na coluna 'nome_usuario' reduzirá drasticamente o tempo
-- de varredura durante a filtragem de nomes no join de pacientes.
CREATE INDEX IF NOT EXISTS idx_pacientes_nome_btree 
ON public.pacientes(nome_usuario);

-- 4. EXECUTAR ANALYZE PARA ATUALIZAR ESTATÍSTICAS DO PLANEJADOR
-- Garante que o otimizador do Postgres adote os novos índices imediatamente.
ANALYZE public.fila_solicitacoes;
ANALYZE public.pacientes;
