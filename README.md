# 🏥 SisFilaSus — Sistema de Gestão e Busca Ativa de Filas do SUS (Marabá)

O **SisFilaSus** é um sistema desenvolvido para a Secretaria Municipal de Saúde de Marabá com o objetivo de importar, auditar, monitorar e realizar a busca ativa de pacientes cadastrados na fila de cirurgias, consultas e exames do SUS (SISREG). Ele resolve problemas históricos de dados desatualizados, duplicados ou de difícil contato, fornecendo ferramentas reativas de convocação via WhatsApp e um controle rígido de segurança operacional.

---

## 📂 Índice de Documentação do Projeto
Toda a documentação operacional e técnica detalhada está organizada na pasta [docs/](docs/):

1. **[Documentação Geral do Sistema](docs/documentacao_sistema.md)**: Visão de escopo, arquitetura do projeto, fluxo de importação e stack tecnológica.
2. **[Central de Agendamentos & Cirurgias Eletivas](docs/central_agendamentos_e_cirurgias.md)**: Guia operacional do módulo de agendamento (Calendário, Kanban, Planilha e Fechamento SISREG), Portal do Prestador, Casamento Inteligente de Vagas e Banco de Aptos.
3. **[Manual do Coordenador e Administrador](docs/manual_coordenador.md)**: Guia de gerenciamento de usuários, upload de arquivos SISREG, triagem e aprovação de movimentações, cadastro dinâmico de status e visualização de logs de auditoria.
4. **[Manual do Operador e Regulador](docs/manual_operador.md)**: Instruções para uso da fila, filtros, drawers de detalhes, modelos de mensagem, convocação ativa via WhatsApp e agendamento instantâneo.
5. **[Arquitetura e Fluxo de Dados](docs/arquitetura_fluxos.md)**: Detalhamento técnico da modelagem de banco de dados, triggers Postgres de blindagem SISREG, views materializadas, políticas de RLS e diff de auditoria.
6. **[Guia Técnico: Comunicação & Autenticação SSR](docs/GUIA_INTEGRACAO_COMUNICACAO_E_AUTH.md)**: Guia completo sobre disparo por WhatsApp AstraCalls API (trabalho do 9º dígito), e-mail transacional SMTP e fluxo de recuperação de senha.
7. **[Base Cadastral e-SUS & Enriquecimento Territorial](docs/integracao_esus_base_territorial.md)**: Guia completo sobre a integração com o e-SUS Atenção Primária, importação em lote (pastas completas), campos estratégicos (UBS, Equipe ESF e Microárea) e enriquecimento automático na importação SISREG.

---

## 🌟 Novidades da Versão 0.10.0
* **Casamento Inteligente de Agendas**: Ao abrir os detalhes do paciente na Fila, o sistema pesquisa em tempo real vagas abertas para o procedimento/especialidade e permite o agendamento instantâneo com 1 clique durante o contato telefônico.
* **Banco de Aptos (Fila de Prontos)**: Pacientes contatados e aptos que ainda não possuem vaga aberta são promovidos ao status `APTO_AGUARDANDO_VAGA`. Na Central de Agendas, estes pacientes surgem automaticamente no topo da lista com selo prioritário (`⭐ Banco de Aptos`).
* **Cadastro Dinâmico de Status (`/dashboard/status`)**: Administradores agora personalizam os status internos, associando marcadores visuais entre 14 opções de cores, sem possibilidade de exclusão física para resguardar o histórico da fila.
* **Blindagem SISREG**: Trigger no Postgres que preserva anotações, status internos e reclassificações de risco locais mesmo após a importação de novas planilhas oficiais.
* **Performance Extrema & RLS Otimizado**: Índices parciais/compostos, materialized view e eliminação de recursão RLS, reduzindo tempos de resposta da fila de mais de 3s para menos de 350ms.
* **Feedback Anti-Travamento (ProcessingOverlay)**: Cronômetro em tempo real e mensagens dinâmicas para evitar a sensação de lentidão ou travamento durante filtros pesados ou importações volumosas.

---

---

## 🌐 Portal do Cidadão (Consulta Pública)
O portal público permite que o paciente acompanhe a sua posição na fila de espera sem a necessidade de autenticação (login administrativo), em estrito cumprimento da LGPD.

* **Endereços de Acesso**:
  * **Ambiente Local (Desenvolvimento)**: [http://localhost:3000/portal-cidadao](http://localhost:3000/portal-cidadao)
  * **Ambiente de Produção (Online)**: `https://[seu-dominio-de-producao]/portal-cidadao`
* **Como Funciona**: O cidadão acessa `/portal-cidadao`, insere o seu **CPF** ou **CNS** (Cartão SUS) e clica em consultar. O portal retorna a listagem de suas solicitações ativas, o respectivo procedimento, o prestador/hospital e a posição numérica.
* **Segurança e LGPD**: Todos os dados sensíveis do paciente são ocultados (exibindo apenas as iniciais do nome e os dígitos externos de CPF/CNS), omitindo completamente CIDs, diagnósticos ou nomes de mães.

---

## 🚀 Como Iniciar (Desenvolvimento)

### Pré-requisitos
* Node.js v20 ou superior.
* Instância do Supabase ativa com o schema configurado.

### Instalação e Execução
1. Instale as dependências do projeto:
   ```bash
   npm install
   ```
2. Crie e configure o arquivo `.env.local` na raiz com as chaves do Supabase:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-anon-key
   SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key
   ```
3. Execute o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```
4. Acesse a aplicação administrativa em [http://localhost:3000](http://localhost:3000) ou o Portal do Cidadão em [http://localhost:3000/portal-cidadao](http://localhost:3000/portal-cidadao).
