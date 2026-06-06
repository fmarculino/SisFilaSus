# 🏥 SisFilaSus — Sistema de Gestão e Busca Ativa de Filas do SUS (Marabá)

O **SisFilaSus** é um sistema desenvolvido para a Secretaria Municipal de Saúde de Marabá com o objetivo de importar, auditar, monitorar e realizar a busca ativa de pacientes cadastrados na fila de cirurgias, consultas e exames do SUS (SISREG). Ele resolve problemas históricos de dados desatualizados, duplicados ou de difícil contato, fornecendo ferramentas reativas de convocação via WhatsApp e um controle rígido de segurança operacional.

---

## 📂 Índice de Documentação do Projeto
Toda a documentação operacional e técnica detalhada está organizada na pasta [doc/](file:///c:/Users/Cliente/Projetos/SisFilaSus/doc/):

1. **[Documentação Geral do Sistema](file:///c:/Users/Cliente/Projetos/SisFilaSus/doc/documentacao_sistema.md)**: Visão de escopo, arquitetura do projeto, fluxo de importação e stack tecnológica.
2. **[Manual do Coordenador e Administrador](file:///c:/Users/Cliente/Projetos/SisFilaSus/doc/manual_coordenador.md)**: Guia de gerenciamento de usuários, upload de arquivos SISREG, triagem e aprovação de movimentações e visualização de logs de auditoria.
3. **[Manual do Operador e Regulador](file:///c:/Users/Cliente/Projetos/SisFilaSus/doc/manual_operador.md)**: Instruções para uso da fila, filtros, drawers de detalhes, modelos de mensagem e convocação ativa via WhatsApp.
4. **[Arquitetura e Fluxo de Dados](file:///c:/Users/Cliente/Projetos/SisFilaSus/doc/arquitetura_fluxos.md)**: Detalhamento técnico da modelagem de banco de dados, triggers Postgres, views, políticas de RLS e diff de auditoria.

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
