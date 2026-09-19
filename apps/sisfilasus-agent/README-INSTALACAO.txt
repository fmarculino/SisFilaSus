========================================================================
SISFILASUS — AGENTE CONECTOR e-SUS PEC (v1.3.0) — 24x7
Secretaria Municipal de Saúde — Marabá
========================================================================

Este aplicativo foi desenvolvido para rodar diretamente no servidor local
onde está instalado o e-SUS PEC, permitindo a sincronização sob demanda
com o SisFilaSUS com total segurança e sem abrir portas na rede.

------------------------------------------------------------------------
INSTRUÇÕES DE INSTALAÇÃO NO SERVIDOR (INSTALAÇÃO ÚNICA):
------------------------------------------------------------------------

1. COPIAR A PASTA:
   - Copie esta pasta (ex: C:\SisFilaSUS-Agent) para dentro do servidor do e-SUS.

2. EXECUTAR E CONFIGURAR:
   - Dê dois cliques em "SisFilaSusAgent.exe".
   - Um ícone com escudo aparecerá na bandeja do Windows (ao lado do relógio).
   - Clique com o botão direito no ícone e escolha:
     "Configurar Credenciais e-SUS..."
   - Digite a senha do usuário "esus_leitura" e clique em "Salvar Configurações".
   - Marque a opção "Iniciar junto com o Windows" no menu de contexto.

Pronto! O aplicativo ficará ativo na bandeja e atenderá automaticamente
qualquer solicitação de sincronização disparada pelo painel do SisFilaSUS.

------------------------------------------------------------------------
AUTO-ATUALIZAÇÃO TRANSPARENTE (ESTILO SIS-ESCALA):
------------------------------------------------------------------------
- Você NÃO precisa mais baixar arquivos .zip ou reinstalar o aplicativo.
- O SisFilaSUS Agente verifica periodicamente novas versões na nuvem.
- Havendo uma versão mais recente, ele baixa a atualização em segundo plano,
  valida a integridade por SHA-256, substitui o executável e reinicia sozinho.
- Você também pode clicar com o botão direito e selecionar:
  "Verificar Atualização..." a qualquer momento.

------------------------------------------------------------------------
SEGURANÇA:
------------------------------------------------------------------------
- Suas credenciais são protegidas com a Windows DPAPI (criptografia nativa
  do Windows) e NUNCA são enviadas para a nuvem ou internet.
- O PostgreSQL do e-SUS pode permanecer isolado apenas em "localhost" (127.0.0.1).
========================================================================
