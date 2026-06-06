# 🏗️ Arquitetura de Fluxos e Dados — SisFilaSus

Este documento detalha o design técnico, modelagem do banco de dados, ciclo de vida das solicitações e as regras de automação (triggers) adotadas no **SisFilaSus**.

---

## 📊 1. Modelagem do Banco de Dados (PostgreSQL)

O banco de dados está isolado e estruturado nas seguintes tabelas principais:

```mermaid
erDiagram
    users {
        uuid id PK
        text email
        text nome
        text role
        text cnes_vinculo
        boolean active
    }
    pacientes {
        uuid id PK
        varchar cns_usuario UK
        varchar cpf_usuario
        varchar nome_usuario
        date data_nascimento
        varchar sexo
        varchar nome_mae
        varchar telefone_1
        varchar telefone_2
        text endereco
        varchar municipio_origem
    }
    municipios {
        varchar codigo_ibge PK
        varchar nome
        varchar central_reguladora_nome
    }
    unidades_solicitantes {
        varchar cnes PK
        varchar nome
        varchar municipio_ibge FK
        varchar tipo
    }
    procedimentos {
        varchar cod_sigtap PK
        text desc_sigtap
        int modalidade_fila
        varchar grupo_codigo
    }
    cids {
        varchar codigo_cid PK
        text desc_cid
    }
    fila_solicitacoes {
        bigint cod_solicitacao PK
        uuid paciente_id FK
        varchar cod_sigtap FK
        varchar codigo_cid FK
        varchar cnes_solicitante FK
        varchar municipio_origem_ibge FK
        timestamp data_solicitacao
        int classificacao_risco
        int posicao_fila
        varchar status_interno
        timestamp data_execucao
        varchar chave_confirmacao
        varchar nome_executante
        uuid ultima_importacao_id FK
        boolean active
    }
    importacoes {
        uuid id PK
        text nome_arquivo
        timestamp data_exportacao_sisreg
        int total_registros
        int registros_novos
        int registros_atualizados
        int registros_ausentes
        uuid importado_por FK
    }
    fila_snapshots {
        uuid id PK
        bigint cod_solicitacao FK
        uuid importacao_id FK
        int posicao_fila
        int classificacao_risco
    }
    contatos {
        uuid id PK
        bigint cod_solicitacao FK
        uuid operador_id FK
        varchar tipo
        varchar resultado
        varchar telefone_usado
        text observacoes
    }
    movimentacoes_fila {
        uuid id PK
        bigint cod_solicitacao FK
        uuid solicitada_por FK
        uuid aprovada_por FK
        varchar tipo
        text justificativa
        varchar status
        jsonb valor_anterior
        jsonb valor_novo
    }

    fila_solicitacoes ||--|| pacientes : "pertence a"
    fila_solicitacoes ||--|| procedimentos : "procedimento"
    fila_solicitacoes ||--o| cids : "cid"
    fila_solicitacoes ||--o| municipios : "origem"
    fila_solicitacoes ||--o| unidades_solicitantes : "solicitada em"
    fila_solicitacoes ||--o| importacoes : "carregada em"
    fila_snapshots ||--|| fila_solicitacoes : "histórico de"
    contatos ||--|| fila_solicitacoes : "registro de contato"
    movimentacoes_fila ||--|| fila_solicitacoes : "proposta de"
```

---

## 🔄 2. Ciclo de Vida do Status Interno (`status_interno`)

A coluna `status_interno` controla o fluxo operacional de cada solicitação. As transições ocorrem de acordo com as ações dos operadores ou triggers automáticos do banco:

```mermaid
stateDiagram-v2
    [*] --> NA_FILA : Nova Importação (Internação)
    [*] --> CONVOCADO_CONFIRMADO : Nova Importação (Ambulatorial)
    
    NA_FILA --> EM_CONVOCACAO : WhatsApp / Ligação Iniciada
    SEM_CONTATO --> EM_CONVOCACAO : Retentativa de Contato

    EM_CONVOCACAO --> CONVOCADO_CONFIRMADO : Contato com Sucesso (Confirmou)
    EM_CONVOCACAO --> CONVOCADO_RECUSOU : Contato com Sucesso (Recusou/Particular)
    EM_CONVOCACAO --> SEM_CONTATO : Sem Resposta / Caixa Postal / Número Inválido

    CONVOCADO_CONFIRMADO --> INTERNADO : Encaminhado para Hospital e Internado
    INTERNADO --> PROCEDIMENTO_REALIZADO : Cirurgia Executada
    PROCEDIMENTO_REALIZADO --> ALTA : Paciente Recebe Alta Médica

    NA_FILA --> DESISTENCIA : Proposta de Desistência Aprovada
    NA_FILA --> OBITO : Proposta de Óbito Aprovada
    
    NA_FILA --> NAO_ENCONTRADO_SISREG : Ausente na Nova Importação do SISREG
    EM_CONVOCACAO --> NAO_ENCONTRADO_SISREG : Ausente na Nova Importação do SISREG
```

