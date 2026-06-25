-- Habilita o Realtime do Supabase para as tabelas principais
DO $$
BEGIN
  -- Cria a publicação do Supabase Realtime se ela não existir
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;

  -- Adiciona playlists se não estiver na publicação
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'playlists'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.playlists;
  END IF;

  -- Adiciona playlist_itens se não estiver na publicação
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'playlist_itens'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.playlist_itens;
  END IF;

  -- Adiciona tvs se não estiver na publicação
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'tvs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tvs;
  END IF;
END $$;
