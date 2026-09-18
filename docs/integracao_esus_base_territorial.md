# Guia de Integração: Base Cadastral e-SUS & Enriquecimento Territorial

O **SisFilaSUS** conta com uma solução completa de integração com o **e-SUS Atenção Primária**, permitindo utilizar os relatórios de *Acompanhamento de Cidadãos Vinculados* para enriquecer continuamente o cadastro dos pacientes regulados, sem inflar a fila com cidadãos não regulados.

---

## 1. Visão Geral e Arquitetura

O sistema implementa um **Ciclo Virtuoso e Contínuo**:
```
  [ Arquivos e-SUS ]  ──>  Alimenta/Atualiza  ──>  [ Base Municipal e-SUS ]
                                                      (esus_cadastros)
                                                             │
              ┌──────────────────────────────────────────────┘
              │ Enriquecimento Automático
              ▼
   [ Pacientes SisFilaSUS ]  <──  Importação de Fila  ──  [ Arquivos SISREG ]
  (Endereço + Telefones + UBS + Equipe + Microárea + Data Atualização)
```

1. **Base Territorial Municipal (`esus_cadastros`)**:
   - Guarda o cadastro dos cidadãos do município mapeados pelas Equipes de Saúde da Família (ESF) e Agentes Comunitários de Saúde (ACS).
   - Controla histórico de atualizações (`total_atualizacoes`, `updated_at`, array JSONB de telefones desduplicados).
2. **Atualização da Fila SisFilaSUS (`pacientes`)**:
   - **Regra Estrita:** Cidadãos do e-SUS que não estão no SisFilaSUS **nunca são adicionados à fila**.
   - Para pacientes que já estão na fila, o sistema atualiza seus endereços, vincula a UBS de referência, registra a Equipe de Saúde e Microárea e insere novos telefones sem duplicidade.
3. **Ciclo Automático com o SISREG (`import-parser.ts`)**:
   - Sempre que um arquivo da fila ou agendamentos do SISREG é importado, o sistema executa automaticamente uma rotina de enriquecimento cruzando os novos pacientes com a base `esus_cadastros`.

---

## 2. Novos Campos Estratégicos na Fila

| Campo | Tipo | Descrição |
| :--- | :--- | :--- |
| `unidade_referencia_cnes` | VARCHAR(10) | Código CNES da Unidade Básica de Saúde (UBS) de referência do paciente. |
| `equipe_saude_nome` | VARCHAR(100) | Nome da Equipe de Saúde da Família (ex: *AFETTUS*, *ALIANÇA*, *PREMIUM*). |
| `equipe_saude_ine` | VARCHAR(20) | Identificador Nacional de Equipe (INE) no Ministério da Saúde. |
| `microarea` | VARCHAR(20) | Microárea de atuação do Agente Comunitário de Saúde (ACS). |
| `data_atualizacao_esus` | DATE | Data em que o cidadão foi atualizado no e-SUS / visitado pela equipe de saúde. |

> **Impacto Operacional na Busca Ativa:** Quando a central de regulação não consegue contato telefônico com um paciente convocado (`SEM_CONTATO`), o operador pode consultar a **Equipe de Saúde** e a **Microárea** para acionar a visita domiciliar presencial pelo ACS, evitando o absenteísmo e a perda da vaga cirúrgica.

---

## 3. Como Importar Arquivos do e-SUS

### Opção A: Pela Interface Web (`/dashboard/importacao`)
1. Acesse o menu **Importar Arquivos** no painel lateral.
2. Clique na aba **Atualização e-SUS**.
3. O sistema oferece duas formas de envio:
   - **Selecionar Pasta Completa:** Permite apontar para uma pasta (ex: `dados-pacientes`) e carregar de uma só vez todos os arquivos `.csv` do e-SUS.
   - **Selecionar Múltiplos Arquivos:** Arraste e solte múltiplos arquivos ou selecione vários com `Ctrl + A`.
4. Os arquivos entram na **Fila de Execução**, exibindo tamanho e status.
5. Clique em **Iniciar Processamento do Lote**:
   - O sistema processa sequencialmente arquivo por arquivo.
   - Indicadores de progresso e métricas acumuladas são exibidos em tempo real.

### Opção B: Via Linha de Comando (Arquivos CSV)
Para processar grandes volumes ou pastas locais diretamente no terminal:
```bash
npm run import:esus
```
*Por padrão, o comando lê a pasta `C:\Users\Cliente\Projetos\dados-pacientes`, podendo também receber um caminho customizado como argumento:*
```bash
npm run import:esus "C:\caminho\para\outra\pasta"
```

### Opção C: Sincronização Direta com o Banco de Dados e-SUS PEC (Sob Demanda)
Para sincronizar diretamente do banco de dados PostgreSQL do e-SUS PEC local via rede interna:
```bash
# Sincroniza os cidadãos atualizados nos últimos 30 dias (recomendado para o dia a dia):
npm run sync:esus

# Sincroniza apenas atualizações recentes (ex: últimos 7 dias):
npm run sync:esus -- --days=7

# Sincroniza toda a base municipal (57.000+ cidadãos em lotes paginados):
npm run sync:esus -- --all
```

> [!NOTE]
> **Segurança e Privacidade:**
> 1. As credenciais do banco e-SUS ficam salvas exclusivamente no arquivo `.env.local` na máquina da rede da SMS (protegido pelo `.gitignore` e nunca enviado ao repositório público).
> 2. O acesso utiliza o usuário de leitura `esus_leitura` (somente comandos `SELECT`), sem nenhum risco de alteração ou travamento no e-SUS PEC.
> 3. A conexão só funciona dentro da rede local (`10.110.2.x`), garantindo que nenhuma porta fique aberta para a internet.

---

## 4. Segurança e Prevenção de Duplicatas
- **Filtro Inteligente e Comparação Canônica (`phone-utils.ts`):** 
  - Antes de qualquer inserção na tabela `pacientes_telefones` ou nos campos legados `telefone_1`/`telefone_2`, o sistema verifica se o telefone já está registrado para aquele paciente.
  - A comparação utiliza a função `arePhoneNumbersEqual`, que detecta:
    - Igualdade exata entre números limpos;
    - Equivalência entre números móveis de 10 dígitos (sem o 9º dígito) e 11 dígitos (com o 9º dígito);
    - Truncamentos herdados de exportações com limite de tamanho de coluna (ex: 10 dígitos sendo prefixo exato de 11 dígitos);
    - Convergência dos 8 dígitos finais locais para o mesmo paciente.
- **Promoção Automática de Números:** Se o paciente já possuía um telefone com 10 dígitos e a nova importação trouxer a versão completa de 11 dígitos do mesmo contato, o registro existente é promovido para a versão completa de 11 dígitos sem duplicar a linha.
- **Tolerância a Arquivos Repetidos:** Se o mesmo arquivo for importado duas vezes (ou arquivos com dados redundantes), a rotina apenas atualiza a data e não gera novos telefones.
