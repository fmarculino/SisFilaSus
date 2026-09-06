-- =========================================================================
-- SISFILASUS — OTIMIZACAO DE PERFORMANCE PARA PRODUCAO
-- Data: 2026-09-05
--
-- CONTEXTO / DIAGNOSTICO MEDIDO NA BASE REAL:
--   fila_solicitacoes ... 97.058 linhas
--   pacientes ........... 58.235 linhas
--   fila_snapshots ...... 456.874 linhas
--
--   Mesma query, medida via PostgREST:
--     service_role (RLS ignorado) ....... 0,50 s   -> 200 OK
--     usuario autenticado (RLS ativo) ... > 3,0 s  -> 500 / SQLSTATE 57014
--                                                    (canceling statement due
--                                                     to statement timeout)
--
--   Ou seja: o volume de dados NAO e o problema. O problema e que as policies
--   de RLS chamam public.get_user_role() como uma expressao comum dentro do
--   filtro. O Postgres re-avalia essa chamada UMA VEZ POR LINHA varrida.
--   Em uma varredura de 97 mil linhas isso vira ~97 mil subconsultas na
--   tabela users — e a view vw_dashboard_kpis faz SEIS varreduras dessas,
--   resultando em ~580 mil chamadas por carregamento do dashboard.
--
--   Quando estoura o statement_timeout, o PostgREST devolve erro 500, o app
--   cai no fallback `?? 0` e o dashboard renderiza todos os KPIs zerados.
--   E exatamente o sintoma de "hora mostra, hora nao mostra".
--
-- ESTRATEGIA DESTA MIGRATION:
--   1. Envolver as chamadas de funcao das policies em (SELECT ...), o que faz
--      o planejador transformar a chamada em InitPlan — avaliado UMA vez por
--      statement em vez de uma vez por linha.
--   2. Separar as policies FOR ALL em INSERT/UPDATE/DELETE explicitos, para
--      que um SELECT deixe de avaliar duas policies permissivas.
--   3. Criar os indices ausentes (ordenacao padrao, FKs, busca textual).
--   4. Reescrever as views de dashboard para varrer a tabela UMA vez.
--
-- SEGURANCA: nenhuma regra de acesso e afrouxada. As condicoes logicas das
-- policies sao identicas as anteriores — muda apenas COMO sao avaliadas.
-- =========================================================================

BEGIN;

-- =========================================================================
-- 1. FUNCOES HELPER DE RLS
-- =========================================================================
-- STABLE informa ao planejador que o resultado nao muda dentro do statement,
-- pre-requisito para que a chamada possa virar InitPlan.

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_user_cnes_vinculo()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT cnes_vinculo FROM public.users WHERE id = auth.uid();
$$;


-- =========================================================================
-- 2. INDICES AUSENTES
-- =========================================================================

-- 2.1 fila_solicitacoes — ordenacao padrao da tela "Fila de Espera".
-- A tela ordena por posicao_fila ASC NULLS LAST, data_solicitacao ASC sobre
-- active = true. Sem este indice cada pagina faz seq scan + sort de 97k linhas.
CREATE INDEX IF NOT EXISTS idx_fila_ordenacao_padrao
  ON public.fila_solicitacoes (posicao_fila ASC NULLS LAST, data_solicitacao ASC)
  WHERE active = true;

-- 2.2 Combinacao usada pelos KPIs e pelos filtros de modalidade.
CREATE INDEX IF NOT EXISTS idx_fila_active_modalidade
  ON public.fila_solicitacoes (modalidade_fila)
  WHERE active = true;

-- 2.3 Filtro "omitir fora do SISREG" + filtro de status, sempre com active.
CREATE INDEX IF NOT EXISTS idx_fila_active_status
  ON public.fila_solicitacoes (status_interno)
  WHERE active = true;

-- 2.4 data_solicitacao — usada na ordenacao alternativa e no filtro "antigas".
CREATE INDEX IF NOT EXISTS idx_fila_data_solicitacao
  ON public.fila_solicitacoes (data_solicitacao);

-- 2.5 FKs sem indice. O Postgres NAO cria indice automatico em FK; sem eles
-- todo JOIN e todo ON DELETE CASCADE vira varredura completa.
CREATE INDEX IF NOT EXISTS idx_fila_cnes_solicitante
  ON public.fila_solicitacoes (cnes_solicitante);

