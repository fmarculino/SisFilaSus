# Auditoria de Performance — SisFilaSus

**Data:** 05/09/2026
**Motivo:** preparação para produção com dezenas a centenas de acessos simultâneos.
**Sintoma relatado:** sistema lento; dashboard exibindo todos os indicadores zerados de forma intermitente ("hora mostra, hora não mostra").

---

## 1. Resumo executivo

O problema **não é o volume de dados**. As tabelas do SisFilaSus são pequenas para o padrão do Postgres — 97 mil linhas é um volume trivial.

O problema é que **as políticas de RLS (Row Level Security) são re-executadas uma vez por linha varrida**. A cada carregamento do dashboard isso produzia aproximadamente **580 mil consultas à tabela `users`**, estourando o limite de tempo do banco (3 segundos). Quando estoura, o PostgREST devolve erro, o app cai no fallback `|| 0` e **desenha o dashboard inteiro zerado** — sem avisar que houve falha.

Medição na base real, mesma consulta, apenas trocando o modo de autenticação:

| Consulta | RLS desligado (`service_role`) | RLS ligado (usuário autenticado) |
|---|---|---|
| `fila_solicitacoes` varredura completa | **0,50 s** — HTTP 200 | **timeout** — HTTP 500 / `57014` |
| `vw_dashboard_kpis` | **0,75 s** — HTTP 200 | **timeout** — HTTP 500 / `57014` |
| `municipios` (policy `USING(true)`) | 0,44 s | **0,44 s** — HTTP 200 |

A última linha é o controle do experimento: `municipios` tem uma policy trivial que não chama função nenhuma, e responde normalmente sob RLS. Isso isola a causa com precisão — **não é a rede, não é o servidor, não é o tamanho da tabela. É a policy.**

`57014` é o código SQLSTATE de `canceling statement due to statement timeout`.

---

## 2. Volume real da base (medido em 05/09/2026)

| Tabela | Linhas |
|---|---:|
| `fila_snapshots` | 456.874 |
| `fila_solicitacoes` | 97.058 |
| `pacientes` | 58.235 |
| `cids` | 2.070 |
| `procedimentos` | 734 |
| `agendamentos_procedimentos` | 640 |
| `audit_log` | 139 |
| `unidades_solicitantes` | 63 |
| `importacoes` | 30 |
| `contatos` | 10 |
| `movimentacoes_fila` | 1 |

---

## 3. Causa raiz detalhada

### 3.1 A policy chamava uma função por linha

As policies foram escritas assim:

```sql
CREATE POLICY "..." ON public.fila_solicitacoes FOR SELECT USING (
    public.get_user_role() <> 'UNIDADE_USER' OR
    cnes_solicitante = public.get_user_cnes_vinculo()
);
```

`public.get_user_role()` executa `SELECT role FROM users WHERE id = auth.uid()`.

Escrita dessa forma, a chamada é uma expressão comum dentro do filtro, e o planejador do Postgres **a avalia para cada linha candidata**. Numa varredura de 97.058 linhas, são 97.058 subconsultas.

A `vw_dashboard_kpis` piorava isso: ela era composta por **seis subconsultas escalares independentes**, cada uma varrendo `fila_solicitacoes` do início ao fim. Seis varreduras × 97 mil linhas ≈ **582 mil avaliações de RLS por carregamento do dashboard**.

### 3.2 Por que "hora mostra, hora não mostra"

O tempo dessa operação fica logo acima do `statement_timeout` de 3 s. Quando o cache do Postgres está quente ou o servidor está ocioso, a consulta às vezes termina a tempo e os números aparecem. Quando há concorrência, estoura. Daí a intermitência.

### 3.3 Por que aparecia ZERO em vez de ERRO

```ts
const kpis = kpisRes.data || { fila_total_ativa: 0, ... }
```

`kpisRes.error` nunca era verificado. Um timeout produz `data: null`, e o `||` substituía silenciosamente por zeros. O usuário via "0 pacientes aguardando" — indistinguível de uma fila realmente vazia, num sistema onde isso é uma informação crítica.

