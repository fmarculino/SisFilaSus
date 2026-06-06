-- =========================================================
-- SCHEMA DO BANCO DE DADOS — SISFILASUS (MARABÁ)
-- =========================================================

-- 1. Habilitar extensões
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Tabela de Usuários do Sistema (Espelha auth.users)
CREATE TABLE public.users (
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
ALTER TABLE public.users ADD CONSTRAINT cnes_vinculo_required_for_unidade CHECK (
    (role <> 'UNIDADE_USER') OR 
    (role = 'UNIDADE_USER' AND cnes_vinculo IS NOT NULL)
);

-- 3. Tabela de Pacientes (CNS como Unique, ID interno UUID como PK)
CREATE TABLE public.pacientes (
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
CREATE TABLE public.municipios (
    codigo_ibge VARCHAR(10) PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    central_reguladora_nome VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Unidades Solicitantes (UBSs, Postinhos, Hospitais da Região)
CREATE TABLE public.unidades_solicitantes (
    cnes VARCHAR(10) PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    municipio_ibge VARCHAR(10) REFERENCES public.municipios(codigo_ibge) ON DELETE SET NULL,
    tipo VARCHAR(50),          -- UBS, Hospital, Secretaria, Central de Regulação
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Hospitais Prestadores / Executantes (Rede de Referência)
CREATE TABLE public.hospitais_prestadores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cnes VARCHAR(10) UNIQUE,
    nome VARCHAR(255) NOT NULL,
    especialidades TEXT[],     -- Array de especialidades atendidas
    active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. Procedimentos (SIGTAP)
CREATE TABLE public.procedimentos (
    cod_sigtap VARCHAR(10) PRIMARY KEY,
    desc_sigtap TEXT NOT NULL,
    modalidade_fila INT,       -- 0=Consulta, 1=Exame, 2=Cirurgia, 3=Demais
    grupo_codigo VARCHAR(10),
    grupo_descricao TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 8. CIDs (Código Internacional de Doenças)
CREATE TABLE public.cids (
    codigo_cid VARCHAR(10) PRIMARY KEY,
    desc_cid TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 9. Fila de Solicitações (Tabela Central unificada)
CREATE TABLE public.fila_solicitacoes (
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
CREATE TABLE public.importacoes (
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
ALTER TABLE public.fila_solicitacoes ADD CONSTRAINT fk_fila_importacao FOREIGN KEY (ultima_importacao_id) REFERENCES public.importacoes(id) ON DELETE SET NULL;

-- 11. Snapshots da Posição (Histórico de evolução temporal)
CREATE TABLE public.fila_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cod_solicitacao BIGINT NOT NULL REFERENCES public.fila_solicitacoes(cod_solicitacao) ON DELETE CASCADE,
    importacao_id UUID NOT NULL REFERENCES public.importacoes(id) ON DELETE CASCADE,
    posicao_fila INT, -- NULL se for agendado/regulado
    classificacao_risco INT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 12. Histórico de Contatos / Convocações
CREATE TABLE public.contatos (
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
CREATE TABLE public.movimentacoes_fila (
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
CREATE TABLE public.audit_log (
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
CREATE TABLE public.templates_mensagem (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    titulo VARCHAR(100) NOT NULL UNIQUE,
    corpo TEXT NOT NULL,                -- Ex: "Olá, {nome_paciente}. Seu procedimento {nome_procedimento} está na posição {posicao_fila}..."
    active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 16. Configurações Globais
CREATE TABLE public.configuracoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chave VARCHAR(100) NOT NULL UNIQUE,
    valor JSONB NOT NULL,               -- Ex: { "frequencia_importacao": "diaria", "limite_tentativas_contato": 3 }
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- =========================================================
-- ÍNDICES PARA OTIMIZAÇÃO
-- =========================================================
CREATE INDEX idx_fila_active ON public.fila_solicitacoes(active);
CREATE INDEX idx_fila_sigtap ON public.fila_solicitacoes(cod_sigtap);
CREATE INDEX idx_fila_status ON public.fila_solicitacoes(status_interno);
CREATE INDEX idx_fila_municipio ON public.fila_solicitacoes(municipio_origem_ibge);
CREATE INDEX idx_fila_risco ON public.fila_solicitacoes(classificacao_risco);
CREATE INDEX idx_snapshots_solicitacao ON public.fila_snapshots(cod_solicitacao);
CREATE INDEX idx_contatos_solicitacao ON public.contatos(cod_solicitacao);
CREATE INDEX idx_pacientes_nome ON public.pacientes USING gin (to_tsvector('portuguese', nome_usuario));
CREATE INDEX idx_audit_registro ON public.audit_log(tabela, registro_id);

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
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger correspondente para criação automática do usuário
CREATE OR REPLACE TRIGGER on_auth_user_created
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

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_pacientes_updated_at BEFORE UPDATE ON public.pacientes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_fila_solicitacoes_updated_at BEFORE UPDATE ON public.fila_solicitacoes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_movimentacoes_fila_updated_at BEFORE UPDATE ON public.movimentacoes_fila FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_templates_mensagem_updated_at BEFORE UPDATE ON public.templates_mensagem FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

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

-- Funções helper de consulta de perfil de segurança
CREATE OR REPLACE FUNCTION public.get_user_role() RETURNS TEXT AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_user_cnes_vinculo() RETURNS TEXT AS $$
  SELECT cnes_vinculo FROM public.users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- 1. Políticas: users
CREATE POLICY "Admins e Coordenadores gerenciam usuários" ON public.users FOR ALL USING (public.get_user_role() IN ('SMS_ADMIN', 'COORDENADOR'));
CREATE POLICY "Visualização de perfil próprio" ON public.users FOR SELECT USING (id = auth.uid());

-- 2. Políticas: pacientes
CREATE POLICY "Todos autenticados visualizam e atualizam pacientes" ON public.pacientes FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Todos autenticados inserem pacientes" ON public.pacientes FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Admins, Coordenadores e Operadores atualizam pacientes" ON public.pacientes FOR UPDATE USING (public.get_user_role() IN ('SMS_ADMIN', 'COORDENADOR', 'OPERADOR_REGULACAO'));
CREATE POLICY "Apenas Admins deletam pacientes" ON public.pacientes FOR DELETE USING (public.get_user_role() = 'SMS_ADMIN');

-- 3. Políticas: municípios, unidades_solicitantes, hospitais_prestadores, procedimentos, cids (Tabelas de Apoio)
CREATE POLICY "Leitura pública/autenticada para tabelas de apoio" ON public.municipios FOR SELECT USING (true);
CREATE POLICY "Leitura pública/autenticada para unidades solicitantes" ON public.unidades_solicitantes FOR SELECT USING (true);
CREATE POLICY "Leitura pública/autenticada para hospitais prestadores" ON public.hospitais_prestadores FOR SELECT USING (true);
CREATE POLICY "Leitura pública/autenticada para procedimentos" ON public.procedimentos FOR SELECT USING (true);
CREATE POLICY "Leitura pública/autenticada para cids" ON public.cids FOR SELECT USING (true);

CREATE POLICY "Apenas Admins e Coordenadores escrevem nas tabelas de apoio" ON public.municipios FOR ALL USING (public.get_user_role() IN ('SMS_ADMIN', 'COORDENADOR'));
CREATE POLICY "Apenas Admins e Coordenadores escrevem nas unidades" ON public.unidades_solicitantes FOR ALL USING (public.get_user_role() IN ('SMS_ADMIN', 'COORDENADOR'));
CREATE POLICY "Apenas Admins e Coordenadores escrevem nos hospitais" ON public.hospitais_prestadores FOR ALL USING (public.get_user_role() IN ('SMS_ADMIN', 'COORDENADOR'));
CREATE POLICY "Apenas Admins e Coordenadores escrevem nos procedimentos" ON public.procedimentos FOR ALL USING (public.get_user_role() IN ('SMS_ADMIN', 'COORDENADOR'));
CREATE POLICY "Apenas Admins e Coordenadores escrevem nos cids" ON public.cids FOR ALL USING (public.get_user_role() IN ('SMS_ADMIN', 'COORDENADOR'));

-- 4. Políticas: fila_solicitacoes
CREATE POLICY "Usuários autenticados comuns leem solicitações" ON public.fila_solicitacoes FOR SELECT USING (
    (public.get_user_role() <> 'UNIDADE_USER') OR
    (public.get_user_role() = 'UNIDADE_USER' AND cnes_solicitante = public.get_user_cnes_vinculo())
);
CREATE POLICY "Escrita na fila restrita a admins, coord e operadores" ON public.fila_solicitacoes FOR ALL USING (
    public.get_user_role() IN ('SMS_ADMIN', 'COORDENADOR', 'OPERADOR_REGULACAO')
);

-- 5. Políticas: importacoes e fila_snapshots
CREATE POLICY "Leitura de importações para equipe de regulação" ON public.importacoes FOR SELECT USING (public.get_user_role() IN ('SMS_ADMIN', 'COORDENADOR', 'OPERADOR_REGULACAO'));
CREATE POLICY "Apenas admins e coordenadores gerenciam importações" ON public.importacoes FOR ALL USING (public.get_user_role() IN ('SMS_ADMIN', 'COORDENADOR'));

CREATE POLICY "Leitura de snapshots para equipe de regulação" ON public.fila_snapshots FOR SELECT USING (public.get_user_role() IN ('SMS_ADMIN', 'COORDENADOR', 'OPERADOR_REGULACAO'));
CREATE POLICY "Escrita de snapshots restrita a admins e coordenadores" ON public.fila_snapshots FOR ALL USING (public.get_user_role() IN ('SMS_ADMIN', 'COORDENADOR'));

-- 6. Políticas: contatos
CREATE POLICY "Visualização de contatos" ON public.contatos FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Apenas operadores e coord/admins gravam contatos" ON public.contatos FOR ALL USING (
    public.get_user_role() IN ('SMS_ADMIN', 'COORDENADOR', 'OPERADOR_REGULACAO', 'AUXILIAR')
);

-- 7. Políticas: movimentacoes_fila
CREATE POLICY "Visualização de movimentações" ON public.movimentacoes_fila FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Operadores e auxiliares podem propor movimentações" ON public.movimentacoes_fila FOR INSERT WITH CHECK (
    public.get_user_role() IN ('SMS_ADMIN', 'COORDENADOR', 'OPERADOR_REGULACAO', 'AUXILIAR')
);
CREATE POLICY "Médicos, Coordenadores e Admins revisam movimentações" ON public.movimentacoes_fila FOR UPDATE USING (
    public.get_user_role() IN ('SMS_ADMIN', 'COORDENADOR', 'MEDICO_REGULADOR')
);

-- 8. Políticas: audit_log
CREATE POLICY "Leitura de auditoria exclusiva para gestores" ON public.audit_log FOR SELECT USING (public.get_user_role() IN ('SMS_ADMIN', 'COORDENADOR'));
-- Triggers específicos do banco para inserção do audit_log serão configurados na fase de auditoria.

-- 9. Políticas: templates_mensagem e configuracoes
CREATE POLICY "Leitura de templates para usuários autenticados" ON public.templates_mensagem FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Edição de templates exclusiva para gestores" ON public.templates_mensagem FOR ALL USING (public.get_user_role() IN ('SMS_ADMIN', 'COORDENADOR'));

CREATE POLICY "Leitura de configurações gerais para usuários autenticados" ON public.configuracoes FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Edição de configurações exclusiva para gestores" ON public.configuracoes FOR ALL USING (public.get_user_role() IN ('SMS_ADMIN', 'COORDENADOR'));
