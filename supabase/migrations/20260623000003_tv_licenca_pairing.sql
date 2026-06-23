-- ==========================================
-- FUNÇÃO RPC PARA PAREAMENTO DE TV POR LICENÇA (TOKEN)
-- ==========================================

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
    v_codigo_ativacao text;
BEGIN
    -- Encontra a licença correspondente
    SELECT id, status, data_vencimento, codigo_ativacao
    INTO v_licenca_id, v_status, v_vencimento, v_codigo_ativacao
    FROM public.licencas
    WHERE upper(trim(codigo_ativacao)) = upper(trim(p_codigo_licenca));

    IF v_licenca_id IS NULL THEN
        RETURN NULL;
    END IF;

    -- Verifica se a licença está ativa e não expirou
    IF v_status != 'ativa' OR v_vencimento < now() THEN
        RETURN NULL;
    END IF;

    -- Vincula a TV Box à licença. A playlist inicia como NULL (vazia)
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
        playlist_id = NULL, -- Garante que vem vazia inicialmente
        status = 'pareado';

    RETURN v_codigo_ativacao;
END;
$$ LANGUAGE plpgsql;
