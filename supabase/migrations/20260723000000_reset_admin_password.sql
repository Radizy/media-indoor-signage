-- 20260723000000_reset_admin_password.sql
-- Redefine a senha do usuário administrador (vini2fernandes@gmail.com) para 'admin123'

DO $$
DECLARE
    v_admin_id uuid;
    v_email text := 'vini2fernandes@gmail.com';
    v_encrypted_password text;
BEGIN
    -- Criptografa a nova senha utilizando Blowfish (Pgcrypto)
    v_encrypted_password := crypt('admin123', gen_salt('bf', 10));

    -- Busca o ID do usuário no auth.users
    SELECT id INTO v_admin_id FROM auth.users WHERE email = v_email;

    IF v_admin_id IS NOT NULL THEN
        UPDATE auth.users
        SET encrypted_password = v_encrypted_password,
            updated_at = now()
        WHERE id = v_admin_id;
    END IF;
END $$;
