# 📅 Central de Agendamentos & Cirurgias Eletivas + Gestão de Telefones

Este documento descreve a arquitetura operacional e técnica da **Central de Agendamento Cirúrgico/Ambulatorial**, do **Portal do Prestador (Clínicas e Hospitais)** e do **Sistema de Múltiplos Telefones com Status de Contato** do SisFilaSUS.

---

## 1. Gestão de Múltiplos Telefones por Paciente

Para resolver o problema histórico de absenteísmo e dificuldade de contato com pacientes (troca frequente de número, aparelhos perdidos, celulares de terceiros), o SisFilaSUS adota uma arquitetura de N telefones por paciente.

### 1.1. Estrutura de Dados (`pacientes_telefones`)
- `paciente_id`: Vínculo com a ficha do paciente.
- `numero`: Telefone formatado com DDD.
- `tipo`:
  - `CELULAR_WHATSAPP`: Celular com WhatsApp habilitado.
  - `CELULAR`: Celular convencional sem WhatsApp.
  - `FIXO`: Telefone residencial ou comercial fixo.
  - `RECADO`: Telefone de terceiro (familiar, vizinho, agente comunitário).
- `status`:
  - 🟢 `ATIVO`: Funcional e em uso.
  - 🔴 `INATIVO`: Fora de uso genérico.
  - 🟠 `TROCOU_DONO`: Número repassado pela operadora a outra pessoa.
  - 🟡 `PERDIDO`: Paciente perdeu chip/aparelho.
  - ⚫ `DESLIGADO`: Desligado ou fora de área frequente.
  - 🔵 `NAO_EXISTE`: Número inexistente na operadora.
  - 🟣 `NAO_ATENDE`: Toca até cair, mas não atende.
- `prioridade`: `0` = Número principal (⭐), `1`, `2`... (ordem decrescente de prioridade).
- `nome_contato` e `parentesco`: Identificação de quem atende em números de recado.

---

## 2. Central de Agendamentos & Cirurgias Eletivas (`/dashboard/agendas`)

A Central de Agendamentos substitui as planilhas manuais compartilhadas entre a **Secretaria Municipal de Saúde** e os **Hospitais/Clínicas Prestadoras**.

```
[Clínica / Hospital]                 [Central de Regulação]                 [Execução / Fechamento]
Oferta de Vagas & Médicos  ───>  Alocação da Fila Prioritária  ───>  Check-in, Cirurgia & Baixa SISREG
```

### 2.1. Modos de Visualização (Multimodo)
1. **📅 Calendário Mensal**:
   - Grade por dia com contadores em tempo real de ocupação de vagas (ex: `12/15 vagas preenchidas`).
   - Cores indicativas de disponibilidade e navegação rápida entre meses.
2. **📊 Kanban do Funil Cirúrgico**:
   - Acompanhamento visual dos pacientes em 6 estágios:
     1. `Consulta Pré-Op Agendada`
     2. `Consulta Realizada (Avaliado)`
     3. `Aguardando Data Cirurgia`
     4. `Cirurgia Agendada`
     5. `Cirurgia Realizada (Sucesso)`
     6. `Inaptos / Faltas / Intercorrências`
   - Cartões com acionamento de WhatsApp direto, dados de contato e seletor rápido de transição de fase.
3. **📋 Visão Planilha (Estilo Google Sheets)**:
   - Tabela geral consolidada com barras de progresso visual de ocupação para conferência rápida.
4. **📑 Fechamento & Devolutiva SISREG**:
   - Tabela de conferência com filtros de pendências.
   - **Exportação CSV (Excel)**: Gera arquivo pronto para o fechamento oficial no SISREG.
   - **Marcação em Lote**: Permite marcar múltiplos registros como alimentados no SISREG.

---

## 3. Fluxo Operacional: Passo a Passo

### Passo 1: Oferta de Disponibilidade (Prestador ou Regulação)
- Clique no botão **"+ Ofertar Nova Agenda"**.
- Preencha:
  - **Médico Responsável**: Ex: *Dr. José Roberto, Dra. Juliana*.
  - **Especialidade**: *Cirurgia Geral, Urologia, Pequenas Cirurgias, Ginecologia, Ortopedia, etc.*
  - **Hospital / Prestador**: Selecione o hospital ou clínica executante.
  - **Data e Horários**: Data da sessão, Horário de Início (ex: *08:00*) e Horário de Término (ex: *12:00*).
  - **Qtd. de Vagas**: Número de cirurgias ou atendimentos comportados.
  - **Observações / Sala**: Orientações específicas de preparo ou sala de atendimento.

### Passo 2: Alocação Inteligente a partir da Fila de Espera
- Na agenda do médico, clique em **"Preencher Vagas da Fila"**.
- O sistema filtra automaticamente os pacientes prioritários da fila que aguardam aquela especialidade, ordenados por:
  1. **Classificação de Risco**: Risco 0 (Vermelho/Emergência) e Risco 1 (Laranja/Urgência) primeiro.
  2. **Posição Numérica na Fila**: Ordem cronológica oficial.
- O operador pode disparar mensagem no WhatsApp do paciente e, com 1 clique no botão **"Alocar na Vaga"**, vinculá-lo à agenda.

### Passo 3: Atendimento & Registro de Intercorrências Clínicas
No dia da consulta ou cirurgia, a clínica ou operador registra:
- **Presença na Consulta**: `[ Compareceu ]` / `[ Faltou ]`.
- **Parecer de Risco Cirúrgico**: `🟢 Apto para Cirurgia`, `🟡 Inapto Temporário`, `🔴 Inapto Definitivo`, `🔵 Encaminhado Outro Serviço`.
- **Data da Cirurgia**: Agendamento da data do procedimento operatório.
- **Desfecho Cirúrgico**: `[ ✓ Operou com Sucesso ]`.
- **⚠️ Registro de Intercorrência / Complicação**:
  - Modal com categorias padronizadas:
    - 🫀 *Risco Cardiológico Não Autorizou*
    - 💉 *Contraindicação Anestésica*
    - 🏥 *Falta de Retaguarda / Leito de UTI*
    - ⚠️ *Complicação Clínica Durante Atendimento*
    - 🚶 *Paciente Não Compareceu (Absenteísmo)*
    - ❌ *Suspensão por Jejum / Preparo Inadequado*
  - Campo para descrição do **Parecer Médico Justificado**.

---

## 4. Perfil de Acesso do Prestador (`PRESTADOR_USER`)

Para hospitais conveniados e clínicas:
- Na tela `/dashboard/usuarios`, cadastre o usuário com o perfil **"Prestador de Serviços (Clínica / Hospital)"** e selecione o hospital correspondente.
- O usuário do prestador acessa apenas as agendas, médicos e pacientes vinculados à sua própria instituição, com autonomia para ofertar vagas, fazer check-in e registrar intercorrências.
