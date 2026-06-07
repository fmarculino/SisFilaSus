# 🛠️ Documentação Geral do Sistema — SisFilaSus

Esta é a documentação técnica oficial do **SisFilaSus**, contendo a descrição de todas as funcionalidades desenvolvidas, arquitetura do projeto, configuração do ambiente e fluxo de desenvolvimento.

---

## 🎯 1. Escopo e Objetivos do Projeto
O **SisFilaSus** é uma solução municipal desenvolvida para a Secretaria Municipal de Saúde de Marabá. O sistema tem como objetivo importar, auditar, monitorar e realizar a busca ativa de pacientes cadastrados na fila de cirurgias, consultas e exames do SUS (SISREG). Ele resolve problemas de dados desatualizados, duplicados ou ausentes, fornecendo ferramentas reativas de convocação via WhatsApp e um controle rígido de segurança operacional.

---

## ⚡ 2. Principais Funcionalidades Desenvolvidas

### 🔑 Autenticação e Controle de Acesso (RBAC)
* Sistema de login com interface premium, responsiva e suporte a temas (dark/light).
* Controle de acesso baseado em Roles (`SMS_ADMIN`, `COORDENADOR`, `OPERADOR_REGULACAO`, `AUXILIAR`, `UNIDADE_USER`).
* Middleware do Next.js para restrição de rotas e segurança a nível de API.

### 📥 Motor de Importação Inteligente (SISREG CSV)
* Parser robusto capaz de ler grandes arquivos CSV (> 50MB) de Internação (Cirurgias Eletivas) e Ambulatorial (Consultas/Exames).
* **Prevenção de Importação Duplicada**: Valida na API (`/api/importar`) se o arquivo (`nome_arquivo`) já foi importado anteriormente, retornando um erro impeditivo amigável com a data e hora do processamento original para evitar duplicidade de dados no banco.
* **Mecanismo de Diff Automatizado**: identifica registros novos, atualizados e ausentes.
* **Fallback de SIGTAP**: utiliza códigos internos de especialidades quando o SIGTAP vem vazio no SISREG (como exames laboratoriais).
* **Tratamento de Ausentes ("Fora do SISREG")**: marca automaticamente com o status `NAO_ENCONTRADO_SISREG` os pacientes que saíram das planilhas ativas do SISREG.

### 🔄 Motor de Sincronização e Gestão de Divergências SISREG
* **Preservação de Dados de Campo**: Utiliza o gatilho `trigger_preserve_status_interno` no PostgreSQL para impedir que novas importações de planilhas sobreponham o status operacional local já trabalhado pelos operadores.
* **Detecção Automática de Divergências**: Após cada lote de importação, o sistema cruza as bases e identifica conflitos críticos de status (ex: pacientes com óbito ou desistência confirmados no SisFilaSus, mas que continuam constando como ativos na fila do SISREG III).
* **Painel de Sincronização**: Tela exclusiva para operadores e coordenadores reconciliarem pendências críticas com o SISREG, fornecendo um fluxo de tarefas acionável e funcionalidade de check ("Sincronizado") com logs de auditoria.


### 📋 Fila de Espera Operacional
* Grid de visualização de pacientes com filtros por Risco, Procedimento, Especialidade (ex: Cardiologia, Urologia, Ginecologia), Modalidade (Consulta, Exame, Cirurgia, Demais), Eixo e Município.
* **Busca Otimizada e Inteligente**: O campo de busca remove automaticamente caracteres especiais (pontos, traços e espaços) e direciona a consulta no banco com base no número de dígitos informados: 15 dígitos para CNS, 11 dígitos para CPF, menos de 11 dígitos para Código de Solicitação, e texto geral para busca alfabética de nomes.
* **Otimização de RLS (Banco de Dados)**: Funções de verificação de permissões do RLS classificadas como `STABLE` para reduzir varreduras sequenciais repetitivas no banco, eliminando problemas de timeout (tempo de resposta reduzido de > 8 segundos para ~220ms).
* Checkbox para limpeza de cadastros antigos (> 5 anos) e checkbox para omitir registros fora do SISREG por padrão.
* Gaveta Lateral de Detalhes:
  * Dados pessoais e contatos do paciente.
  * Mascaramento reativo nos campos de WhatsApp e Celular.
  * Log de contatos anteriores e linha do tempo de evolução (snapshots de posições).
  * Painel de proposta de alteração de posição/risco clínico.
  * **Ação Direta de Status**: permite que reguladores atualizem manualmente o status para *Internado*, *Realizado*, *Alta*, *Desistência* ou *Óbito*.

