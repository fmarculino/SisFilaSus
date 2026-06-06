# 📝 CHANGELOG — SisFilaSus

Todas as alterações notáveis, novas funcionalidades e correções deste projeto serão documentadas neste arquivo. O formato é baseado no [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/) e este projeto adota o [Versionamento Semântico (SemVer)](https://semver.org/lang/pt-BR/).

---

## [0.6.0] — 2026-06-05 (Atual)
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
