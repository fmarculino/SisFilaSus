# 📝 CHANGELOG — SisFilaSus

Todas as alterações notáveis, novas funcionalidades e correções deste projeto serão documentadas neste arquivo. O formato é baseado no [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/) e este projeto adota o [Versionamento Semântico (SemVer)](https://semver.org/lang/pt-BR/).

---

## [0.8.0] — 2026-08-29 (Atual)
### Adicionado
* **Central de Agendamentos & Cirurgias Eletivas (`/dashboard/agendas`)**:
  * Novo módulo operacional com suporte a **Multivisão**:
    * 📅 **Calendário Mensal/Semanal**: Indicadores visuais de lotação de vagas por dia e médico em tempo real.
    * 📊 **Kanban Cirúrgico (Funil do Paciente)**: Acompanhamento de fluxo em 6 colunas desde a Consulta Pré-Op até a Cirurgia Realizada ou Intercorrências.
    * 📋 **Visão Planilha Geral**: Tabela rápida no estilo Google Sheets com barras de ocupação.
    * 📑 **Fechamento & Devolutiva SISREG**: Painel para conferência de desfechos clínicos com **Exportação para CSV (Excel)** e marcação em lote de alimentados.
  * **Alocação Inteligente com 1 Clique**: Puxa automaticamente os pacientes prioritários da fila de espera que necessitam daquela especialidade, ordenados por Classificação de Risco e posição na fila.
  * **Acompanhamento Clínico Completo**: Check-in na recepção, parecer de risco cardiológico/anestésico, data agendada da cirurgia e confirmação de realização.
* **Portal do Prestador de Serviços & Intercorrências Clínicas**:
  * Criado o perfil de usuário **`PRESTADOR_USER`** vinculado diretamente à clínica/hospital conveniado (`hospital_id`).
  * Autonomia para clínicas e hospitais ofertarem suas agendas com **Horário de Início e Término**, cota de vagas e orientações de sala.
  * **Modal de Registro de Intercorrências Clínicas**: Categorização padronizada (risco cardiológico não autorizou, contraindicação anestésica, falta de UTI, absenteísmo, suspensão por jejum) com justificativa médica detalhada.
* **Sistema de Múltiplos Telefones por Paciente (`pacientes_telefones`)**:
  * Suporte a N telefones por paciente com ordenação por prioridade (⭐ número principal).
  * Rastreamento de status de cada telefone (🟢 Ativo, 🔴 Inativo, 🟠 Trocou de Dono, 🟡 Perdido, ⚫ Desligado, 🔵 Não Existe, 🟣 Não Atende).
  * Classificação de tipos (`CELULAR_WHATSAPP`, `CELULAR`, `FIXO`, `RECADO` com nome do contato e parentesco).
  * Componentes reutilizáveis `PhoneBadge.tsx` e `PhoneManager.tsx` integrados em todas as telas (Pacientes, Fila, Convocações e Agendamentos).
  * Manutenção de retrocompatibilidade com campos legados `telefone_1` e `telefone_2`.

---

## [0.7.0] — 2026-08-03
### Adicionado
* **Fluxo de Recuperação de Senha (Supabase Auth SSR)**:
  * Ativada a redefinição de palavra-chave diretamente pela tela de entrada através da rota `/esqueci-a-senha`.
  * Implementado o handler de callback `/auth/callback` para processar a troca do token de recuperação por uma sessão autenticada.
  * Tela de redefinição de senha `/auth/update-password` integrada ao fluxo com validação e feedback amigável.
* **Motor de Comunicação Híbrido (`src/lib/communication.ts`)**:
  * **E-mail Transacional (SMTP Nodemailer)**: Suporte para disparo de e-mails de notificação e testes usando infraestrutura SMTP com resolução de credenciais priorizando banco de dados com fallback em variáveis de ambiente.
  * **API WhatsApp AstraCalls**: Integração com a API REST do AstraCalls (`POST /message/text`) com algoritmo de normalização automática do 9º dígito para DDDs do Brasil $\ge 31$ (disparando primeiro em 12 dígitos e fallback de 13 dígitos).
  * **Envio Direto de Mensagens**: Adicionada opção de disparo em 1 clique ("Enviar API Direto") nos módulos de **Convocação de Fila** e **Fila de Espera**, gerando automaticamente o histórico de contatos na tabela `contatos`.
  * **Fallback Manual**: Botão de envio via WhatsApp Web preservado como contingência 100% à prova de falhas.
* **Gerenciamento de Comunicação no Painel de Configurações (`/dashboard/configuracoes`)**:
  * Adicionadas as abas **E-mail Transacional (SMTP)** e **WhatsApp (AstraCalls)** para gestão de credenciais e alternância de status ativo/inativo.
  * Adicionados botões para **Testar Conexão SMTP** e **Testar Disparo WhatsApp API** em tempo real com modal de verificação.

* **Sistema Global de Modais e Alertas (`SystemModalProvider`)**:
  * Substituídos 100% dos popups nativos do navegador (`alert` e `confirm`) por modais nativos do sistema em React (`src/components/ui/SystemModal.tsx`).
  * Design Bento consistente com o layout do sistema, animações fluidas, suporte a dark/light mode, ícones de status (`success`, `error`, `warning`, `info`) e promessas assíncronas para confirmações.
  * Aplicado em todos os módulos operacionais: Fila de Espera, Convocação, Usuários, Prestadores, Pacientes, Modelos de Mensagens, Movimentações, Sincronização e Configurações.

---

## [0.6.5-beta] — 2026-06-10
### Adicionado
* **Filtro por Unidade Solicitante**:
  * Adicionado suporte para filtrar a Fila de Espera (`/dashboard/fila`) pela unidade solicitante (UBS, Hospitais, Postinhos).
  * Exibido novo dropdown dinâmico "Unidade Solicitante" no painel de filtros, alimentado pela tabela `unidades_solicitantes`.
  * Filtro integrado à query do Supabase usando `cnes_solicitante`.

---

## [0.6.4-beta] — 2026-06-08
### Adicionado
* **Componente Portal (`Portal.tsx`)**: Criado componente para renderização de gavetas e modais no `document.body`, resolvendo problemas de posicionamento relativos a elementos com transformações CSS (como o scroll e animações do layout).

### Alterado
* **Painel de Sincronização (Divergências SISREG)**:
  * Dividida a categoria de pacientes com divergência ativa no SISREG entre **Encaminhados Ativos** (status local `ENCAMINHADO`) e **Internados Ativos** (status local `INTERNADO`).
  * Adicionado novo card de indicador para **Encaminhados Ativos** (cor `sky`/azul claro com ícone `ArrowUpRight`) na grid, expandindo-a para 5 colunas.
  * Atualizados os badges da tabela de divergências e o filtro de busca no dropdown para suportar as duas categorias de forma independente.
* **Gavetas de Todo o Sistema (Portais)**: Atualizada a renderização de modais/drawers nas telas de **Fila de Espera**, **Cadastro de Pacientes**, **Prestadores**, **Mensagens**, **Usuários** e **Auditoria** usando o componente `Portal`, garantindo que abram fixos e visíveis na área de foco do operador, independente do scroll.

### Corrigido
* **Filtro "Omitir Fora do SISREG"**: Corrigido bug em que o flag ativado manualmente na tela da fila de espera era ignorado se a opção estivesse definida como "Não" nas configurações gerais. O parâmetro `omitirForaSisreg` agora é propagado de forma explícita na URL (`true` ou `false`).

---

## [0.6.3-beta] — 2026-06-07
### Adicionado
* **Status `ENCAMINHADO` (Encaminhado Hospital/Clínica)**: Criado novo status para diferenciar pacientes encaminhados para prestadores mas sem data de internação definida.
* **Fluxo de Encaminhamento Dinâmico**:
  * Se a data de internação não for preenchida no encaminhamento, o status do paciente passa a ser `ENCAMINHADO`.
  * Se for preenchida, passa diretamente a `INTERNADO`.
  * Possibilidade de atualizar um paciente de `ENCAMINHADO` para `INTERNADO` preenchendo a data de internação no drawer.
* **Badge e Seletores na UI**: Adicionado badge de cor ciano/sky para `ENCAMINHADO`, adicionado o status no seletor manual, nos filtros de pesquisa de status da Fila de Espera, no Portal do Cidadão e nos Relatórios Gerenciais.
* **Busca Inteligente por Múltiplos Termos (Fila de Espera e Cadastro de Pacientes)**: Implementado suporte a buscas compostas por termos separados por espaços (ex: buscar "FERNANDO GUIMARAES" para achar "FERNANDO MARCULINO GUIMARAES JUNIOR"). O sistema agora quebra os termos e realiza buscas do tipo `AND` nativas no banco de dados, sem necessidade de caracteres especiais.

### Alterado
* **Rede de Prestadores (Segurança de Dados)**: Removida a opção de exclusão física de prestadores (hospitais/clínicas) do painel e da API backend para garantir a integridade de dados e os históricos de encaminhamento. Os prestadores agora devem ser inativados caso não estejam mais disponíveis para receber pacientes.

### Documentado
* **Fluxo de Encerramento (Baixas)**: Detalhamento no manual do operador e na arquitetura sobre como dar alta cirúrgica (`ALTA`), procedimento concluído (`PROCEDIMENTO_REALIZADO`), ou registrar óbito (`OBITO`) e desistência (`DESISTENCIA`) pelo fluxo de aprovação.

### Corrigido
* **Regras de Atualização do Sisreg (Preservação de Status Operacionais)**: Corrigido bug em que pacientes com status avançados (como `ENCAMINHADO`, `INTERNADO`, etc.) eram indevidamente marcados como `NAO_ENCONTRADO_SISREG` ("Fora do SISREG") caso não constassem nos novos arquivos CSV importados do SISREG. Agora, o importador e a trigger do banco de dados protegem esses registros, permitindo que a marcação de ausência ocorra apenas para pacientes em status iniciais de fila (`NA_FILA`, `EM_CONVOCACAO`, `SEM_CONTATO`).

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
