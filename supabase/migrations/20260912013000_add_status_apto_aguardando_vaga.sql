-- =========================================================================
-- SISFILASUS — STATUS: APTO / AGUARDANDO VAGA (BANCO DE APTOS)
-- Data: 2026-09-12
--
-- Adiciona o status operacional para pacientes que foram contatados,
-- confirmaram interesse e elegibilidade, mas estão aguardando abertura
-- de cotas de agendas pelo prestador.
-- =========================================================================

INSERT INTO public.status_solicitacao (
    codigo,
    nome,
    origem,
    cor,
    ordem,
    descricao,
    active,
    bloqueado_edicao_codigo
)
VALUES (
    'APTO_AGUARDANDO_VAGA',
    'Apto / Aguardando Vaga',
    'SisFilaSus',
    'teal',
    25,
    'Paciente contatado, elegível e com documentação pronta, aguardando oferta de cotas de agenda',
    true,
    false
)
ON CONFLICT (codigo) DO UPDATE
SET 
    nome = EXCLUDED.nome,
    cor = EXCLUDED.cor,
    descricao = EXCLUDED.descricao,
    active = true;
