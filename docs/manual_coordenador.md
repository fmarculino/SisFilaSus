# 👑 Manual do Coordenador e Administrador — SisFilaSus

Este manual orienta os usuários com funções de **Coordenador da Regulação** e **SMS Admin** (Gestor Municipal) no uso das ferramentas de gestão, auditoria e controle do **SisFilaSus**.

---

## 🔒 1. Perfis de Acesso (RBAC) e Permissões
O SisFilaSus possui controle de acessos rígido. As permissões são distribuídas da seguinte forma:

* **SMS_ADMIN**: Acesso total a todas as telas, incluindo exclusão física de registros (pacientes, usuários, prestadores) e auditoria de sistema.
* **COORDENADOR**: Acesso gerencial completo, importação de planilhas, aprovação de movimentações de fila e gerenciamento de usuários. (Não possui permissão de exclusão de pacientes).
* **OPERADOR_REGULACAO / AUXILIAR**: Uso restrito à Fila de Espera, Busca Ativa/WhatsApp e propostas de movimentações de fila. Não visualiza a tela de Auditoria, Prestadores ou Gerenciamento de Usuários.
* **UNIDADE_USER**: Visualiza apenas os pacientes originários de sua própria Unidade Solicitante (vinculado ao CNES da Unidade).

---

## 📥 2. Motor de Importação (SISREG CSV)
A tela **Importação** (`/dashboard/importacao`) permite atualizar a base municipal em lote a partir das exportações oficiais do SISREG.

### 📋 Fluxo de Importação Recomendado:
1. **Extração no SISREG**: Realize a exportação das filas de solicitação (Ambulatorial ou Internação) em formato CSV no portal do SISREG.
2. **Upload no SisFilaSus**: Arraste o arquivo CSV ou selecione-o na interface. O processamento é assíncrono e suporta arquivos grandes (de até 50MB).
3. **Análise do Diff**: Assim que concluída, a tela exibirá as métricas do lote:
   * **Total de Registros**: Quantidade de solicitações lidas no arquivo.
   * **Registros Novos**: Pacientes ou solicitações inseridos na base pela primeira vez.
   * **Registros Atualizados**: Cadastros cujas posições de fila, riscos ou dados clínicos foram atualizados.
   * **Registros Ausentes (Fora do SISREG)**: Solicitações que estavam na fila ativa do SisFilaSus anteriormente, mas não constam na nova exportação do SISREG. Eles são automaticamente desativados e marcados como `NAO_ENCONTRADO_SISREG` (sinalizando que a solicitação foi concluída ou cancelada diretamente no SISREG).

> [!WARNING]
> Certifique-se de importar arquivos no formato de codificação correto (UTF-8 ou ISO-8859-1 com delimitador de ponto e vírgula `;`). O motor de importação sanitiza automaticamente cabeçalhos duplicados e resolve códigos de SIGTAP ausentes (utilizando o código interno da especialidade como fallback).

---

## 🔄 3. Gestão de Movimentações (Workflow de Aprovação)
Para manter a lisura da fila, alterações de posição e de risco clínico passam por um sistema de aprovação de dois níveis (Proposta -> Julgamento).

### 🚀 Como Funciona a Triagem:
1. Um operador propõe uma movimentação na gaveta do paciente (ex: mudar o risco de Eletivo para Urgência baseado em um laudo anexado).
2. O coordenador acessa a tela **Movimentações** (`/dashboard/movimentacoes`).
3. Na aba **Pendentes**, ele analisa a ficha:
   * Confirma a justificativa clínica/operacional escrita pelo operador.
   * Compara as mudanças (Ex: *Risco 3 ➔ Risco 1*).
4. O coordenador clica em **Aprovar** (o banco de dados executa a mudança na solicitação automaticamente e registra no log) ou em **Negar Proposta** (mantendo o paciente na posição original).

---

## 👥 4. Cadastro de Usuários (Controle de Acesso)
Na tela **Usuários** (`/dashboard/usuarios`), coordenadores e admins gerenciam quem acessa a plataforma:
* **Criar Usuário**: Insira Nome, E-mail corporativo, escolha o perfil de acesso e defina uma senha inicial.
* **Vínculo com Unidade**: Se escolher a função `UNIDADE_USER` (Visualizador de Unidade), você obrigatoriamente deve selecionar a unidade de saúde vinculada para que ele visualize apenas os pacientes de lá.
* **Suspender Contas**: Altere o status do usuário para *Inativo* para revogar seu acesso imediatamente.

---

## 🏥 5. Cadastro de Prestadores (Hospitais)
Em **Prestadores** (`/dashboard/prestadores`), você gerencia a rede municipal credenciada.
* Cadastre o CNES e o Nome do Hospital.
* Vincule as Especialidades atendidas por aquele prestador (ex: *Ortopedia*, *Ginecologia*).
* Isso permite associar o paciente ao hospital de referência quando ele for encaminhado para a cirurgia/procedimento.

---

## 📊 6. Relatórios Gerenciais Avançados
Acesse `/dashboard/relatorios` para obter relatórios analíticos em tempo real da regulação:

* **Resumo Geral**: Apresenta os KPIs municipais de forma consolidada e gráficos rápidos das filas.
* **Espera por Procedimento**: Exibe a lista detalhada de procedimentos.
  * **Interatividade**: É possível clicar no cabeçalho de qualquer coluna (Código, Procedimento, Pacientes na Fila, Espera Média) para ordenar a listagem de forma crescente ou decrescente.
  * **Paginação e Busca**: Use a barra de pesquisa superior para filtrar e a paginação na barra inferior para navegar rapidamente pelos resultados.
* **Espera por Risco**: Exibe cartões estatísticos agrupados de acordo com a prioridade clínica cadastrada no SISREG.
  * **Códigos dos Cards (SISREG)**: O identificador numérico no canto superior direito representa o código do SISREG (`Código: 0` = Emergência, `Código: 1` = Urgência, `Código: 2` = Prioridade, `Código: 3` = Eletivo, `Código: 4` = Especial).
  * **Média de Espera do Risco**: Representa o tempo médio de espera (diferença entre data de solicitação e a data atual) de todos os pacientes ativos daquela categoria na fila.
* **Produtividade da Equipe**: Acompanhe o volume de convocações de busca ativa feitas e a taxa de confirmação obtida individualmente por cada operador regulador.

---

## 🔍 7. Auditoria Geral do Sistema
A tela **Auditoria** (`/dashboard/auditoria`) (restrita a administradores e coordenação) rastreia tudo o que ocorre:
* O sistema grava registros imutáveis de cada inserção, deleção ou edição (`INSERT`, `UPDATE`, `DELETE`) de Pacientes, Solicitações, Contatos e Usuários.
* Você pode filtrar por período, por tabela, por operador ou buscar um código de solicitação específico.
* Clique em "Visualizar Diff" para comparar lado a lado o estado antigo dos dados em vermelho e as novas alterações em verde.

---

## 🌐 8. Portal do Cidadão (Página Pública)
O SisFilaSus disponibiliza um portal público e de livre acesso para que os cidadãos possam acompanhar a sua própria posição na fila de espera sem precisar ligar ou comparecer à Secretaria de Saúde.

* **Rota do Portal**: `/portal-cidadao`
* **Endereço Padrão**: `https://[seu-dominio-de-producao]/portal-cidadao`
* **Segurança e LGPD**: A consulta exige apenas o CPF ou o CNS. O sistema mascara de forma irreversível os dados pessoais na tela (exibindo apenas as iniciais do nome) e omite quaisquer diagnósticos, CIDs ou informações sensíveis de saúde, garantindo total conformidade legal.
