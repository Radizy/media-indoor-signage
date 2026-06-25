-- Adiciona a coluna nome na tabela public.tvs
ALTER TABLE public.tvs 
ADD COLUMN IF NOT EXISTS nome text;
