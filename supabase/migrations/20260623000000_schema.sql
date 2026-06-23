-- Habilita a extensão pgcrypto para criptografia de senhas
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. TABELA DE LICENÇAS
CREATE TABLE IF NOT EXISTS public.licencas (
    id uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY, -- Um para um com auth.users
    codigo_ativacao text NOT NULL UNIQUE,
    data_vencimento timestamp with time zone NOT NULL,
    status text NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa', 'suspensa', 'cancelada')),
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. TABELA DE MÍDIAS
CREATE TABLE IF NOT EXISTS public.midias (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    licenca_id uuid REFERENCES public.licencas(id) ON DELETE CASCADE NOT NULL,
    url_arquivo text NOT NULL,
    tipo text NOT NULL CHECK (tipo IN ('imagem', 'video')),
    nome text NOT NULL,
    tamanho_bytes bigint,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. TABELA DE PLAYLISTS
CREATE TABLE IF NOT EXISTS public.playlists (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    licenca_id uuid REFERENCES public.licencas(id) ON DELETE CASCADE NOT NULL,
    nome text NOT NULL,
    codigo text NOT NULL DEFAULT upper(substring(md5(random()::text) from 1 for 8)) UNIQUE,
    ativa boolean NOT NULL DEFAULT false,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Índice parcial para garantir que apenas uma playlist por licença esteja ativa por vez
CREATE UNIQUE INDEX IF NOT EXISTS idx_playlists_ativa_unica_por_licenca 
ON public.playlists (licenca_id) 
WHERE (ativa = true);

-- 4. TABELA DE ITENS DA PLAYLIST
CREATE TABLE IF NOT EXISTS public.playlist_itens (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    playlist_id uuid REFERENCES public.playlists(id) ON DELETE CASCADE NOT NULL,
    midia_id uuid REFERENCES public.midias(id) ON DELETE CASCADE NOT NULL,
    ordem integer NOT NULL,
    duracao_segundos integer NOT NULL DEFAULT 10, -- Relevante apenas para imagens
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. TABELA DE TVS (PAREAMENTO E CONFIGURAÇÃO)
CREATE TABLE IF NOT EXISTS public.tvs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    licenca_id uuid REFERENCES public.licencas(id) ON DELETE CASCADE, -- Nulo enquanto pendente
    codigo_pin varchar(4) NOT NULL,
    orientacao text NOT NULL DEFAULT 'horizontal' CHECK (orientacao IN ('horizontal', 'vertical', 'horizontal-invertido', 'vertical-invertido')),
    dispositivo_id uuid NOT NULL UNIQUE,
    status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'pareado')),
    codigo_ativacao_temp text, -- Usado temporariamente para transmitir o código para a TV
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==========================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.licencas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.midias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playlist_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tvs ENABLE ROW LEVEL SECURITY;

-- POLÍTICAS: LICENÇAS
DROP POLICY IF EXISTS "Leitura da própria licença" ON public.licencas;
CREATE POLICY "Leitura da própria licença" ON public.licencas
    FOR SELECT USING (auth.uid() = id);

-- POLÍTICAS: MÍDIAS
DROP POLICY IF EXISTS "Acesso total às mídias da licença" ON public.midias;
CREATE POLICY "Acesso total às mídias da licença" ON public.midias
    FOR ALL USING (auth.uid() = licenca_id) WITH CHECK (auth.uid() = licenca_id);

-- POLÍTICAS: PLAYLISTS
DROP POLICY IF EXISTS "Acesso total às playlists da licença" ON public.playlists;
CREATE POLICY "Acesso total às playlists da licença" ON public.playlists
    FOR ALL USING (auth.uid() = licenca_id) WITH CHECK (auth.uid() = licenca_id);

-- POLÍTICAS: ITENS DA PLAYLIST
DROP POLICY IF EXISTS "Acesso total aos itens de playlists da licença" ON public.playlist_itens;
CREATE POLICY "Acesso total aos itens de playlists da licença" ON public.playlist_itens
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.playlists p 
            WHERE p.id = playlist_id AND p.licenca_id = auth.uid()
        )
    ) WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.playlists p 
            WHERE p.id = playlist_id AND p.licenca_id = auth.uid()
        )
    );