No primeiro print anexado dá para ver a assinatura exata do bug: os procedimentos mostram `21.534 (0,0%)`. O total (21.534) veio de uma view que respondeu; a porcentagem é `21.534 ÷ 0`, porque o KPI que serve de divisor havia falhado.

### 3.4 A tentativa anterior de correção estava incompleta

O arquivo `optimize_search_rls.sql` já tinha marcado as funções como `STABLE`. Isso é necessário, **mas não é suficiente**: o Postgres só promove a chamada a *InitPlan* (avaliada uma vez por statement) quando ela está escrita como subconsulta escalar — `(SELECT public.get_user_role())`. Sem os parênteses com `SELECT`, continua avaliando por linha mesmo sendo `STABLE`.

O mesmo arquivo também criava `idx_pacientes_nome_btree` para acelerar buscas `ILIKE '%termo%'`. **Um índice B-Tree não atende esse padrão** — B-Tree só serve para prefixo (`'termo%'`), nunca para curinga à esquerda. O índice correto é GIN com trigramas (`pg_trgm`).

---

## 4. O que foi corrigido

### 4.1 Banco — `supabase/migrations/20260905220000_performance_rls_indices_e_views.sql`

**Nenhuma regra de acesso foi afrouxada.** As condições lógicas das policies são idênticas; muda apenas *como* são avaliadas.

1. **Chamadas de RLS promovidas a InitPlan** — todas as `public.get_user_role()` viraram `(SELECT public.get_user_role())`. De ~97.000 avaliações para **1** por statement.

2. **Policies `FOR ALL` separadas em `INSERT`/`UPDATE`/`DELETE` explícitas** — policies permissivas se somam com `OR`. Uma policy `FOR ALL` fazia todo `SELECT` avaliar *duas* expressões de RLS por linha, dobrando o custo à toa.

3. **Views de dashboard reescritas com `COUNT(*) FILTER (WHERE ...)`** — os mesmos sete números com **uma** varredura em vez de seis.

4. **21 índices ausentes criados**, com destaque para:
   - `idx_fila_ordenacao_padrao` — índice parcial cobrindo a ordenação padrão da tela de fila (`posicao_fila NULLS LAST, data_solicitacao` sobre `active = true`). Sem ele, toda página fazia varredura + ordenação de 97 mil linhas.
   - `idx_snapshots_importacao` — a tabela de 456 mil linhas não tinha índice na FK `importacao_id`.
   - `idx_fila_cnes_solicitante` — FK usada pela própria policy de `UNIDADE_USER`.
   - `idx_mov_*` — a tabela `movimentacoes_fila` não tinha **nenhum** índice.

5. **Índices GIN de trigrama** (`pg_trgm`) em `pacientes.nome_usuario`, `cns_usuario`, `cpf_usuario` e `procedimentos.desc_sigtap`, que são os campos buscados com `ILIKE '%termo%'`. O B-Tree inútil foi substituído por um índice de ordenação alfabética, que é o uso real que a tela faz.

### 4.2 Aplicação

| Arquivo | Correção |
|---|---|
| `dashboard/page.tsx` | Passa a distinguir **falha** de **fila vazia**. Exibe `—` e um aviso explícito em vez de zeros falsos; a porcentagem some quando o divisor não carregou. |
| `dashboard/pacientes/page.tsx` | Removida a consulta que baixava **as 58.235 linhas** de `pacientes` só para montar o dropdown de municípios. Agora usa a tabela `municipios` (63 linhas). |
| `dashboard/fila/page.tsx` | 5 consultas seriais → paralelas; eliminada a segunda varredura completa de `procedimentos`; limites explícitos nos dropdowns. |
| `dashboard/agendas/page.tsx` | 5 consultas seriais → paralelas. |
| `dashboard/convocacao/page.tsx` | 2 consultas seriais → paralelas; limite explícito. |
| `dashboard/movimentacoes/page.tsx` | Limite explícito. |
| `dashboard/sincronizacao/actions.ts` | Limite explícito. |

