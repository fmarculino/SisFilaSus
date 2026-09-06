-- Script SQL para corrigir os municípios de origem dos pacientes cadastrados
-- Cruzando as informações com a fila de solicitações e a tabela de municípios do IBGE

UPDATE public.pacientes p
SET municipio_origem = m.nome
FROM public.fila_solicitacoes f
JOIN public.municipios m ON f.municipio_origem_ibge = m.codigo_ibge
WHERE f.paciente_id = p.id 
  AND (p.municipio_origem IS NULL OR (p.municipio_origem = 'MARABA' AND m.nome <> 'MARABA'));