-- POLÍTICAS: TVS
DROP POLICY IF EXISTS "Inserção anônima de TV pendente" ON public.tvs;
CREATE POLICY "Inserção anônima de TV pendente" ON public.tvs
    FOR INSERT WITH CHECK (status = 'pendente' AND licenca_id IS NULL);

DROP POLICY IF EXISTS "Leitura de TV (dono ou pendente)" ON public.tvs;
CREATE POLICY "Leitura de TV (dono ou pendente)" ON public.tvs
    FOR SELECT USING (auth.uid() = licenca_id OR status = 'pendente');

DROP POLICY IF EXISTS "Atualização de TV (pareamento ou dono)" ON public.tvs;
CREATE POLICY "Atualização de TV (pareamento ou dono)" ON public.tvs
    FOR UPDATE USING (
        auth.uid() = licenca_id OR status = 'pendente'
    ) WITH CHECK (
        auth.uid() = licenca_id 
        OR (status = 'pareado' AND licenca_id = auth.uid())
        OR (status = 'pendente' AND licenca_id IS NULL)
    );

-- ==========================================
-- FUNÇÃO AUXILIAR DE CRIAÇÃO DE LICENÇA (ADMIN)
-- ==========================================

CREATE OR REPLACE FUNCTION public.criar_licenca(
    p_codigo text,
    p_validade timestamp with time zone
)
RETURNS uuid
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
    v_user_id uuid;
    v_email text;
    v_encrypted_password text;
BEGIN
    v_email := lower(p_codigo) || '@midia.indoor';
    v_encrypted_password := crypt(p_codigo, gen_salt('bf', 10));
    
    -- 1. Cria o usuário na tabela auth.users
    INSERT INTO auth.users (
        instance_id,
        id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        raw_app_meta_data,
        raw_user_meta_data,
        is_super_admin,
        created_at,
        updated_at,
        confirmation_token,
        email_change,
        email_change_token_new,
        recovery_token,
        phone,
        phone_change,
        phone_change_token,
        email_change_token_current,
        reauthentication_token,
        is_sso_user,
        is_anonymous
    )
    VALUES (
        '00000000-0000-0000-0000-000000000000',
        gen_random_uuid(),
        'authenticated',
        'authenticated',
        v_email,
        v_encrypted_password,
        now(),
        '{"provider":"email","providers":["email"]}',
        '{}',
        false,
        now(),
        now(),
        '',
        '',
        '',
        '',
        NULL,
        '',
        '',
        '',
        '',
        false,
        false
    )
    RETURNING id INTO v_user_id;

    -- 2. Cria a licença correspondente
    INSERT INTO public.licencas (
        id,
        codigo_ativacao,
        data_vencimento,
        status
    )
    VALUES (
        v_user_id,
        p_codigo,
        p_validade,
        'ativa'
    );

    RETURN v_user_id;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- FUNÇÃO RPC PARA PAREAMENTO DE TV POR PLAYLIST
-- ==========================================

CREATE OR REPLACE FUNCTION public.vincular_tv_por_playlist(
    p_dispositivo_id uuid,
    p_codigo_playlist text
)
RETURNS text
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_licenca_id uuid;
    v_codigo_ativacao text;
    v_playlist_id uuid;
BEGIN
    -- Encontra a playlist correspondente e sua licença
    SELECT p.id, p.licenca_id, l.codigo_ativacao
    INTO v_playlist_id, v_licenca_id, v_codigo_ativacao
    FROM public.playlists p
    JOIN public.licencas l ON l.id = p.licenca_id
    WHERE upper(p.codigo) = upper(trim(p_codigo_playlist));

    IF v_licenca_id IS NULL THEN
        RETURN NULL;
    END IF;

    -- Define a playlist correspondente como ativa para a licença (e desativa outras)
    UPDATE public.playlists
    SET ativa = false
    WHERE licenca_id = v_licenca_id;

    UPDATE public.playlists
    SET ativa = true
    WHERE id = v_playlist_id;

    -- Vincula a TV e atualiza o status para pareado
    INSERT INTO public.tvs (
        dispositivo_id,
        licenca_id,
        status,
        codigo_pin
    )
    VALUES (
        p_dispositivo_id,
        v_licenca_id,
        'pareado',
        '0000'
    )
    ON CONFLICT (dispositivo_id) DO UPDATE
    SET licenca_id = v_licenca_id,
        status = 'pareado';

    RETURN v_codigo_ativacao;
END;
$$ LANGUAGE plpgsql;
