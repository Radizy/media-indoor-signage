-- ========================================================
-- 1. RE-CRIA A FUNÇÃO CRIAR_LICENÇA COM SENHA EM MINÚSCULO
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
    v_clean_code text;
BEGIN
    v_clean_code := lower(trim(p_codigo));
    v_email := v_clean_code || '@midia.indoor';
    
    -- Senha é salva sempre em minúsculo para evitar incompatibilidade de maiúsculas/minúsculas
    v_encrypted_password := crypt(v_clean_code, gen_salt('bf', 10));
    
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
        v_clean_code,
        p_validade,
        'ativa',
        p_limite_playlists
    );

    RETURN v_user_id;
END;
$$ LANGUAGE plpgsql;

-- ========================================================
-- 2. RE-CRIA A FUNÇÃO ATUALIZAR_LICENÇA COM SENHA EM MINÚSCULO
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
    v_clean_username text;
BEGIN
    v_clean_username := lower(trim(p_novo_username));
    p_novo_token := upper(trim(p_novo_token));
    v_new_email := v_clean_username || '@midia.indoor';
    
    -- Verifica se o username já existe para outro usuário na tabela licencas
    SELECT EXISTS (
        SELECT 1 FROM public.licencas 
        WHERE username = v_clean_username AND id != p_licenca_id
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

    -- Senha é salva sempre em minúsculo para evitar incompatibilidade
    v_encrypted_password := crypt(v_clean_username, gen_salt('bf', 10));

    -- 1. Atualiza o usuário em auth.users
    UPDATE auth.users
    SET email = v_new_email,
        encrypted_password = v_encrypted_password,
        updated_at = now()
    WHERE id = p_licenca_id;

    -- 2. Atualiza a licença em public.licencas
    UPDATE public.licencas
    SET username = v_clean_username,
        codigo_ativacao = p_novo_token,
        status = p_novo_status,
        data_vencimento = p_nova_validade,
        limite_playlists = p_novo_limite
    WHERE id = p_licenca_id;

    RETURN 'success';
END;
$$ LANGUAGE plpgsql;

-- ========================================================
-- 3. MIGRA OS USUÁRIOS EXISTENTES DO TIPO @MIDIA.INDOOR PARA SENHA MINÚSCULO
-- ========================================================

UPDATE auth.users
SET encrypted_password = crypt(lower(split_part(email, '@', 1)), gen_salt('bf', 10))
WHERE email LIKE '%@midia.indoor';