### 💬 Busca Ativa de WhatsApp com Preview Editável
* Cadastro de Modelos de Mensagem (Templates) com suporte a tags dinâmicas como `{nome_usuario}`, `{desc_sigtap}`, `{posicao_fila}`, `{data_execucao}`, `{nome_executante}`, `{chave_confirmacao}`.
* Inserção de tags com clique único no modelador de templates.
* Caixa de texto editável com preview em tempo real antes do envio do WhatsApp.
* Preenchimento automatizado de logs de contatos após o disparo.

### 🔄 Workflow de Aprovação de Movimentações
* Painel centralizado para coordenadores revisarem e julgarem (Aprovar/Rejeitar) propostas de movimentações feitas por operadores.
* Aplicação transacionada e automática de alterações na fila de solicitações via gatilhos (triggers) do PostgreSQL.

### 🏥 Cadastro e Encaminhamento para Prestadores (Hospitais/Clínicas)
* CRUD de hospitais com CNES, nome e multiseleção de especialidades médicas atendidas, persistido em array nativo do Postgres.
* **Fluxo de Encaminhamento**: Na Fila de Espera, pacientes com status `CONVOCADO_CONFIRMADO`, `ENCAMINHADO` ou `INTERNADO` exibem o painel "Encaminhamento Hospitalar" no drawer lateral. O operador seleciona o hospital/clínica destino (apenas prestadores ativos são listados) e confirma o encaminhamento:
  * **Sem Data de Internação**: Grava o prestador e a data de encaminhamento, alterando o status para `ENCAMINHADO` (representa que foi enviado para a unidade, mas ainda aguarda comparecimento ou internação real).
  * **Com Data de Internação**: Grava o prestador, a data de encaminhamento e a data de internação, alterando o status diretamente para `INTERNADO`.
  * **Transição ENCAMINHADO ➜ INTERNADO**: Se o paciente já estiver `ENCAMINHADO`, o operador pode posteriormente preencher a data de internação para registrar que o paciente compareceu e foi de fato internado, o que atualiza o status para `INTERNADO`.
  * Registra a operação em `audit_log` com a ação `ENCAMINHAR_PRESTADOR`.
* **Redirecionamento**: Pacientes já `ENCAMINHADO` ou `INTERNADO` podem ter o hospital redirecionado a qualquer momento pelo painel.

### 📊 Relatórios Gerenciais Avançados
Painel analítico completo para suporte à decisão da gestão municipal, estruturado em abas dinâmicas:
* **Resumo Geral**: Visão consolidada dos principais KPIs municipais (total de regulados, espera média ponderada geral, contatos efetuados e taxa de sucesso).
* **Espera por Procedimento**: Listagem detalhada de todos os procedimentos da fila ativa. Possui busca textual, paginação rápida e ordenação de colunas reativa (crescente e decrescente, incluindo a ordenação por volume de pacientes na fila).
* **Espera por Risco**: Métricas agrupadas de acordo com a prioridade clínica dos pacientes na fila de regulação:
  * **Código do Risco (Padrão SISREG)**: Exibido no canto superior direito dos cards, correspondendo à numeração oficial do SUS:
    * `Código: 0` = Emergência
    * `Código: 1` = Urgência
    * `Código: 2` = Prioridade
    * `Código: 3` = Eletivo
    * `Código: 4` = Especial
  * **Média de Espera do Risco**: Representa o tempo médio geral que todos os pacientes ativos daquela classificação específica estão aguardando na fila. O cálculo é realizado em tempo real a partir da diferença em dias entre a data de solicitação e a data atual.
* **Produtividade da Equipe**: Acompanhamento individual do desempenho de cada operador regulador, detalhando volume total de convocações, taxas de confirmação, recusas e insucesso de contato.

### 👥 Cadastro de Usuários (Gerenciamento de Contas)
* Painel exclusivo para coordenadores criarem e configurarem contas de operadores, com vínculo obrigatório de CNES para o perfil de Unidade.

