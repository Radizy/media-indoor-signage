-- Adiciona o campo de resolução do YouTube nos itens de playlist
ALTER TABLE public.playlist_itens 
ADD COLUMN IF NOT EXISTS youtube_res text DEFAULT 'default';

-- Adiciona campos de monitoramento de status e saúde das TV Boxes
ALTER TABLE public.tvs 
ADD COLUMN IF NOT EXISTS ultimo_ping timestamp with time zone DEFAULT now(),
ADD COLUMN IF NOT EXISTS midia_ativa_nome text,
ADD COLUMN IF NOT EXISTS midia_ativa_tipo text,
ADD COLUMN IF NOT EXISTS app_versao text DEFAULT '1.0.0';
