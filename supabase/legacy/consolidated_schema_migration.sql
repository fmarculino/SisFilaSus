-- =========================================================
-- SCHEMA CONSOLIDADO E MIGRACAO COMPLETA — SISFILASUS
-- =========================================================

-- 1. Habilitar extensões
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Tabela de Usuários do Sistema (Espelha auth.users)
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    nome TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN (
        'SMS_ADMIN',           -- Gestor municipal: acesso total
        'COORDENADOR',         -- Coordenador da regulação
        'MEDICO_REGULADOR',    -- Médico regulador / autorizador
        'OPERADOR_REGULACAO',  -- Operador de regulação (convocador)
        'AUXILIAR',            -- Auxiliar administrativo
        'UNIDADE_USER'         -- Visualiza apenas pacientes da sua unidade (vinculado a CNES)
    )),
    cnes_vinculo TEXT,         -- CNES se for UNIDADE_USER
    active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Restrição: Usuários do tipo UNIDADE_USER devem ter cnes_vinculo preenchido
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS cnes_vinculo_required_for_unidade;
ALTER TABLE public.users ADD CONSTRAINT cnes_vinculo_required_for_unidade CHECK (
    (role <> 'UNIDADE_USER') OR 
    (role = 'UNIDADE_USER' AND cnes_vinculo IS NOT NULL)
);

-- 3. Tabela de Pacientes (CNS como Unique, ID interno UUID como PK)
CREATE TABLE IF NOT EXISTS public.pacientes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cns_usuario VARCHAR(15) NOT NULL UNIQUE,
    cpf_usuario VARCHAR(14),    -- Com ou sem máscara
    nome_usuario VARCHAR(255) NOT NULL,
    data_nascimento DATE,
    sexo VARCHAR(20),
    nome_mae VARCHAR(255),
    telefone_1 VARCHAR(20),     -- Telefone primário
    telefone_2 VARCHAR(20),     -- Telefone secundário
    endereco TEXT,
    municipio_origem VARCHAR(100),
    observacoes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Municípios da Região (Centrais Reguladoras)