### 4.3 O limite de 1000 linhas do PostgREST

Mesma armadilha já enfrentada no SisEscala. O PostgREST corta toda resposta em 1000 linhas (`db-max-rows`) **sem sinalizar erro**. Consultas sem `.limit()` explícito não falham: elas simplesmente devolvem menos dados do que o código supõe.

Casos que estavam expostos e foram corrigidos: `pacientes` (dropdown de municípios — o pior, pedia 58 mil linhas e recebia 1.000), `convocacao`, `movimentacoes`, `divergencias_sisreg`, e as listas de apoio de `fila` e `agendas`.

`cids` já tem **2.070 linhas** e `procedimentos` **734** — esta última passa dos 1.000 na próxima leva de importações. Os limites explícitos que adicionei tornam o teto visível e previsível em vez de silencioso.

---

## 5. Pendências recomendadas (não aplicadas)

Itens que identifiquei mas que envolvem decisão sua ou mudança de comportamento visível:

1. **Retenção de `fila_snapshots`** — é a tabela que faz o banco crescer. São ~15.200 linhas por importação; em 30 importações chegou a 456.874. Com importação diária, passa de 5 milhões em um ano. Recomendo definir uma política de retenção (ex.: manter snapshots detalhados por 6 meses e consolidar o histórico anterior em agregados mensais).

2. **`count: 'exact'` na tela de fila** — custa ~230 ms por carregamento, pois obriga o Postgres a contar todas as linhas que casam com o filtro. Trocar por `'estimated'` elimina o custo, mas passa a exibir **totais aproximados** na paginação. Deixei como está e marquei no código: num sistema de fila de saúde, exibir número aproximado de pacientes é decisão de negócio, não técnica.

3. **`statement_timeout`** — está em 3 s para o papel `authenticated`. Depois da correção do RLS as consultas cabem folgadamente nesse limite, então **recomendo manter**: ele funciona como proteção contra uma consulta ruim derrubar o banco sob carga. Aumentá-lo mascararia problemas em vez de resolvê-los.

4. **`auth.getUser()` duplicado** — o middleware valida o usuário a cada requisição e **cada página valida de novo**, somando duas idas ao serviço de autenticação antes de qualquer dado ser buscado. Com centenas de acessos simultâneos isso vira volume relevante. Vale consolidar.

5. **Peso do bundle no cliente** — `AgendasClient.tsx` (2.175 linhas) e `FilaClient.tsx` (1.441 linhas) são componentes `'use client'` inteiros enviados ao navegador. Não afeta o banco, mas afeta o tempo até a tela ficar utilizável, especialmente nas máquinas das unidades.

6. **Importação de CSV** — o arquivo inteiro trafega como um único corpo JSON (`bodySizeLimit: 50mb`) e é processado em memória. Funciona hoje, mas é o ponto que quebra primeiro se o volume dobrar. Processar em streaming resolveria.

---

## 6. Como aplicar

A migration **não foi executada** — depende de você, por alterar policies de segurança em produção.

Ela é transacional (`BEGIN`/`COMMIT`): ou aplica tudo, ou nada. Para rodar, cole o conteúdo de
`supabase/migrations/20260905220000_performance_rls_indices_e_views.sql`
no SQL Editor do Supabase e execute.

**Validação depois de aplicar** — repetir a sonda que provou o problema. Com a chave anônima, `vw_dashboard_kpis` deve responder rápido em vez de retornar `57014`:

```bash
curl -s -o /dev/null -w "http=%{http_code} tempo=%{time_total}s\n" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY" \
  "$SUPABASE_URL/rest/v1/vw_dashboard_kpis?select=*"
```

Antes: `http=500 tempo=3,33s`. Esperado depois: `http=200` em tempo comparável ao do `service_role` (~0,3 s, já que a view passou a fazer uma varredura em vez de seis).
