# 📖 Manual de Operação do SisFilaSus — Perfil Operador e Regulador

Este manual foi elaborado para orientar os operadores de regulação e convocadores da Secretaria Municipal de Saúde de Marabá no uso diário do sistema **SisFilaSus**.

---

## 🎯 1. O que é o SisFilaSus?
O **SisFilaSus** é a plataforma municipal que organiza, audita e facilita a busca ativa de pacientes que estão na fila de espera do SUS (SISREG). Ele otimiza o contato direto com o cidadão, permitindo atualizar contatos, enviar convocações rápidas via WhatsApp e registrar os históricos operacionais de forma auditada.

---

## 🔍 2. Fila de Espera (Visão Geral e Pesquisa)
A tela **Fila de Espera** (`/dashboard/fila`) é a central de consultas de todas as solicitações ativas do município.

### 💡 Principais Ações nesta Tela:
* **Busca de Paciente**: Pesquise na barra superior informando o **Nome Completo**, o número do **CNS** (Cartão SUS, 15 dígitos) ou o **Código de Solicitação** do SISREG.
* **Filtros Avançados**:
  * **Procedimento**: Filtre a fila para um procedimento médico específico.
  * **Município de Origem**: Visualize apenas as solicitações de determinado município da regulação.
  * **Risco**: Filtre por prioridade clínica (*Emergência*, *Urgência*, *Prioridade*, *Eletivo*, *Especial*).
  * **Status Interno**: Busque pacientes por estágio operacional (ex: `SEM_CONTATO` para retentar ligações).
  * **Eixo (Tipo)**: Divida a visualização entre *Ambulatorial (Consultas/Exames)* e *Internação (Cirurgias Eletivas)*.
* **Filtros Operacionais**:
  * **Solicitações Antigas (> 5 anos)**: Checkbox para identificar cadastros muito antigos para inativação.
  * **Omitir Fora do SISREG**: Filtro ativo por padrão que oculta registros que não constam mais nos relatórios de exportação do SISREG (normalmente concluídos ou cancelados). Desmarque para visualizá-los.

---

## 💬 3. Busca Ativa e Convocação via WhatsApp
Ao clicar no ícone de visualização (olho) de um paciente na Fila, o **Drawer Lateral de Detalhes** se abre.

### 📲 Fluxo de Envio de Mensagem:
1. **Verifique os Dados**: Analise a Idade, CPF, CNS, Nome da Mãe, Data da Solicitação e a Estimativa de Atendimento na Fila.
2. **Atualização de Telefone**: Se os números mostrados estiverem desatualizados, digite o novo telefone no campo formatado e clique em **"Salvar Telefones"**.
3. **Selecione o Modelo**: No dropdown **Selecione o Modelo de Mensagem**, escolha a opção adequada (ex: *Convocação Cirurgia*, *Confirmação de Consulta/Exame*).
4. **Preview Editável**: O texto processado com as variáveis do paciente aparecerá na caixa de texto. Você pode **adicionar informações adicionais** ou recados específicos digitando diretamente no preview.
5. **Chamar no WhatsApp**: Clique no botão verde. O sistema abrirá uma janela com o WhatsApp Web contendo a mensagem preenchida para envio.

---

## 📝 4. Registro de Contato (Desfecho)
Toda tentativa de contato **deve** ser registrada no sistema para compor o histórico e atualizar o status da solicitação.

### 📋 Campos a Preencher no Formulário:
* **Meio de Contato**: Escolha entre `WhatsApp`, `Ligação Telefônica`, `Visita Domiciliar` ou `SMS`.
* **Resultado**:
  * `Sucesso: Paciente Confirmou` (Atualiza o status automático da solicitação para **Confirmado**).
  * `Sucesso: Paciente Recusou/Fez Particular` (Atualiza para **Recusou/Desistiu**).
  * `Sem resposta / Não atende` (Atualiza para **Sem Contato**).
  * `Número Inexistente / Errado` (Atualiza para **Sem Contato**).
* **Observações**: Descreva o que foi falado (ex: *"Confirmado que virá pegar a guia na terça-feira. Falado com a esposa Ana."*).
* Clique em **"Salvar Registro"**.

> [!TIP]
> Ao disparar uma mensagem pelo WhatsApp utilizando o preview, o sistema **preenche automaticamente** o formulário de log com o resultado `Sucesso` e cola o texto enviado nas observações para economizar seu tempo!

---

## ⚙️ 5. Alteração Manual de Status
Caso você receba informações externas (ex: a Assistência Social informou óbito, ou a Unidade notificou que o paciente já realizou a cirurgia no hospital estadual):
1. No Drawer de Detalhes, localize o campo **"Alterar Status Interno (Manual)"** (embaixo dos telefones).
2. Selecione o status correto (ex: `PROCEDIMENTO_REALIZADO`, `INTERNADO`, `DESISTENCIA`, `OBITO`).
3. Confirme a alteração. O sistema registra a alteração instantaneamente de forma auditada.

---

## 📋 6. A Lista de Convocação Diária
A tela **Lista de Convocação** (`/dashboard/convocacao`) é a sua fila de trabalho dedicada.

* **Foco no que importa**: Ela exibe apenas solicitações ativas com os status `EM_CONVOCACAO` ou `SEM_CONTATO`.
* **Fluxo de Trabalho Limpo**: 
  * Selecione o paciente na lista da esquerda.
  * O painel de convocação e registro rápido abrirá à direita.
  * Escolha o modelo, edite o preview, chame no WhatsApp e salve o desfecho.
  * Assim que você registrar um desfecho final (Confirmou ou Recusou), o paciente **some da lista diária**, permitindo que você limpe a sua fila de trabalho.

---

## 🌐 7. Portal do Cidadão (Orientação ao Paciente)
Sempre que um paciente solicitar a confirmação de sua posição na fila ou quiser acompanhar o andamento de forma independente, você pode orientá-lo a acessar o **Portal do Cidadão**.

* **Endereço para os Pacientes**:
  * **Ambiente de Produção (Online)**: `https://[seu-dominio-de-producao]/portal-cidadao`
  * **Ambiente de Desenvolvimento (Local)**: [http://localhost:3000/portal-cidadao](http://localhost:3000/portal-cidadao)
* **Como Instruir o Paciente**:
  1. Informe ao paciente que ele deve acessar o link do portal.
  2. Ele **não precisa de senha ou login**, bastando apenas digitar o seu **CPF** ou o número do seu **CNS** (Cartão SUS) e clicar em "Pesquisar".
  3. Explique que, por questões de segurança (LGPD), o nome dele aparecerá apenas com as iniciais e os números do documento estarão parcialmente ocultos, mas ele conseguirá ver a posição exata e o procedimento cadastrado.
