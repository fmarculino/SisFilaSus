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
* Mecanismo de **Diff Automatizado**: identifica registros novos, atualizados e ausentes.
* **Fallback de SIGTAP**: utiliza códigos internos de especialidades quando o SIGTAP vem vazio no SISREG (como exames laboratoriais).
* **Tratamento de Ausentes ("Fora do SISREG")**: marca automaticamente com o status `NAO_ENCONTRADO_SISREG` os pacientes que saíram das planilhas ativas do SISREG.

### 📋 Fila de Espera Operacional
* Grid de visualização de pacientes com filtros por Risco, Procedimento, Eixo e Município.
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

### 🏥 Cadastro de Prestadores (Hospitais)
* CRUD de hospitais com CNES, nome e multiseleção de especialidades médicas atendidas, persistido em array nativo do Postgres.

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
