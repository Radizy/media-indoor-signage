-- ========================================================
-- 1. ADICIONA A COLUNA USERNAME NA TABELA DE LICENÇAS
-- ========================================================

ALTER TABLE public.licencas ADD COLUMN IF NOT EXISTS username text UNIQUE;

-- Migra as licenças existentes (username inicial é o codigo_ativacao em minúsculas)
UPDATE public.licencas SET username = lower(codigo_ativacao) WHERE username IS NULL;

-- Garante que a coluna username não aceite nulo
ALTER TABLE public.licencas ALTER COLUMN username SET NOT NULL;

-- ========================================================
-- 2. FUNÇÃO RPC PARA CRIAÇÃO DE LICENÇA (ATUALIZADA)
-- ========================================================

DROP FUNCTION IF EXISTS public.criar_licenca(text, timestamp with time zone, integer);

CREATE OR REPLACE FUNCTION public.criar_licenca(
    p_codigo text,
    p_validade timestamp with time zone,
    p_limite_playlists integer DEFAULT 10
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
    v_email := lower(trim(p_codigo)) || '@midia.indoor';
    v_encrypted_password := crypt(trim(p_codigo), gen_salt('bf', 10));
    
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
        username,
        data_vencimento,
        status,
        limite_playlists
    )
    VALUES (
        v_user_id,
        upper(trim(p_codigo)),
        lower(trim(p_codigo)),
        p_validade,
        'ativa',
        p_limite_playlists
    );

    RETURN v_user_id;
END;
$$ LANGUAGE plpgsql;

-- ========================================================
-- 3. FUNÇÃO RPC PARA PAREAMENTO DE TV POR LICENÇA (ATUALIZADA)
-- ========================================================

DROP FUNCTION IF EXISTS public.vincular_tv_por_licenca(uuid, text);

CREATE OR REPLACE FUNCTION public.vincular_tv_por_licenca(
    p_dispositivo_id uuid,
    p_codigo_licenca text
)
RETURNS text
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_licenca_id uuid;
    v_status text;
    v_vencimento timestamp with time zone;
    v_username text;
BEGIN
    -- Encontra a licença correspondente pelo token
    SELECT id, status, data_vencimento, username
    INTO v_licenca_id, v_status, v_vencimento, v_username
    FROM public.licencas
    WHERE upper(trim(codigo_ativacao)) = upper(trim(p_codigo_licenca));

    IF v_licenca_id IS NULL THEN
        RETURN NULL;
    END IF;

    -- Verifica se a licença está ativa e não expirou
    IF v_status != 'ativa' OR v_vencimento < now() THEN
        RETURN NULL;
    END IF;

    -- Vincula a TV Box à licença
    INSERT INTO public.tvs (
        dispositivo_id,
        licenca_id,
        playlist_id,
        status,
        codigo_pin
    )
    VALUES (
        p_dispositivo_id,
        v_licenca_id,
        NULL,
        'pareado',
        '0000'
    )
    ON CONFLICT (dispositivo_id) DO UPDATE
    SET licenca_id = v_licenca_id,
        playlist_id = NULL,
        status = 'pareado';

    -- Retorna o username correspondente para o login automático do Player da TV
    RETURN v_username;
END;
$$ LANGUAGE plpgsql;

-- ========================================================
-- 4. FUNÇÃO RPC PARA ATUALIZAR USUÁRIO E LICENÇA
-- ========================================================

DROP FUNCTION IF EXISTS public.atualizar_licenca_e_usuario(uuid, text, text, text, timestamp with time zone, integer);

CREATE OR REPLACE FUNCTION public.atualizar_licenca_e_usuario(
    p_licenca_id uuid,
    p_novo_username text,
    p_novo_token text,
    p_novo_status text,
    p_nova_validade timestamp with time zone,
    p_novo_limite integer
)
RETURNS text
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
    v_new_email text;
    v_encrypted_password text;
    v_exists_username boolean;
    v_exists_token boolean;
BEGIN
    p_novo_username := lower(trim(p_novo_username));
    p_novo_token := upper(trim(p_novo_token));
    v_new_email := p_novo_username || '@midia.indoor';
    
    -- Verifica se o username já existe para outro usuário na tabela licencas
    SELECT EXISTS (
        SELECT 1 FROM public.licencas 
        WHERE username = p_novo_username AND id != p_licenca_id
    ) INTO v_exists_username;
    
    IF v_exists_username THEN
        RETURN 'username_duplicado';
    END IF;

    -- Verifica se o token já existe para outra licença
    SELECT EXISTS (
        SELECT 1 FROM public.licencas 
        WHERE codigo_ativacao = p_novo_token AND id != p_licenca_id
    ) INTO v_exists_token;

    IF v_exists_token THEN
        RETURN 'token_duplicado';
    END IF;

    v_encrypted_password := crypt(p_novo_username, gen_salt('bf', 10));

    -- 1. Atualiza o usuário em auth.users
    UPDATE auth.users
    SET email = v_new_email,
        encrypted_password = v_encrypted_password,
        updated_at = now()
    WHERE id = p_licenca_id;

    -- 2. Atualiza a licença em public.licencas
    UPDATE public.licencas
    SET username = p_novo_username,
        codigo_ativacao = p_novo_token,
        status = p_novo_status,
        data_vencimento = p_nova_validade,
        limite_playlists = p_novo_limite
    WHERE id = p_licenca_id;

    RETURN 'success';
END;
$$ LANGUAGE plpgsql;