### 📋 Detalhamento dos Status:
* **`NA_FILA`**: O paciente está aguardando passivamente na fila oficial do SISREG.
* **`EM_CONVOCACAO`**: O operador iniciou o processo de convocação ativa (chama no WhatsApp).
* **`CONVOCADO_CONFIRMADO`**: Paciente contactado. Confirmou que deseja o procedimento e aguarda agendamento/internação.
* **`CONVOCADO_RECUSOU`**: Paciente contactado. Informou que já realizou de forma particular, por plano de saúde ou desistiu do procedimento.
* **`SEM_CONTATO`**: Tentativas falhas de contato (não atende, caixa postal ou número inexistente).
* **`INTERNADO`**: Paciente internado em hospital prestador aguardando a cirurgia.
* **`PROCEDIMENTO_REALIZADO`**: Cirurgia ou exame concluído.
* **`ALTA`**: Paciente recuperado e liberado.
* **`DESISTENCIA` / `OBITO` / `TRANSFERENCIA`**: Status terminais aplicados via workflow de movimentação.
* **`NAO_ENCONTRADO_SISREG` (Fora do SISREG)**: Solicitação ausente na exportação do SISREG (provavelmente concluída na Central do Estado ou cancelada).

---

## ⚡ 3. Automações e Triggers no PostgreSQL

O banco de dados utiliza triggers para manter a integridade, rastreabilidade e histórico dos dados:

### 1. Triggers de Auditoria (`process_audit_log`)
Gatilho aplicado nas tabelas `pacientes`, `fila_solicitacoes`, `contatos` e `movimentacoes_fila`.
* **Ação**: A cada `INSERT`, `UPDATE` ou `DELETE`, intercepta os dados e registra uma linha imutável na tabela `public.audit_log` contendo:
  * O nome da tabela e o ID do registro alterado.
  * A ação executada (`INSERT`, `UPDATE` or `DELETE`).
  * O UUID do usuário logado no Supabase (`auth.uid()`).
  * O snapshot em formato JSONB de como os dados estavam antes (`dados_anteriores`) e como ficaram após a alteração (`dados_novos`).

### 2. Trigger de Aplicação de Movimentações (`apply_fila_movement`)
Gatilho aplicado na tabela `movimentacoes_fila` executado `AFTER UPDATE`.
* **Ação**: Quando o status da proposta transita de `PENDENTE` para `APROVADO`, atualiza automaticamente na tabela `fila_solicitacoes`:
  * A nova `classificacao_risco` (se informada).
  * A nova `posicao_fila` (se informada).
  * O `status_interno` (se o tipo de proposta for `DESISTENCIA` ➔ status `DESISTENCIA`, ou `OBITO` ➔ status `OBITO`).

---

## 📥 4. Motor de Importação e Tratamento de Ausentes (Fora do SISREG)
O algoritmo de importação realiza as seguintes etapas lógicas para garantir performance com arquivos grandes:
1. **Sanitização de Cabeçalhos**: Renomeia colunas repetidas (adicionando sufixos `_1`, `_2`) para evitar colisões (típico nos relatórios ambulatoriais do SISREG).
2. **Importação Relacional em Cascata**: Realiza o upsert de tabelas de apoio primeiro (CIDs, procedimentos, unidades, municípios) para manter as foreign keys válidas antes de inserir os pacientes e as solicitações.
3. **Mapeamento e Identificação de Ausentes**:
   * O sistema obtém as especialidades (procedimentos) que estão sendo importadas neste lote.
   * Executa uma única query no Postgres buscando solicitações ativas daquelas mesmas especialidades que **não constam** no novo arquivo.
   * Atualiza o status dessas solicitações antigas para `NAO_ENCONTRADO_SISREG` e define `active = true` (ou inativa dependendo das regras). Isso economiza largura de banda e tempo de processamento comparado a loops em JavaScript.
