-- Adiciona a coluna dias_semana na tabela playlist_itens
-- O valor padrão '{0,1,2,3,4,5,6}' representa todos os dias da semana (0 = Domingo, 1 = Segunda, etc.)
ALTER TABLE public.playlist_itens 
ADD COLUMN IF NOT EXISTS dias_semana integer[] NOT NULL DEFAULT '{0,1,2,3,4,5,6}';
