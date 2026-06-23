-- 1. ADICIONA COLUNA limite_playlists NA TABELA licencas
ALTER TABLE public.licencas 
ADD COLUMN IF NOT EXISTS limite_playlists integer NOT NULL DEFAULT 10;

-- 2. CRIA OU ATUALIZA O USUÁRIO ADMINISTRADOR NO AUTH.USERS E NA TABELA PUBLIC.LICENCAS
DO $$
DECLARE
    v_admin_id uuid;
    v_email text := 'vini2fernandes@gmail.com';
    v_encrypted_password text;
BEGIN
    -- 1. Remove o administrador antigo caso exista (liberando a licença 'ADMIN')
    DELETE FROM auth.users WHERE email = 'admin@midia.indoor';

    -- 2. Prepara a senha criptografada
    v_encrypted_password := crypt('13243546', gen_salt('bf', 10));

    -- 3. Verifica se o novo admin já existe
    SELECT id INTO v_admin_id FROM auth.users WHERE email = v_email;

    IF v_admin_id IS NULL THEN
        -- Cria novo usuário
        v_admin_id := gen_random_uuid();
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
            v_admin_id,
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
        );
    ELSE
        -- Atualiza senha do usuário existente
        UPDATE auth.users
        SET encrypted_password = v_encrypted_password,
            updated_at = now()
        WHERE id = v_admin_id;
    END IF;

    -- 4. Remove a licença ADMIN antiga para evitar conflitos
    DELETE FROM public.licencas WHERE codigo_ativacao = 'ADMIN';

    -- 5. Cria a licença correspondente para o novo ID do admin
    INSERT INTO public.licencas (
        id,
        codigo_ativacao,
        data_vencimento,
        status,
        limite_playlists
    )
    VALUES (
        v_admin_id,
        'ADMIN',
        '2099-12-31 23:59:59+00'::timestamp with time zone,
        'ativa',
        999
    );
END;
$$;

-- 3. ATUALIZA A FUNÇÃO public.criar_licenca PARA SEGUNDO PARÂMETRO E LIMITE
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
        status,
        limite_playlists
    )
    VALUES (
        v_user_id,
        p_codigo,
        p_validade,
        'ativa',
        p_limite_playlists
    );

    RETURN v_user_id;
END;
$$ LANGUAGE plpgsql;

-- 4. ATUALIZA AS POLÍTICAS DE RLS PARA PERMITIR ACESSO TOTAL AO ADMINISTRADOR (vini2fernandes@gmail.com)

-- POLÍTICAS: LICENÇAS
DROP POLICY IF EXISTS "Leitura da própria licença" ON public.licencas;
CREATE POLICY "Leitura da própria licença" ON public.licencas
    FOR SELECT USING (auth.uid() = id OR auth.email() = 'vini2fernandes@gmail.com');

DROP POLICY IF EXISTS "Admin gerencia todas as licencas" ON public.licencas;
CREATE POLICY "Admin gerencia todas as licencas" ON public.licencas
    FOR ALL USING (auth.email() = 'vini2fernandes@gmail.com') WITH CHECK (auth.email() = 'vini2fernandes@gmail.com');

-- POLÍTICAS: MÍDIAS
DROP POLICY IF EXISTS "Acesso total às mídias da licença" ON public.midias;
CREATE POLICY "Acesso total às mídias da licença" ON public.midias
    FOR ALL USING (auth.uid() = licenca_id OR auth.email() = 'vini2fernandes@gmail.com') 
    WITH CHECK (auth.uid() = licenca_id OR auth.email() = 'vini2fernandes@gmail.com');

-- POLÍTICAS: PLAYLISTS
DROP POLICY IF EXISTS "Acesso total às playlists da licença" ON public.playlists;
CREATE POLICY "Acesso total às playlists da licença" ON public.playlists
    FOR ALL USING (auth.uid() = licenca_id OR auth.email() = 'vini2fernandes@gmail.com') 
    WITH CHECK (auth.uid() = licenca_id OR auth.email() = 'vini2fernandes@gmail.com');

-- POLÍTICAS: ITENS DA PLAYLIST
DROP POLICY IF EXISTS "Acesso total aos itens de playlists da licença" ON public.playlist_itens;
CREATE POLICY "Acesso total aos itens de playlists da licença" ON public.playlist_itens
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.playlists p 
            WHERE p.id = playlist_id AND (p.licenca_id = auth.uid() OR auth.email() = 'vini2fernandes@gmail.com')
        )
    ) WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.playlists p 
            WHERE p.id = playlist_id AND (p.licenca_id = auth.uid() OR auth.email() = 'vini2fernandes@gmail.com')
        )
    );

-- POLÍTICAS: TVS
DROP POLICY IF EXISTS "Leitura de TV (dono ou pendente)" ON public.tvs;
CREATE POLICY "Leitura de TV (dono ou pendente)" ON public.tvs
    FOR SELECT USING (auth.uid() = licenca_id OR status = 'pendente' OR auth.email() = 'vini2fernandes@gmail.com');

DROP POLICY IF EXISTS "Atualização de TV (pareamento ou dono)" ON public.tvs;
CREATE POLICY "Atualização de TV (pareamento ou dono)" ON public.tvs
    FOR UPDATE USING (
        auth.uid() = licenca_id OR status = 'pendente' OR auth.email() = 'vini2fernandes@gmail.com'
    ) WITH CHECK (
        auth.uid() = licenca_id 
        OR (status = 'pareado' AND licenca_id = auth.uid())
        OR (status = 'pendente' AND licenca_id IS NULL)
        OR auth.email() = 'vini2fernandes@gmail.com'
    );

DROP POLICY IF EXISTS "Admin gerencia todas as tvs" ON public.tvs;
CREATE POLICY "Admin gerencia todas as tvs" ON public.tvs
    FOR ALL USING (auth.email() = 'vini2fernandes@gmail.com') WITH CHECK (auth.email() = 'vini2fernandes@gmail.com');
