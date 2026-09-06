-- =========================================================
-- MIGRAÇÃO: Perfil de Prestador & Registro de Intercorrências
-- SisFilaSUS — Marabá
-- Executar manualmente no Supabase SQL Editor
-- =========================================================

-- 1. Atualizar constraint de roles na tabela users para incluir PRESTADOR_USER
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check CHECK (role IN (
    'SMS_ADMIN',           -- Gestor municipal: acesso total
    'COORDENADOR',         -- Coordenador da regulação
    'MEDICO_REGULADOR',    -- Médico regulador / autorizador
    'OPERADOR_REGULACAO',  -- Operador de regulação (convocador)
    'AUXILIAR',            -- Auxiliar administrativo
    'UNIDADE_USER',        -- Usuário de UBS/Unidade Solicitante (vinculado a cnes_vinculo)
    'PRESTADOR_USER'       -- Operador/Recepção da Clínica ou Hospital Executante (vinculado a hospital_id)
));

-- 2. Adicionar coluna hospital_id na tabela users
ALTER TABLE public.users 
  ADD COLUMN IF NOT EXISTS hospital_id UUID REFERENCES public.hospitais_prestadores(id) ON DELETE SET NULL;

-- 3. Adicionar campo de horário de término da sessão na tabela agendas_prestadores
ALTER TABLE public.agendas_prestadores 
  ADD COLUMN IF NOT EXISTS horario_fim VARCHAR(10) DEFAULT '12:00';

-- 4. Adicionar campos de desfecho e intercorrência na tabela agendamentos_procedimentos
ALTER TABLE public.agendamentos_procedimentos 
  ADD COLUMN IF NOT EXISTS desfecho_execucao VARCHAR(50) DEFAULT 'PENDENTE' CHECK (
    desfecho_execucao IN (
      'PENDENTE',
      'SUCESSO_REALIZADO',
      'INTERCORRENCIA_CLINICA',
      'REPROVADO_RISCO_CARDIOLOGICO',
      'REPROVADO_ANESTESIA',
      'FALTA_LEITO_UTI',
      'ABSENTEISMO_PACIENTE',
      'SUSPENSAO_CLINICA'
    )
  ),
  ADD COLUMN IF NOT EXISTS intercorrencia_tipo VARCHAR(100),
  ADD COLUMN IF NOT EXISTS intercorrencia_descricao TEXT,
  ADD COLUMN IF NOT EXISTS realizado_por_medico VARCHAR(255);

-- 5. Atualizar políticas RLS para permitir que PRESTADOR_USER acesse suas agendas e pacientes
DROP POLICY IF EXISTS "Prestadores gerenciam suas próprias agendas" ON public.agendas_prestadores;
CREATE POLICY "Prestadores gerenciam suas próprias agendas" ON public.agendas_prestadores
  FOR ALL USING (
    (public.get_user_role() IN ('SMS_ADMIN', 'COORDENADOR', 'OPERADOR_REGULACAO')) OR
    (public.get_user_role() = 'PRESTADOR_USER' AND hospital_id IN (
      SELECT hospital_id FROM public.users WHERE id = auth.uid()
    ))
  );

DROP POLICY IF EXISTS "Prestadores interagem com agendamentos do seu hospital" ON public.agendamentos_procedimentos;
CREATE POLICY "Prestadores interagem com agendamentos do seu hospital" ON public.agendamentos_procedimentos
  FOR ALL USING (
    (public.get_user_role() IN ('SMS_ADMIN', 'COORDENADOR', 'OPERADOR_REGULACAO', 'AUXILIAR')) OR
    (public.get_user_role() = 'PRESTADOR_USER' AND agenda_id IN (
      SELECT id FROM public.agendas_prestadores WHERE hospital_id IN (
        SELECT hospital_id FROM public.users WHERE id = auth.uid()
      )
    ))
  );