CREATE INDEX IF NOT EXISTS idx_fila_ultima_importacao
  ON public.fila_solicitacoes (ultima_importacao_id);

CREATE INDEX IF NOT EXISTS idx_fila_hospital_encaminhado
  ON public.fila_solicitacoes (hospital_encaminhado_id);

-- 2.6 fila_snapshots (456 mil linhas) — importacao_id nao tinha indice.
-- Sem ele, cada importacao e cada limpeza percorre a tabela inteira.
CREATE INDEX IF NOT EXISTS idx_snapshots_importacao
  ON public.fila_snapshots (importacao_id);

CREATE INDEX IF NOT EXISTS idx_snapshots_sol_data
  ON public.fila_snapshots (cod_solicitacao, created_at DESC);

-- 2.7 contatos — KPI "contatos hoje" filtra por created_at.
CREATE INDEX IF NOT EXISTS idx_contatos_created_at
  ON public.contatos (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_contatos_operador
  ON public.contatos (operador_id);

-- 2.8 audit_log — cresce sem limite e a tela ordena por created_at DESC.
CREATE INDEX IF NOT EXISTS idx_audit_created_at
  ON public.audit_log (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_usuario
  ON public.audit_log (usuario_id);

-- 2.9 movimentacoes_fila — nenhum indice existia nesta tabela.
CREATE INDEX IF NOT EXISTS idx_mov_created_at
  ON public.movimentacoes_fila (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_mov_solicitacao
  ON public.movimentacoes_fila (cod_solicitacao);

CREATE INDEX IF NOT EXISTS idx_mov_status
  ON public.movimentacoes_fila (status);

-- 2.10 pacientes — ordenacao alfabetica da tela e filtro por municipio.
CREATE INDEX IF NOT EXISTS idx_pacientes_municipio
  ON public.pacientes (municipio_origem);

-- 2.11 procedimentos — filtro por especialidade (grupo_descricao).
CREATE INDEX IF NOT EXISTS idx_procedimentos_grupo
  ON public.procedimentos (grupo_descricao);


-- =========================================================================
-- 3. BUSCA TEXTUAL POR NOME (pg_trgm)
-- =========================================================================
-- A aplicacao busca paciente com ILIKE '%termo%'. Um indice B-Tree comum
-- (idx_pacientes_nome_btree, criado numa tentativa anterior) NAO atende esse
-- padrao: B-Tree so serve para prefixo ('termo%'), nunca para curinga a
-- esquerda. O indice correto para ILIKE '%x%' e GIN com trigramas.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_pacientes_nome_trgm
  ON public.pacientes USING gin (nome_usuario gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_pacientes_cns_trgm
  ON public.pacientes USING gin (cns_usuario gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_pacientes_cpf_trgm
  ON public.pacientes USING gin (cpf_usuario gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_procedimentos_desc_trgm
  ON public.procedimentos USING gin (desc_sigtap gin_trgm_ops);

-- O B-Tree em nome_usuario nao serve a busca com curinga a esquerda e so
-- consome espaco e tempo de escrita. A ordenacao alfabetica da tela de
-- pacientes continua atendida — recriado abaixo apenas para esse fim.
DROP INDEX IF EXISTS public.idx_pacientes_nome_btree;
CREATE INDEX IF NOT EXISTS idx_pacientes_nome_ordem
  ON public.pacientes (nome_usuario ASC);


-- =========================================================================
-- 4. POLICIES DE RLS — O CORACAO DA CORRECAO
-- =========================================================================
-- Padrao aplicado: (SELECT public.get_user_role()) em vez de
-- public.get_user_role(). O parenteses com SELECT faz o planejador promover a
-- chamada a InitPlan: avaliada uma unica vez por statement.
--
-- Alem disso, toda policy FOR ALL e substituida por policies explicitas de
-- INSERT/UPDATE/DELETE. Policies permissivas se somam com OR, entao uma
-- policy FOR ALL fazia todo SELECT avaliar DUAS expressoes de RLS por linha.

-- ---------- 4.1 users ----------
DROP POLICY IF EXISTS "Admins e Coordenadores gerenciam usuários" ON public.users;
DROP POLICY IF EXISTS "Visualização de perfil próprio" ON public.users;

CREATE POLICY "users_select" ON public.users
  FOR SELECT USING (
    id = (SELECT auth.uid())
    OR (SELECT public.get_user_role()) IN ('SMS_ADMIN', 'COORDENADOR')
  );
CREATE POLICY "users_insert" ON public.users
  FOR INSERT WITH CHECK ((SELECT public.get_user_role()) IN ('SMS_ADMIN', 'COORDENADOR'));
CREATE POLICY "users_update" ON public.users
  FOR UPDATE USING ((SELECT public.get_user_role()) IN ('SMS_ADMIN', 'COORDENADOR'));
CREATE POLICY "users_delete" ON public.users
  FOR DELETE USING ((SELECT public.get_user_role()) IN ('SMS_ADMIN', 'COORDENADOR'));

-- ---------- 4.2 pacientes (58 mil linhas) ----------
DROP POLICY IF EXISTS "Todos autenticados visualizam e atualizam pacientes" ON public.pacientes;
DROP POLICY IF EXISTS "Todos autenticados inserem pacientes" ON public.pacientes;
DROP POLICY IF EXISTS "Admins, Coordenadores e Operadores atualizam pacientes" ON public.pacientes;
DROP POLICY IF EXISTS "Apenas Admins deletam pacientes" ON public.pacientes;

CREATE POLICY "pacientes_select" ON public.pacientes
  FOR SELECT USING ((SELECT auth.role()) = 'authenticated');
CREATE POLICY "pacientes_insert" ON public.pacientes
  FOR INSERT WITH CHECK ((SELECT auth.role()) = 'authenticated');
CREATE POLICY "pacientes_update" ON public.pacientes
  FOR UPDATE USING ((SELECT public.get_user_role()) IN ('SMS_ADMIN', 'COORDENADOR', 'OPERADOR_REGULACAO'));
CREATE POLICY "pacientes_delete" ON public.pacientes
  FOR DELETE USING ((SELECT public.get_user_role()) = 'SMS_ADMIN');

-- ---------- 4.3 pacientes_telefones ----------
DROP POLICY IF EXISTS "Autenticados leem telefones de pacientes" ON public.pacientes_telefones;
DROP POLICY IF EXISTS "Admins, coordenadores e operadores gerenciam telefones" ON public.pacientes_telefones;

CREATE POLICY "tel_select" ON public.pacientes_telefones
  FOR SELECT USING ((SELECT auth.role()) = 'authenticated');
CREATE POLICY "tel_insert" ON public.pacientes_telefones
  FOR INSERT WITH CHECK ((SELECT public.get_user_role()) IN ('SMS_ADMIN', 'COORDENADOR', 'OPERADOR_REGULACAO'));
CREATE POLICY "tel_update" ON public.pacientes_telefones
  FOR UPDATE USING ((SELECT public.get_user_role()) IN ('SMS_ADMIN', 'COORDENADOR', 'OPERADOR_REGULACAO'));
CREATE POLICY "tel_delete" ON public.pacientes_telefones
  FOR DELETE USING ((SELECT public.get_user_role()) IN ('SMS_ADMIN', 'COORDENADOR', 'OPERADOR_REGULACAO'));

-- ---------- 4.4 fila_solicitacoes (97 mil linhas — o gargalo principal) ----------
DROP POLICY IF EXISTS "Usuários autenticados comuns leem solicitações" ON public.fila_solicitacoes;
DROP POLICY IF EXISTS "Escrita na fila restrita a admins, coord e operadores" ON public.fila_solicitacoes;

CREATE POLICY "fila_select" ON public.fila_solicitacoes
  FOR SELECT USING (
    (SELECT public.get_user_role()) <> 'UNIDADE_USER'
    OR cnes_solicitante = (SELECT public.get_user_cnes_vinculo())
  );
CREATE POLICY "fila_insert" ON public.fila_solicitacoes
  FOR INSERT WITH CHECK ((SELECT public.get_user_role()) IN ('SMS_ADMIN', 'COORDENADOR', 'OPERADOR_REGULACAO'));
CREATE POLICY "fila_update" ON public.fila_solicitacoes
  FOR UPDATE USING ((SELECT public.get_user_role()) IN ('SMS_ADMIN', 'COORDENADOR', 'OPERADOR_REGULACAO'));
CREATE POLICY "fila_delete" ON public.fila_solicitacoes
  FOR DELETE USING ((SELECT public.get_user_role()) IN ('SMS_ADMIN', 'COORDENADOR', 'OPERADOR_REGULACAO'));

-- ---------- 4.5 tabelas de apoio ----------
-- A leitura ja era USING(true); apenas as policies FOR ALL de escrita mudam.
DROP POLICY IF EXISTS "Apenas Admins e Coordenadores escrevem nas tabelas de apoio" ON public.municipios;
DROP POLICY IF EXISTS "Apenas Admins e Coordenadores escrevem nas unidades" ON public.unidades_solicitantes;
DROP POLICY IF EXISTS "Apenas Admins e Coordenadores escrevem nos hospitais" ON public.hospitais_prestadores;
DROP POLICY IF EXISTS "Apenas Admins e Coordenadores escrevem nos procedimentos" ON public.procedimentos;
DROP POLICY IF EXISTS "Apenas Admins e Coordenadores escrevem nos cids" ON public.cids;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['municipios','unidades_solicitantes','hospitais_prestadores','procedimentos','cids']
  LOOP
    EXECUTE format($f$
      CREATE POLICY %I ON public.%I FOR INSERT WITH CHECK
        ((SELECT public.get_user_role()) IN ('SMS_ADMIN','COORDENADOR'));
      CREATE POLICY %I ON public.%I FOR UPDATE USING
        ((SELECT public.get_user_role()) IN ('SMS_ADMIN','COORDENADOR'));
      CREATE POLICY %I ON public.%I FOR DELETE USING
        ((SELECT public.get_user_role()) IN ('SMS_ADMIN','COORDENADOR'));
    $f$, t||'_insert', t, t||'_update', t, t||'_delete', t);
  END LOOP;
END $$;

-- ---------- 4.6 importacoes e fila_snapshots (456 mil linhas) ----------
DROP POLICY IF EXISTS "Leitura de importações para equipe de regulação" ON public.importacoes;
DROP POLICY IF EXISTS "Apenas admins e coordenadores gerenciam importações" ON public.importacoes;
DROP POLICY IF EXISTS "Leitura de snapshots para equipe de regulação" ON public.fila_snapshots;
DROP POLICY IF EXISTS "Escrita de snapshots restrita a admins e coordenadores" ON public.fila_snapshots;

CREATE POLICY "importacoes_select" ON public.importacoes
  FOR SELECT USING ((SELECT public.get_user_role()) IN ('SMS_ADMIN','COORDENADOR','OPERADOR_REGULACAO'));
CREATE POLICY "importacoes_insert" ON public.importacoes
  FOR INSERT WITH CHECK ((SELECT public.get_user_role()) IN ('SMS_ADMIN','COORDENADOR'));
CREATE POLICY "importacoes_update" ON public.importacoes
  FOR UPDATE USING ((SELECT public.get_user_role()) IN ('SMS_ADMIN','COORDENADOR'));
CREATE POLICY "importacoes_delete" ON public.importacoes
  FOR DELETE USING ((SELECT public.get_user_role()) IN ('SMS_ADMIN','COORDENADOR'));

CREATE POLICY "snapshots_select" ON public.fila_snapshots
  FOR SELECT USING ((SELECT public.get_user_role()) IN ('SMS_ADMIN','COORDENADOR','OPERADOR_REGULACAO'));
CREATE POLICY "snapshots_insert" ON public.fila_snapshots
  FOR INSERT WITH CHECK ((SELECT public.get_user_role()) IN ('SMS_ADMIN','COORDENADOR'));
CREATE POLICY "snapshots_update" ON public.fila_snapshots
  FOR UPDATE USING ((SELECT public.get_user_role()) IN ('SMS_ADMIN','COORDENADOR'));
CREATE POLICY "snapshots_delete" ON public.fila_snapshots
  FOR DELETE USING ((SELECT public.get_user_role()) IN ('SMS_ADMIN','COORDENADOR'));

-- ---------- 4.7 contatos ----------
DROP POLICY IF EXISTS "Visualização de contatos" ON public.contatos;
DROP POLICY IF EXISTS "Apenas operadores e coord/admins gravam contatos" ON public.contatos;

CREATE POLICY "contatos_select" ON public.contatos
  FOR SELECT USING ((SELECT auth.role()) = 'authenticated');
CREATE POLICY "contatos_insert" ON public.contatos
  FOR INSERT WITH CHECK ((SELECT public.get_user_role()) IN ('SMS_ADMIN','COORDENADOR','OPERADOR_REGULACAO','AUXILIAR'));
CREATE POLICY "contatos_update" ON public.contatos
  FOR UPDATE USING ((SELECT public.get_user_role()) IN ('SMS_ADMIN','COORDENADOR','OPERADOR_REGULACAO','AUXILIAR'));
CREATE POLICY "contatos_delete" ON public.contatos
  FOR DELETE USING ((SELECT public.get_user_role()) IN ('SMS_ADMIN','COORDENADOR'));

-- ---------- 4.8 movimentacoes_fila ----------
DROP POLICY IF EXISTS "Visualização de movimentações" ON public.movimentacoes_fila;
DROP POLICY IF EXISTS "Operadores e auxiliares podem propor movimentações" ON public.movimentacoes_fila;
DROP POLICY IF EXISTS "Médicos, Coordenadores e Admins revisam movimentações" ON public.movimentacoes_fila;

CREATE POLICY "mov_select" ON public.movimentacoes_fila
  FOR SELECT USING ((SELECT auth.role()) = 'authenticated');
CREATE POLICY "mov_insert" ON public.movimentacoes_fila
  FOR INSERT WITH CHECK ((SELECT public.get_user_role()) IN ('SMS_ADMIN','COORDENADOR','OPERADOR_REGULACAO','AUXILIAR'));
CREATE POLICY "mov_update" ON public.movimentacoes_fila
  FOR UPDATE USING ((SELECT public.get_user_role()) IN ('SMS_ADMIN','COORDENADOR','MEDICO_REGULADOR'));

-- ---------- 4.9 audit_log ----------
DROP POLICY IF EXISTS "Leitura de auditoria exclusiva para gestores" ON public.audit_log;
CREATE POLICY "audit_select" ON public.audit_log
  FOR SELECT USING ((SELECT public.get_user_role()) IN ('SMS_ADMIN','COORDENADOR'));

-- ---------- 4.10 templates e configuracoes ----------
DROP POLICY IF EXISTS "Leitura de templates para usuários autenticados" ON public.templates_mensagem;
DROP POLICY IF EXISTS "Edição de templates exclusiva para gestores" ON public.templates_mensagem;
DROP POLICY IF EXISTS "Leitura de configurações gerais para usuários autenticados" ON public.configuracoes;
DROP POLICY IF EXISTS "Edição de configurações exclusiva para gestores" ON public.configuracoes;

CREATE POLICY "templates_select" ON public.templates_mensagem
  FOR SELECT USING ((SELECT auth.role()) = 'authenticated');
CREATE POLICY "templates_insert" ON public.templates_mensagem
  FOR INSERT WITH CHECK ((SELECT public.get_user_role()) IN ('SMS_ADMIN','COORDENADOR'));
CREATE POLICY "templates_update" ON public.templates_mensagem
  FOR UPDATE USING ((SELECT public.get_user_role()) IN ('SMS_ADMIN','COORDENADOR'));
CREATE POLICY "templates_delete" ON public.templates_mensagem
  FOR DELETE USING ((SELECT public.get_user_role()) IN ('SMS_ADMIN','COORDENADOR'));

CREATE POLICY "config_select" ON public.configuracoes
  FOR SELECT USING ((SELECT auth.role()) = 'authenticated');
CREATE POLICY "config_insert" ON public.configuracoes
  FOR INSERT WITH CHECK ((SELECT public.get_user_role()) IN ('SMS_ADMIN','COORDENADOR'));
CREATE POLICY "config_update" ON public.configuracoes
  FOR UPDATE USING ((SELECT public.get_user_role()) IN ('SMS_ADMIN','COORDENADOR'));
CREATE POLICY "config_delete" ON public.configuracoes
  FOR DELETE USING ((SELECT public.get_user_role()) IN ('SMS_ADMIN','COORDENADOR'));

-- ---------- 4.11 agendas e agendamentos ----------
DROP POLICY IF EXISTS "Autenticados leem agendas" ON public.agendas_prestadores;
DROP POLICY IF EXISTS "Admins, coordenadores e operadores gerenciam agendas" ON public.agendas_prestadores;
DROP POLICY IF EXISTS "Autenticados leem agendamentos" ON public.agendamentos_procedimentos;
DROP POLICY IF EXISTS "Admins, coordenadores e operadores gerenciam agendamentos" ON public.agendamentos_procedimentos;

CREATE POLICY "agendas_select" ON public.agendas_prestadores
  FOR SELECT USING ((SELECT auth.role()) = 'authenticated');
CREATE POLICY "agendas_insert" ON public.agendas_prestadores
  FOR INSERT WITH CHECK ((SELECT public.get_user_role()) IN ('SMS_ADMIN','COORDENADOR','OPERADOR_REGULACAO'));
CREATE POLICY "agendas_update" ON public.agendas_prestadores
  FOR UPDATE USING ((SELECT public.get_user_role()) IN ('SMS_ADMIN','COORDENADOR','OPERADOR_REGULACAO'));
CREATE POLICY "agendas_delete" ON public.agendas_prestadores
  FOR DELETE USING ((SELECT public.get_user_role()) IN ('SMS_ADMIN','COORDENADOR','OPERADOR_REGULACAO'));

CREATE POLICY "agendamentos_select" ON public.agendamentos_procedimentos
  FOR SELECT USING ((SELECT auth.role()) = 'authenticated');
CREATE POLICY "agendamentos_insert" ON public.agendamentos_procedimentos
  FOR INSERT WITH CHECK ((SELECT public.get_user_role()) IN ('SMS_ADMIN','COORDENADOR','OPERADOR_REGULACAO','AUXILIAR'));
CREATE POLICY "agendamentos_update" ON public.agendamentos_procedimentos
  FOR UPDATE USING ((SELECT public.get_user_role()) IN ('SMS_ADMIN','COORDENADOR','OPERADOR_REGULACAO','AUXILIAR'));
CREATE POLICY "agendamentos_delete" ON public.agendamentos_procedimentos
  FOR DELETE USING ((SELECT public.get_user_role()) IN ('SMS_ADMIN','COORDENADOR','OPERADOR_REGULACAO','AUXILIAR'));


-- =========================================================================
-- 5. VIEWS DE DASHBOARD — UMA VARREDURA EM VEZ DE SEIS
-- =========================================================================
-- A versao anterior usava seis subconsultas escalares independentes; cada uma
-- varria fila_solicitacoes do inicio ao fim. COUNT(*) FILTER (WHERE ...)
-- produz os mesmos numeros lendo a tabela uma unica vez.

DROP VIEW IF EXISTS public.vw_dashboard_kpis;
CREATE VIEW public.vw_dashboard_kpis
WITH (security_invoker = true)
AS
SELECT
  COUNT(*)                                                        AS fila_total_ativa,
  COUNT(*) FILTER (WHERE modalidade_fila = 0)                     AS aguardando_consultas,
  COUNT(*) FILTER (WHERE modalidade_fila = 1)                     AS aguardando_exames,
  COUNT(*) FILTER (WHERE modalidade_fila = 2)                     AS aguardando_cirurgias,
  COUNT(*) FILTER (WHERE modalidade_fila = 3
                      OR modalidade_fila IS NULL)                 AS demais_procedimentos,
  COALESCE(AVG(EXTRACT(epoch FROM (now() - data_solicitacao)))
           / (365.25 * 86400), 0)                                 AS media_espera_anos,
  (SELECT COUNT(*) FROM public.contatos
    WHERE created_at >= timezone('utc'::text, CURRENT_DATE))      AS contatos_hoje
FROM public.fila_solicitacoes
WHERE active = true;

GRANT SELECT ON public.vw_dashboard_kpis TO authenticated;


-- =========================================================================
-- 6. ESTATISTICAS DO PLANEJADOR
-- =========================================================================
COMMIT;

ANALYZE public.fila_solicitacoes;
ANALYZE public.pacientes;
ANALYZE public.fila_snapshots;
ANALYZE public.contatos;
ANALYZE public.procedimentos;
ANALYZE public.audit_log;
