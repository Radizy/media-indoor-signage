-- Adiciona a coluna playlist_id na tabela tvs
ALTER TABLE public.tvs
ADD COLUMN IF NOT EXISTS playlist_id uuid REFERENCES public.playlists(id) ON DELETE SET NULL;

-- Atualiza a função public.vincular_tv_por_playlist
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

    -- Vincula a TV, associa a playlist correspondente e atualiza o status para pareado
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
        v_playlist_id,
        'pareado',
        '0000'
    )
    ON CONFLICT (dispositivo_id) DO UPDATE
    SET licenca_id = v_licenca_id,
        playlist_id = v_playlist_id,
        status = 'pareado';

    RETURN v_codigo_ativacao;
END;
$$ LANGUAGE plpgsql;
