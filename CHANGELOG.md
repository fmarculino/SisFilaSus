# 📝 CHANGELOG — SisFilaSus

Todas as alterações notáveis, novas funcionalidades e correções deste projeto serão documentadas neste arquivo. O formato é baseado no [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/) e este projeto adota o [Versionamento Semântico (SemVer)](https://semver.org/lang/pt-BR/).

---

## [0.6.3-beta] — 2026-06-07 (Atual)
### Adicionado
* **Status `ENCAMINHADO` (Encaminhado Hospital/Clínica)**: Criado novo status para diferenciar pacientes encaminhados para prestadores mas sem data de internação definida.
* **Fluxo de Encaminhamento Dinâmico**:
  * Se a data de internação não for preenchida no encaminhamento, o status do paciente passa a ser `ENCAMINHADO`.
  * Se for preenchida, passa diretamente a `INTERNADO`.
  * Possibilidade de atualizar um paciente de `ENCAMINHADO` para `INTERNADO` preenchendo a data de internação no drawer.
* **Badge e Seletores na UI**: Adicionado badge de cor ciano/sky para `ENCAMINHADO`, adicionado o status no seletor manual, nos filtros de pesquisa de status da Fila de Espera, no Portal do Cidadão e nos Relatórios Gerenciais.

### Alterado
* **Rede de Prestadores (Segurança de Dados)**: Removida a opção de exclusão física de prestadores (hospitais/clínicas) do painel e da API backend para garantir a integridade de dados e os históricos de encaminhamento. Os prestadores agora devem ser inativados caso não estejam mais disponíveis para receber pacientes.

### Documentado
* **Fluxo de Encerramento (Baixas)**: Detalhamento no manual do operador e na arquitetura sobre como dar alta cirúrgica (`ALTA`), procedimento concluído (`PROCEDIMENTO_REALIZADO`), ou registrar óbito (`OBITO`) e desistência (`DESISTENCIA`) pelo fluxo de aprovação.

---

## [0.6.2-beta] — 2026-06-07
### Adicionado
* **Fluxo de Encaminhamento Hospitalar**: Implementado o elo entre o módulo de Prestadores e a Fila de Espera. O operador agora pode encaminhar um paciente com status `CONVOCADO_CONFIRMADO` diretamente para um hospital prestador cadastrado, alterando automaticamente o status para `INTERNADO` e gravando data de encaminhamento e data de internação.
* **Painel "Encaminhamento Hospitalar" no Drawer da Fila**: Nova seção visual (cor índigo) que aparece apenas para pacientes nos status `CONVOCADO_CONFIRMADO` ou `INTERNADO`, exibindo o hospital já vinculado (nome, CNES, datas) e o formulário de seleção de prestador.
* **Redirecionamento de Prestador**: Quando um paciente já está `INTERNADO` com um hospital vinculado, o painel permite selecionar um novo hospital e registrar a transferência.
* **Auditoria de Encaminhamento**: Cada encaminhamento gera um registro imutável em `audit_log` com a ação `ENCAMINHAR_PRESTADOR`, contendo os dados anteriores e novos.
* **Server Action `encaminharParaPrestador`**: Nova action em `fila/actions.ts` que grava `hospital_encaminhado_id`, `data_encaminhamento`, `data_internacao` e `status_interno = 'INTERNADO'` na tabela `fila_solicitacoes`.

### Corrigido
* **Gatilho de Preservação de Status (`trigger_preserve_status_interno`)**: Corrigido bug em que a restrição de status bloqueava as transições manuais ou automáticas feitas por operadores (como de `EM_CONVOCACAO` para `CONVOCADO_CONFIRMADO`), impedindo o encaminhamento hospitalar. O gatilho agora só é aplicado se `auth.uid() IS NULL` (durante importações).
* **Parâmetro "Omitir Fora do SISREG por Padrão"**: O filtro "Omitir Fora SISREG" da fila de espera agora consome e respeita a configuração global salva no banco de dados na carga inicial e ao limpar os filtros.
* **Tempo Limite para Limpeza de Fila**: A query da fila de espera agora consome dinamicamente o número de anos definido nas configurações gerais ao invés de manter o valor de 5 anos hardcoded.

---

## [0.6.1-beta] — 2026-06-06
### Alterado
* **Gerenciamento de Usuários (`/dashboard/usuarios`)**: Removida a opção de exclusão definitiva de contas. Substituída por botões de ação rápida de ativação e inativação (suspensão) de usuários diretamente na tabela.
* **Backend de Usuários**: Removida a action `deleteUserAction` para impedir exclusão de credenciais a nível de API.

---

## [0.6.0-beta] — 2026-06-05
### Adicionado
* **Painel Modelador de Mensagens (`/dashboard/mensagem`)**: CRUD de templates de mensagens de WhatsApp com seletor de tags e variáveis dinâmicas de clique único.
* **Preview Interativo e Editável de WhatsApp**: Caixa de texto com preview em tempo real com substituição de tags antes do envio direto do WhatsApp.
* **Mapeamento Completo de Variáveis**: `{nome_usuario}`, `{desc_sigtap}`, `{posicao_fila}`, `{data_execucao}`, `{nome_executante}` e `{chave_confirmacao}` no FilaClient e ConvocacaoClient.
* **Máscaras de Telefone Reativas**: Formatação reativa em tempo real `(XX) XXXXX-XXXX` para celulares nos formulários do drawer da Fila de Espera.
* **Filtro Operacional "Omitir Fora do SISREG"**: Checkbox que oculta por padrão os registros que não aparecem nas importações oficiais do SISREG, evitando poluição visual.
* **Alteração de Status Manual**: Dropdown na gaveta de detalhes do paciente para mudar diretamente a solicitação para *Internado*, *Realizado*, *Alta*, *Desistência* ou *Óbito* de forma auditada.
* **Pastas de Documentação (`doc/`)**: Manuais completos do Operador, Coordenador/Administrador e Arquitetura de Fluxos de Dados.

---

## [0.5.0] — 2026-06-04
### Adicionado
* **Portal do Cidadão (`/portal-cidadao`)**: Rota pública para busca de posições com mascaramento de dados (iniciais do nome, CPF e CNS parciais) em conformidade com a LGPD.
* **Módulo de Prestadores (`/dashboard/prestadores`)**: CRUD de hospitais credenciados com multiseleção de especialidades médicas.
* **Relatórios Gerenciais Avançados (`/dashboard/relatorios`)**: Indicadores consolidados de fila por procedimento, tempo de espera por risco e produtividade de convocações por operador.
* **Limpeza Operacional de Fila**: Filtro para isolar e inativar registros antigos (> 5 anos).

---

## [0.4.0] — 2026-06-02
### Adicionado
* **Triggers de Auditoria PostgreSQL (`audit_log`)**: Gatilhos imutáveis no banco de dados para rastrear `INSERT`, `UPDATE` e `DELETE` em pacientes, contatos, movimentações e solicitações.
* **Painel de Auditoria Geral (`/dashboard/auditoria`)**: Rota administrativa para consulta e comparação de diffs de alterações (chaves alteradas coloridas em vermelho/verde).
* **Painel de Movimentações de Fila (`/dashboard/movimentacoes`)**: Workflow completo para coordenadores deferirem (aprovarem) ou indeferirem propostas de mudança de posição e risco feitas por operadores.
* **Trigger de Execução de Movimentações**: Gatilho automático no Postgres que aplica a proposta na fila de espera após aprovação do coordenador.

---

## [0.3.0] — 2026-05-30
### Adicionado
* **Painel da Fila de Espera (`/dashboard/fila`)**: Listagem dinâmica de pacientes com paginação acoplada na URL e gaveta de visualização rápida de histórico de contatos e snapshots.
* **Lista de Convocação Diária (`/dashboard/convocacao`)**: Workspace focado para convocações de buscas ativas de status `EM_CONVOCACAO` e `SEM_CONTATO`.
* **Disparo de Mensagens de WhatsApp**: Integração com a API do WhatsApp Web utilizando dados básicos do paciente.

---

## [0.2.0] — 2026-05-25
### Adicionado
* **Motor de Importação Inteligente**: Parser robusto de CSV do SISREG com suporte a grandes arquivos (configuração de proxy de 50MB de body limit).
* **Mapeamento Relacional e Upserts**: Lógica em JavaScript/SQL que faz o cadastro cruzado de municípios, especialidades, procedimentos, CIDs e fila de solicitações.
* **Tratamento de Registros Ausentes**: Algoritmo otimizado no Postgres para desativar solicitações ausentes nos novos arquivos de importação de forma massiva.

---

## [0.1.0] — 2026-05-18
### Adicionado
* **Configuração Base**: Setup de projeto Next.js 16 + Tailwind CSS v4 + TypeScript.
* **Integração com Supabase**: Conexão cookie-based para autenticação e RLS com instâncias seguras.
* **Login e Perfis (RBAC)**: Tela de login e restrição de rotas por perfis de acesso.
* **Dashboard Shell**: Sidebar responsivo com seletor de tema Light/Dark.