CREATE TABLE IF NOT EXISTS public.municipios (
    codigo_ibge VARCHAR(10) PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    central_reguladora_nome VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Unidades Solicitantes (UBSs, Postinhos, Hospitais da Região)
CREATE TABLE IF NOT EXISTS public.unidades_solicitantes (
    cnes VARCHAR(10) PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    municipio_ibge VARCHAR(10) REFERENCES public.municipios(codigo_ibge) ON DELETE SET NULL,
    tipo VARCHAR(50),          -- UBS, Hospital, Secretaria, Central de Regulação
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Hospitais Prestadores / Executantes (Rede de Referência)
CREATE TABLE IF NOT EXISTS public.hospitais_prestadores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cnes VARCHAR(10) UNIQUE,
    nome VARCHAR(255) NOT NULL,
    especialidades TEXT[],     -- Array de especialidades atendidas
    active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. Procedimentos (SIGTAP)
CREATE TABLE IF NOT EXISTS public.procedimentos (
    cod_sigtap VARCHAR(10) PRIMARY KEY,
    desc_sigtap TEXT NOT NULL,
    modalidade_fila INT,       -- 0=Consulta, 1=Exame, 2=Cirurgia, 3=Demais
    grupo_codigo VARCHAR(10),
    grupo_descricao TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 8. CIDs (Código Internacional de Doenças)
CREATE TABLE IF NOT EXISTS public.cids (
    codigo_cid VARCHAR(10) PRIMARY KEY,
    desc_cid TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 9. Fila de Solicitações (Tabela Central unificada)
CREATE TABLE IF NOT EXISTS public.fila_solicitacoes (
    cod_solicitacao BIGINT PRIMARY KEY,
    paciente_id UUID NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
    cod_sigtap VARCHAR(10) NOT NULL REFERENCES public.procedimentos(cod_sigtap) ON DELETE RESTRICT,
    codigo_cid VARCHAR(10) REFERENCES public.cids(codigo_cid) ON DELETE SET NULL,
    cnes_solicitante VARCHAR(10) REFERENCES public.unidades_solicitantes(cnes) ON DELETE SET NULL,
    municipio_origem_ibge VARCHAR(10) REFERENCES public.municipios(codigo_ibge) ON DELETE SET NULL,
    
    data_solicitacao TIMESTAMP NOT NULL,
    classificacao_risco INT NOT NULL,  -- Código real do SISREG (0-4)
    posicao_fila INT,                  -- NULL para agendados/regulados (sem fila ativa)
    modalidade_fila INT,               -- 0=Consulta, 1=Exame, 2=Cirurgia, 3=Demais
    tipo_fila INT,                     -- 1=Ambulatorial, 3=Internação
    
    estimativa_atendimento_proc INT,
    estimativa_atendimento_paciente INT,
    producao_media_mensal INT,
    
    -- Campos de controle de agendamento/execução (Ambulatorial e Exames)
    data_autorizacao_agendamento TIMESTAMP WITH TIME ZONE,
    data_execucao TIMESTAMP WITH TIME ZONE,
    execucao_confirmada BOOLEAN DEFAULT false NOT NULL,
    chave_confirmacao VARCHAR(100),
    status_sisreg VARCHAR(50),          -- Status oficial no SISREG (ex: 'AR')
    tipo_vaga_solicitada INT,
    tipo_vaga_consumida INT,
    cnes_executante VARCHAR(10),        -- CNES da unidade executante
    nome_executante VARCHAR(255),       -- Nome da unidade executante
    
    -- Campos de controle local
    status_interno VARCHAR(50) DEFAULT 'NA_FILA' NOT NULL CHECK (
        status_interno IN (
            'NA_FILA',
            'EM_CONVOCACAO',
            'CONVOCADO_CONFIRMADO',
            'CONVOCADO_RECUSOU',
            'SEM_CONTATO',
            'ABSENTEISEMO', -- Mantendo compatibilidade com digitação original de auditoria se necessário, mas na tabela está 'ABSENTEISMO'. Vamos permitir ambos ou manter o CHECK original:
            'ABSENTEISMO',
            'INTERNADO',
            'PROCEDIMENTO_REALIZADO',
            'ALTA',
            'DESISTENCIA',
            'OBITO',
            'NAO_ENCONTRADO_SISREG'  -- Não apareceu na última importação
        )
    ),
    hospital_encaminhado_id UUID REFERENCES public.hospitais_prestadores(id) ON DELETE SET NULL,
    data_encaminhamento DATE,
    data_internacao DATE,
    data_alta DATE,
    
    active BOOLEAN DEFAULT true NOT NULL,
    ultima_importacao_id UUID,          -- Referência ao lote de importação
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 10. Lotes de Importação (Rastreabilidade)
CREATE TABLE IF NOT EXISTS public.importacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome_arquivo TEXT NOT NULL,
    data_exportacao_sisreg TIMESTAMP,    -- Campo "DATA DE EXPORTACAO" do CSV
    total_registros INT NOT NULL,
    registros_novos INT DEFAULT 0 NOT NULL,
    registros_atualizados INT DEFAULT 0 NOT NULL,
    registros_ausentes INT DEFAULT 0 NOT NULL,    -- Que estavam antes e não vieram
    importado_por UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Adicionar foreign key de importações na fila de solicitações após criação de ambas
ALTER TABLE public.fila_solicitacoes DROP CONSTRAINT IF EXISTS fk_fila_importacao;
ALTER TABLE public.fila_solicitacoes ADD CONSTRAINT fk_fila_importacao FOREIGN KEY (ultima_importacao_id) REFERENCES public.importacoes(id) ON DELETE SET NULL;

-- 11. Snapshots da Posição (Histórico de evolução temporal)
CREATE TABLE IF NOT EXISTS public.fila_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cod_solicitacao BIGINT NOT NULL REFERENCES public.fila_solicitacoes(cod_solicitacao) ON DELETE CASCADE,
    importacao_id UUID NOT NULL REFERENCES public.importacoes(id) ON DELETE CASCADE,
    posicao_fila INT, -- NULL se for agendado/regulado
    classificacao_risco INT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 12. Histórico de Contatos / Convocações
CREATE TABLE IF NOT EXISTS public.contatos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cod_solicitacao BIGINT NOT NULL REFERENCES public.fila_solicitacoes(cod_solicitacao) ON DELETE CASCADE,
    operador_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    tipo VARCHAR(50) NOT NULL CHECK (tipo IN ('WHATSAPP', 'LIGACAO', 'VISITA', 'SMS')),
    resultado VARCHAR(50) NOT NULL CHECK (resultado IN (
        'SUCESSO_CONFIRMOU',
        'SUCESSO_RECUSOU',
        'SUCESSO_REMARCOU',
        'SEM_RESPOSTA',
        'NUMERO_INVALIDO',
        'NUMERO_INEXISTENTE',
        'CAIXA_POSTAL'
    )),
    telefone_usado VARCHAR(20),
    observacoes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 13. Movimentações de Fila (Workflow de Aprovação)
CREATE TABLE IF NOT EXISTS public.movimentacoes_fila (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cod_solicitacao BIGINT NOT NULL REFERENCES public.fila_solicitacoes(cod_solicitacao) ON DELETE CASCADE,
    solicitada_por UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    aprovada_por UUID REFERENCES public.users(id) ON DELETE RESTRICT,
    tipo VARCHAR(50) NOT NULL CHECK (tipo IN (
        'MUDANCA_RISCO', 'MUDANCA_POSICAO', 'AGRAVAMENTO_CLINICO',
        'DESISTENCIA', 'OBITO', 'TRANSFERENCIA'
    )),
    justificativa TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDENTE' NOT NULL CHECK (status IN ('PENDENTE', 'APROVADO', 'REJEITADO')),
    
    valor_anterior JSONB,   -- { "classificacao_risco": 3, "posicao_fila": 45 }
    valor_novo JSONB,        -- { "classificacao_risco": 1, "posicao_fila": 2 }
    
    observacoes_decisao TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 14. Log de Auditoria Imutável
CREATE TABLE IF NOT EXISTS public.audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tabela TEXT NOT NULL,
    registro_id TEXT NOT NULL,
    acao TEXT NOT NULL,
    usuario_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    dados_anteriores JSONB,
    dados_novos JSONB,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 15. Templates de Mensagem (WhatsApp/SMS)
CREATE TABLE IF NOT EXISTS public.templates_mensagem (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    titulo VARCHAR(100) NOT NULL UNIQUE,
    corpo TEXT NOT NULL,
    active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 16. Configurações Globais
CREATE TABLE IF NOT EXISTS public.configuracoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chave VARCHAR(100) NOT NULL UNIQUE,
    valor JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- =========================================================
-- ÍNDICES PARA OTIMIZAÇÃO
-- =========================================================
CREATE INDEX IF NOT EXISTS idx_fila_active ON public.fila_solicitacoes(active);
CREATE INDEX IF NOT EXISTS idx_fila_sigtap ON public.fila_solicitacoes(cod_sigtap);
CREATE INDEX IF NOT EXISTS idx_fila_status ON public.fila_solicitacoes(status_interno);
CREATE INDEX IF NOT EXISTS idx_fila_municipio ON public.fila_solicitacoes(municipio_origem_ibge);
CREATE INDEX IF NOT EXISTS idx_fila_risco ON public.fila_solicitacoes(classificacao_risco);
CREATE INDEX IF NOT EXISTS idx_snapshots_solicitacao ON public.fila_snapshots(cod_solicitacao);
CREATE INDEX IF NOT EXISTS idx_contatos_solicitacao ON public.contatos(cod_solicitacao);
CREATE INDEX IF NOT EXISTS idx_audit_registro ON public.audit_log(tabela, registro_id);
CREATE INDEX IF NOT EXISTS idx_pacientes_nome ON public.pacientes USING gin (to_tsvector('portuguese', nome_usuario));

-- =========================================================
-- TRIGGERS E FUNÇÕES DE AUTOMAÇÃO
-- =========================================================

-- Função para registrar automaticamente um novo usuário do Supabase Auth no banco público
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email, nome, role)
  VALUES (
    new.id, 
    new.email, 
    COALESCE(new.raw_user_meta_data->>'nome', 'Novo Operador'), 
    COALESCE(new.raw_user_meta_data->>'role', 'OPERADOR_REGULACAO')
  )
  ON CONFLICT (id) DO UPDATE 
  SET email = EXCLUDED.email,
      nome = COALESCE(EXCLUDED.nome, public.users.nome);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger correspondente para criação automática do usuário
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Função para atualizar automaticamente o updated_at das tabelas principais
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger AS $$
BEGIN
  new.updated_at = timezone('utc'::text, now());
  RETURN new;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_pacientes_updated_at ON public.pacientes;
CREATE TRIGGER update_pacientes_updated_at BEFORE UPDATE ON public.pacientes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_fila_solicitacoes_updated_at ON public.fila_solicitacoes;
CREATE TRIGGER update_fila_solicitacoes_updated_at BEFORE UPDATE ON public.fila_solicitacoes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_movimentacoes_fila_updated_at ON public.movimentacoes_fila;
CREATE TRIGGER update_movimentacoes_fila_updated_at BEFORE UPDATE ON public.movimentacoes_fila FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_templates_mensagem_updated_at ON public.templates_mensagem;
CREATE TRIGGER update_templates_mensagem_updated_at BEFORE UPDATE ON public.templates_mensagem FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- Função de logs de auditoria

CREATE OR REPLACE FUNCTION public.process_audit_log()
RETURNS trigger AS $$
DECLARE
  v_usuario_id UUID;
  v_dados_anteriores JSONB := NULL;
  v_dados_novos JSONB := NULL;
  v_acao TEXT;
  v_tabela TEXT := TG_TABLE_NAME;
  v_registro_id TEXT;
BEGIN
  -- Obtain authenticated user ID from Supabase context
  v_usuario_id := auth.uid();

  -- IMPORTANTE: Se não houver usuário logado (ex: importação de planilha em background,
  -- migração ou scripts do sistema), ignora a auditoria para não inundar o banco de dados.
  IF v_usuario_id IS NULL THEN
    RETURN COALESCE(new, old);
  END IF;

  IF (TG_OP = 'INSERT') THEN
    v_acao := 'INSERT';
    v_dados_novos := to_jsonb(new);
    IF v_tabela = 'fila_solicitacoes' THEN 
      v_registro_id := new.cod_solicitacao::text;
    ELSE 
      v_registro_id := new.id::text;
    END IF;
  ELSIF (TG_OP = 'UPDATE') THEN
    v_acao := 'UPDATE';
    v_dados_anteriores := to_jsonb(old);
    v_dados_novos := to_jsonb(new);
    IF v_tabela = 'fila_solicitacoes' THEN 
      v_registro_id := new.cod_solicitacao::text;
    ELSE 
      v_registro_id := new.id::text;
    END IF;
  ELSIF (TG_OP = 'DELETE') THEN
    v_acao := 'DELETE';
    v_dados_anteriores := to_jsonb(old);
    IF v_tabela = 'fila_solicitacoes' THEN 
      v_registro_id := old.cod_solicitacao::text;
    ELSE 
      v_registro_id := old.id::text;
    END IF;
  END IF;

  INSERT INTO public.audit_log (tabela, registro_id, acao, usuario_id, dados_anteriores, dados_novos)
  VALUES (v_tabela, v_registro_id, v_acao, v_usuario_id, v_dados_anteriores, v_dados_novos);

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Triggers de auditoria
DROP TRIGGER IF EXISTS audit_fila_solicitacoes ON public.fila_solicitacoes;
CREATE TRIGGER audit_fila_solicitacoes AFTER INSERT OR UPDATE OR DELETE ON public.fila_solicitacoes FOR EACH ROW EXECUTE FUNCTION public.process_audit_log();

DROP TRIGGER IF EXISTS audit_pacientes ON public.pacientes;
CREATE TRIGGER audit_pacientes AFTER INSERT OR UPDATE OR DELETE ON public.pacientes FOR EACH ROW EXECUTE FUNCTION public.process_audit_log();

DROP TRIGGER IF EXISTS audit_contatos ON public.contatos;
CREATE TRIGGER audit_contatos AFTER INSERT ON public.contatos FOR EACH ROW EXECUTE FUNCTION public.process_audit_log();

DROP TRIGGER IF EXISTS audit_movimentacoes_fila ON public.movimentacoes_fila;
CREATE TRIGGER audit_movimentacoes_fila AFTER INSERT OR UPDATE OR DELETE ON public.movimentacoes_fila FOR EACH ROW EXECUTE FUNCTION public.process_audit_log();

DROP TRIGGER IF EXISTS audit_hospitais_prestadores ON public.hospitais_prestadores;
CREATE TRIGGER audit_hospitais_prestadores AFTER INSERT OR UPDATE OR DELETE ON public.hospitais_prestadores FOR EACH ROW EXECUTE FUNCTION public.process_audit_log();


-- Função de aprovação automática de movimentação
CREATE OR REPLACE FUNCTION public.apply_fila_movement()
RETURNS trigger AS $$
BEGIN
  IF (new.status = 'APROVADO' AND old.status = 'PENDENTE') THEN
    UPDATE public.fila_solicitacoes
    SET 
      classificacao_risco = COALESCE((new.valor_novo->>'classificacao_risco')::int, classificacao_risco),
      posicao_fila = CASE 
        WHEN (new.valor_novo ? 'posicao_fila') THEN (new.valor_novo->>'posicao_fila')::int 
        ELSE posicao_fila 
      END,
      updated_at = timezone('utc'::text, now())
    WHERE cod_solicitacao = new.cod_solicitacao;
  END IF;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_apply_fila_movement ON public.movimentacoes_fila;
CREATE TRIGGER trigger_apply_fila_movement AFTER UPDATE ON public.movimentacoes_fila FOR EACH ROW EXECUTE FUNCTION public.apply_fila_movement();

-- =========================================================
-- POLÍTICAS DE SEGURANÇA (RLS)
-- =========================================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pacientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.municipios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unidades_solicitantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hospitais_prestadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procedimentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cids ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fila_solicitacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.importacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fila_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contatos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimentacoes_fila ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.templates_mensagem ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracoes ENABLE ROW LEVEL SECURITY;

-- Funções helper de perfil
CREATE OR REPLACE FUNCTION public.get_user_role() RETURNS TEXT AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_user_cnes_vinculo() RETURNS TEXT AS $$
  SELECT cnes_vinculo FROM public.users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- Políticas
DROP POLICY IF EXISTS "Admins e Coordenadores gerenciam usuários" ON public.users;
CREATE POLICY "Admins e Coordenadores gerenciam usuários" ON public.users FOR ALL USING (public.get_user_role() IN ('SMS_ADMIN', 'COORDENADOR'));

DROP POLICY IF EXISTS "Visualização de perfil próprio" ON public.users;
CREATE POLICY "Visualização de perfil próprio" ON public.users FOR SELECT USING (id = auth.uid());

DROP POLICY IF EXISTS "Todos autenticados visualizam e atualizam pacientes" ON public.pacientes;
CREATE POLICY "Todos autenticados visualizam e atualizam pacientes" ON public.pacientes FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Todos autenticados inserem pacientes" ON public.pacientes;
CREATE POLICY "Todos autenticados inserem pacientes" ON public.pacientes FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Admins, Coordenadores e Operadores atualizam pacientes" ON public.pacientes;
CREATE POLICY "Admins, Coordenadores e Operadores atualizam pacientes" ON public.pacientes FOR UPDATE USING (public.get_user_role() IN ('SMS_ADMIN', 'COORDENADOR', 'OPERADOR_REGULACAO'));

DROP POLICY IF EXISTS "Apenas Admins deletam pacientes" ON public.pacientes;
CREATE POLICY "Apenas Admins deletam pacientes" ON public.pacientes FOR DELETE USING (public.get_user_role() = 'SMS_ADMIN');

-- Leitura de tabelas de apoio
DROP POLICY IF EXISTS "Leitura pública/autenticada para tabelas de apoio" ON public.municipios;
CREATE POLICY "Leitura pública/autenticada para tabelas de apoio" ON public.municipios FOR SELECT USING (true);

DROP POLICY IF EXISTS "Leitura pública/autenticada para unidades solicitantes" ON public.unidades_solicitantes;
CREATE POLICY "Leitura pública/autenticada para unidades solicitantes" ON public.unidades_solicitantes FOR SELECT USING (true);

DROP POLICY IF EXISTS "Leitura pública/autenticada para hospitais prestadores" ON public.hospitais_prestadores;
CREATE POLICY "Leitura pública/autenticada para hospitais prestadores" ON public.hospitais_prestadores FOR SELECT USING (true);

DROP POLICY IF EXISTS "Leitura pública/autenticada para procedimentos" ON public.procedimentos;
CREATE POLICY "Leitura pública/autenticada para procedimentos" ON public.procedimentos FOR SELECT USING (true);

DROP POLICY IF EXISTS "Leitura pública/autenticada para cids" ON public.cids;
CREATE POLICY "Leitura pública/autenticada para cids" ON public.cids FOR SELECT USING (true);

-- Escrita de tabelas de apoio
DROP POLICY IF EXISTS "Apenas Admins e Coordenadores escrevem nas tabelas de apoio" ON public.municipios;
CREATE POLICY "Apenas Admins e Coordenadores escrevem nas tabelas de apoio" ON public.municipios FOR ALL USING (public.get_user_role() IN ('SMS_ADMIN', 'COORDENADOR'));

DROP POLICY IF EXISTS "Apenas Admins e Coordenadores escrevem nas unidades" ON public.unidades_solicitantes;
CREATE POLICY "Apenas Admins e Coordenadores escrevem nas unidades" ON public.unidades_solicitantes FOR ALL USING (public.get_user_role() IN ('SMS_ADMIN', 'COORDENADOR'));

DROP POLICY IF EXISTS "Apenas Admins e Coordenadores escrevem nos hospitais" ON public.hospitais_prestadores;
CREATE POLICY "Apenas Admins e Coordenadores escrevem nos hospitais" ON public.hospitais_prestadores FOR ALL USING (public.get_user_role() IN ('SMS_ADMIN', 'COORDENADOR'));

DROP POLICY IF EXISTS "Apenas Admins e Coordenadores escrevem nos procedimentos" ON public.procedimentos;
CREATE POLICY "Apenas Admins e Coordenadores escrevem nos procedimentos" ON public.procedimentos FOR ALL USING (public.get_user_role() IN ('SMS_ADMIN', 'COORDENADOR'));

DROP POLICY IF EXISTS "Apenas Admins e Coordenadores escrevem nos cids" ON public.cids;
CREATE POLICY "Apenas Admins e Coordenadores escrevem nos cids" ON public.cids FOR ALL USING (public.get_user_role() IN ('SMS_ADMIN', 'COORDENADOR'));

-- Fila solicitações
DROP POLICY IF EXISTS "Usuários autenticados comuns leem solicitações" ON public.fila_solicitacoes;
CREATE POLICY "Usuários autenticados comuns leem solicitações" ON public.fila_solicitacoes FOR SELECT USING (
    (public.get_user_role() <> 'UNIDADE_USER') OR
    (public.get_user_role() = 'UNIDADE_USER' AND cnes_solicitante = public.get_user_cnes_vinculo())
);

DROP POLICY IF EXISTS "Escrita na fila restrita a admins, coord e operadores" ON public.fila_solicitacoes;
CREATE POLICY "Escrita na fila restrita a admins, coord e operadores" ON public.fila_solicitacoes FOR ALL USING (
    public.get_user_role() IN ('SMS_ADMIN', 'COORDENADOR', 'OPERADOR_REGULACAO')
);

-- Importacoes e snapshots
DROP POLICY IF EXISTS "Leitura de importações para equipe de regulação" ON public.importacoes;
CREATE POLICY "Leitura de importações para equipe de regulação" ON public.importacoes FOR SELECT USING (public.get_user_role() IN ('SMS_ADMIN', 'COORDENADOR', 'OPERADOR_REGULACAO'));

DROP POLICY IF EXISTS "Apenas admins e coordenadores gerenciam importações" ON public.importacoes;
CREATE POLICY "Apenas admins e coordenadores gerenciam importações" ON public.importacoes FOR ALL USING (public.get_user_role() IN ('SMS_ADMIN', 'COORDENADOR'));

DROP POLICY IF EXISTS "Leitura de snapshots para equipe de regulação" ON public.fila_snapshots;
CREATE POLICY "Leitura de snapshots para equipe de regulação" ON public.fila_snapshots FOR SELECT USING (public.get_user_role() IN ('SMS_ADMIN', 'COORDENADOR', 'OPERADOR_REGULACAO'));

DROP POLICY IF EXISTS "Escrita de snapshots restrita a admins e coordenadores" ON public.fila_snapshots;
CREATE POLICY "Escrita de snapshots restrita a admins e coordenadores" ON public.fila_snapshots FOR ALL USING (public.get_user_role() IN ('SMS_ADMIN', 'COORDENADOR'));

-- Contatos
DROP POLICY IF EXISTS "Visualização de contatos" ON public.contatos;
CREATE POLICY "Visualização de contatos" ON public.contatos FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Apenas operadores e coord/admins gravam contatos" ON public.contatos;
CREATE POLICY "Apenas operadores e coord/admins gravam contatos" ON public.contatos FOR ALL USING (
    public.get_user_role() IN ('SMS_ADMIN', 'COORDENADOR', 'OPERADOR_REGULACAO', 'AUXILIAR')
);

-- Movimentações
DROP POLICY IF EXISTS "Visualização de movimentações" ON public.movimentacoes_fila;
CREATE POLICY "Visualização de movimentações" ON public.movimentacoes_fila FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Operadores e auxiliares podem propor movimentações" ON public.movimentacoes_fila;
CREATE POLICY "Operadores e auxiliares podem propor movimentações" ON public.movimentacoes_fila FOR INSERT WITH CHECK (
    public.get_user_role() IN ('SMS_ADMIN', 'COORDENADOR', 'OPERADOR_REGULACAO', 'AUXILIAR')
);

DROP POLICY IF EXISTS "Médicos, Coordenadores e Admins revisam movimentações" ON public.movimentacoes_fila;
CREATE POLICY "Médicos, Coordenadores e Admins revisam movimentações" ON public.movimentacoes_fila FOR UPDATE USING (
    public.get_user_role() IN ('SMS_ADMIN', 'COORDENADOR', 'MEDICO_REGULADOR')
);

-- Auditoria
DROP POLICY IF EXISTS "Leitura de auditoria exclusiva para gestores" ON public.audit_log;
CREATE POLICY "Leitura de auditoria exclusiva para gestores" ON public.audit_log FOR SELECT USING (public.get_user_role() IN ('SMS_ADMIN', 'COORDENADOR'));

-- Templates e configs
DROP POLICY IF EXISTS "Leitura de templates para usuários autenticados" ON public.templates_mensagem;
CREATE POLICY "Leitura de templates para usuários autenticados" ON public.templates_mensagem FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Edição de templates exclusiva para gestores" ON public.templates_mensagem;
CREATE POLICY "Edição de templates exclusiva para gestores" ON public.templates_mensagem FOR ALL USING (public.get_user_role() IN ('SMS_ADMIN', 'COORDENADOR'));

DROP POLICY IF EXISTS "Leitura de configurações gerais para usuários autenticados" ON public.configuracoes;
CREATE POLICY "Leitura de configurações gerais para usuários autenticados" ON public.configuracoes FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Edição de configurações exclusiva para gestores" ON public.configuracoes;
CREATE POLICY "Edição de configurações exclusiva para gestores" ON public.configuracoes FOR ALL USING (public.get_user_role() IN ('SMS_ADMIN', 'COORDENADOR'));


-- =========================================================
-- VIEWS DE DASHBOARD & RELATORIOS (SECURITY INVOKER)
-- =========================================================

-- Dashboard views
DROP VIEW IF EXISTS public.vw_dashboard_kpis;
CREATE OR REPLACE VIEW public.vw_dashboard_kpis 
WITH (security_invoker = true)
AS
SELECT
  (SELECT COUNT(*) FROM public.fila_solicitacoes WHERE active = true) AS fila_total_ativa,
  (SELECT COUNT(*) FROM public.fila_solicitacoes WHERE active = true AND modalidade_fila = 0) AS aguardando_consultas,
  (SELECT COUNT(*) FROM public.fila_solicitacoes WHERE active = true AND modalidade_fila = 1) AS aguardando_exames,
  (SELECT COUNT(*) FROM public.fila_solicitacoes WHERE active = true AND modalidade_fila = 2) AS aguardando_cirurgias,
  (SELECT COUNT(*) FROM public.fila_solicitacoes WHERE active = true AND (modalidade_fila = 3 OR modalidade_fila IS NULL)) AS demais_procedimentos,
  COALESCE((SELECT AVG(EXTRACT(epoch FROM (now() - data_solicitacao))) / (365.25 * 86400) FROM public.fila_solicitacoes WHERE active = true), 0) AS media_espera_anos,
  (SELECT COUNT(*) FROM public.contatos WHERE created_at >= timezone('utc'::text, CURRENT_DATE)) AS contatos_hoje;

DROP VIEW IF EXISTS public.vw_dashboard_top_procedimentos;
CREATE OR REPLACE VIEW public.vw_dashboard_top_procedimentos 
WITH (security_invoker = true)
AS
SELECT 
  p.cod_sigtap,
  p.desc_sigtap,
  COUNT(*) as total
FROM public.fila_solicitacoes f
JOIN public.procedimentos p ON f.cod_sigtap = p.cod_sigtap
WHERE f.active = true
GROUP BY p.cod_sigtap, p.desc_sigtap
ORDER BY total DESC
LIMIT 10;

DROP VIEW IF EXISTS public.vw_dashboard_risco;
CREATE OR REPLACE VIEW public.vw_dashboard_risco 
WITH (security_invoker = true)
AS
SELECT 
  classificacao_risco,
  COUNT(*) as total
FROM public.fila_solicitacoes
WHERE active = true
GROUP BY classificacao_risco;

DROP VIEW IF EXISTS public.vw_dashboard_evolucao;
CREATE OR REPLACE VIEW public.vw_dashboard_evolucao 
WITH (security_invoker = true)
AS
SELECT
  id as importacao_id,
  nome_arquivo,
  COALESCE(data_exportacao_sisreg, created_at) as data_importacao,
  total_registros
FROM public.importacoes
ORDER BY COALESCE(data_exportacao_sisreg, created_at) DESC
LIMIT 10;

-- Relatórios views
DROP VIEW IF EXISTS public.vw_relatorio_espera_procedimento;
CREATE OR REPLACE VIEW public.vw_relatorio_espera_procedimento 
WITH (security_invoker = true)
AS
SELECT 
  p.cod_sigtap,
  p.desc_sigtap,
  COUNT(*) as total_pacientes,
  COALESCE(AVG(EXTRACT(epoch FROM (now() - f.data_solicitacao))) / (365.25 * 86400), 0) as media_espera_anos
FROM public.fila_solicitacoes f
JOIN public.procedimentos p ON f.cod_sigtap = p.cod_sigtap
WHERE f.active = true
GROUP BY p.cod_sigtap, p.desc_sigtap
ORDER BY media_espera_anos DESC;

DROP VIEW IF EXISTS public.vw_relatorio_espera_risco;
CREATE OR REPLACE VIEW public.vw_relatorio_espera_risco 
WITH (security_invoker = true)
AS
SELECT 
  classificacao_risco,
  COUNT(*) as total_pacientes,
  COALESCE(AVG(EXTRACT(epoch FROM (now() - data_solicitacao))) / (365.25 * 86400), 0) as media_espera_anos
FROM public.fila_solicitacoes
WHERE active = true
GROUP BY classificacao_risco;

DROP VIEW IF EXISTS public.vw_relatorio_produtividade_operador;
CREATE OR REPLACE VIEW public.vw_relatorio_produtividade_operador 
WITH (security_invoker = true)
AS
SELECT 
  u.nome as operador_nome,
  u.email as operador_email,
  COUNT(c.id) as total_contatos,
  COUNT(CASE WHEN c.resultado = 'SUCESSO_CONFIRMOU' THEN 1 END) as contatos_sucesso,
  COUNT(CASE WHEN c.resultado = 'SUCESSO_RECUSOU' THEN 1 END) as contatos_recusa,
  COUNT(CASE WHEN c.resultado = 'SEM_RESPOSTA' THEN 1 END) as contatos_sem_resposta
FROM public.contatos c
JOIN public.users u ON c.operador_id = u.id
GROUP BY u.nome, u.email;

DROP VIEW IF EXISTS public.vw_relatorio_status_distribuicao;
CREATE OR REPLACE VIEW public.vw_relatorio_status_distribuicao 
WITH (security_invoker = true)
AS
SELECT 
  status_interno,
  COUNT(*) as total
FROM public.fila_solicitacoes
WHERE active = true
GROUP BY status_interno;

-- Grants para views
GRANT SELECT ON public.vw_dashboard_kpis TO authenticated;
GRANT SELECT ON public.vw_dashboard_top_procedimentos TO authenticated;
GRANT SELECT ON public.vw_dashboard_risco TO authenticated;
GRANT SELECT ON public.vw_dashboard_evolucao TO authenticated;

GRANT SELECT ON public.vw_relatorio_espera_procedimento TO authenticated;
GRANT SELECT ON public.vw_relatorio_espera_risco TO authenticated;
GRANT SELECT ON public.vw_relatorio_produtividade_operador TO authenticated;
GRANT SELECT ON public.vw_relatorio_status_distribuicao TO authenticated;