### 🔍 Auditoria Geral de Sistema
* Rastreamento imutável de todas as ações de escrita (`INSERT`, `UPDATE`, `DELETE`) de Pacientes, Solicitações, Contatos e Usuários.
* **Foco em Ações Humanas**: O gatilho SQL `process_audit_log` foi otimizado para registrar apenas ações executadas por usuários humanos autenticados (`auth.uid() IS NOT NULL`). Operações automatizadas, scripts e a importação em lote de CSVs do SISREG são ignorados para evitar o inchaço e a lentidão do banco de dados.
* Tela de visualização com comparador de Diffs que destaca chaves alteradas.

### 🌐 Portal do Cidadão (Público)
O portal público permite que o paciente consulte sua posição na fila de espera de forma transparente e segura, sem necessidade de login administrativo.

* **Endereços de Acesso**:
  * **Ambiente de Desenvolvimento (Local)**: [http://localhost:3000/portal-cidadao](http://localhost:3000/portal-cidadao)
  * **Ambiente de Produção (Online)**: `https://[seu-dominio-de-producao]/portal-cidadao`
* **Como Funciona**: O cidadão acessa a rota pública `/portal-cidadao`, insere o seu **CPF** ou **CNS** (Cartão Nacional de Saúde) e clica em pesquisar. O sistema busca os registros ativos vinculados ao documento informado e lista os procedimentos solicitados, a unidade de saúde responsável e a posição do paciente.
* **Segurança e LGPD**: Todos os dados em tela são mascarados de forma reativa (exibindo apenas as iniciais do nome do paciente e partes ocultas do CPF/CNS). Informações clínicas sensíveis como CIDs, diagnósticos e nomes de mães são totalmente omitidas do portal público para preservar o sigilo das informações de saúde em conformidade com a Lei Geral de Proteção de Dados (LGPD).

---

## 🏗️ 3. Tecnologias Utilizadas e Arquitetura do Projeto

* **Framework**: Next.js 16 (App Router) com Turbopack.
* **Linguagem**: TypeScript.
* **Banco de Dados & Auth**: Supabase (PostgreSQL, Auth e Row Level Security).
* **Estilização**: CSS Vanilla com Tailwind CSS v4 para layouts premium e responsivos.
* **Ícones**: Lucide React.
* **Segurança**: Políticas RLS (Row Level Security) ativas no banco de dados e criptografia de senhas nativa do Supabase Auth.

### 📁 Estrutura de Diretórios:
```
SisFilaSus/
├── doc/                        # Manuais e documentações técnicas
├── public/                     # Assets estáticos
├── scratch/                    # Scripts de migração, views e triggers SQL
├── src/
│   ├── app/                    # Rotas, APIs e páginas da aplicação
│   ├── components/             # Componentes de layout e UI
│   ├── lib/                    # Classes utilitárias e parses de dados
│   ├── utils/                  # Conexão e middlewares do Supabase
│   └── proxy.ts                # Arquivo de proxy Next.js
└── next.config.ts              # Configurações do servidor Next.js
```

---

## ⚙️ 4. Configuração do Ambiente e Instalação

### Pré-requisitos:
* Node.js v20 ou superior.
* Conta ou instância do Supabase com o schema aplicado.

### Instalação:
1. Clone o repositório.
2. Instale as dependências:
   ```bash
   npm install
   ```
3. Crie o arquivo `.env.local` na raiz com as chaves de acesso:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://sua-url-supabase.com
   NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-anon-key
   SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key
   ```
4. Inicie o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```

---

## 🚀 5. Deploy em Produção
* **Build**: Execute `npm run build` para testar e gerar o bundle de produção otimizado.
* **Ambiente**: O SisFilaSus está configurado para deploy em VPS própria via Coolify/Docker ou plataformas serverless como Vercel/Netlify.

---

## 📋 6. Changelog

### v0.6.2 — Encaminhamento Hospitalar (2026-06-07)

#### 🆕 Novidades

**Fluxo de Encaminhamento para Prestadores:**
- Novo painel **"Encaminhamento Hospitalar"** no drawer lateral da Fila de Espera, visível exclusivamente para pacientes nos status `CONVOCADO_CONFIRMADO` ou `INTERNADO`.
- Dropdown com lista de todos os prestadores ativos (nome + CNES), carregado dinamicamente na abertura do drawer.
- Campo opcional de **Data de Internação** para registro da data prevista ou real.
- Botão **"Confirmar Encaminhamento"** que executa a server action, grava o prestador vinculado e muda o status para `INTERNADO`.
- Ao reabrir o drawer de um paciente já internado, o painel exibe o hospital vinculado (nome, CNES, data de encaminhamento e data de internação) e oferece a opção de redirecionamento.
- Aviso contextual quando não há prestadores ativos cadastrados, com orientação para o módulo de cadastro.

**Server Action `encaminharParaPrestador` (`fila/actions.ts`):**
- Grava `hospital_encaminhado_id`, `data_encaminhamento` e opcionalmente `data_internacao`.
- Força `status_interno = 'INTERNADO'` atomicamente na mesma operação.
- Registra auditoria imutável em `audit_log` com ação `ENCAMINHAR_PRESTADOR`.

**`fetchSolicitacaoExtraData` enriquecida:**
- Agora também retorna `prestadores[]` (prestadores ativos), `hospitalEncaminhado`, `dataEncaminhamento` e `dataInternacao`, eliminando round-trips extras ao banco.

### v0.6.1 — Melhorias de Dashboard, Filtros e Segurança (2026-06-07)

#### 🆕 Novidades

**Dashboard — 4 novos cards de categorização por modalidade:**
- Card **Aguardando Consultas** (`modalidade_fila = 0`)
- Card **Aguardando Exames** (`modalidade_fila = 1`)
- Card **Aguardando Cirurgias** (`modalidade_fila = 2`)
- Card **Demais Procedimentos** (`modalidade_fila = 3` ou `NULL`)
- View `vw_dashboard_kpis` atualizada no banco de dados para suportar os novos contadores.

**Dashboard — Top 10 procedimentos:**
- View `vw_dashboard_top_procedimentos` atualizada com `LIMIT 10` (era 5).

**Fila de Espera — Filtros avançados:**
- Novo dropdown de **Especialidade** (baseado no `grupo_descricao` dos procedimentos cadastrados — dinâmico, expandido automaticamente conforme novos arquivos do SISREG são importados).
- Novo dropdown de **Modalidade** (Consulta, Exame, Cirurgia, Demais Procedimentos).
- Novo dropdown de **Município de Origem** nos filtros de busca.

**Identificação de origem dos Status Internos:**
- O seletor de Status Interno agora exibe o prefixo `[SISREG]` ou `[SisFilaSus]` antes de cada opção, facilitando a compreensão da origem de cada estado operacional.

#### 🐛 Correções

**Fichas de Pacientes — Correção de Municípios de Origem:**
- Corrigido bug no `import-parser.ts` onde o campo `municipio_origem` não era gravado na tabela de pacientes no momento da importação.
- Script de correção executado no banco de dados corrigiu **982 fichas de pacientes** que estavam com município nulo ou incorreto.
- O filtro de municípios na tela de Fichas de Pacientes agora lista todos os municípios reais (ex: Abel Figueiredo, São Domingos do Araguaia, etc.).

**Fichas de Pacientes — Remoção do botão "Cadastrar Paciente":**
- Removido o botão de cadastro manual, pois o SisFilaSus gerencia dados provenientes do SISREG e cadastros manuais não teriam validade regulatória.

#### 🔒 Segurança (Scripts SQL disponíveis para execução no Supabase)

**Views com `security_invoker`:**
- Todas as 8 views do sistema (`vw_dashboard_kpis`, `vw_dashboard_top_procedimentos`, `vw_dashboard_risco`, `vw_dashboard_evolucao`, `vw_relatorio_espera_procedimento`, `vw_relatorio_espera_risco`, `vw_relatorio_produtividade_operador`, `vw_relatorio_status_distribuicao`) foram atualizadas para usar `WITH (security_invoker = true)`, garantindo que as consultas respeitem as políticas de RLS do usuário autenticado.
- Script de correção: `scratch/fix_security_invoker_views.sql`

**Funções com `search_path` explícito:**
- As 7 funções do banco (`apply_fila_movement`, `get_user_role`, `get_user_cnes_vinculo`, `preserve_status_interno`, `handle_new_user`, `update_updated_at_column`, `process_audit_log`) receberam `SET search_path = public, pg_temp` para mitigar o risco de *search_path hijacking*.
- Script de correção: `scratch/fix_security_functions_search_path.sql`

