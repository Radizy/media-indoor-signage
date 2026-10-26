-- Atualiza o limite de tamanho individual de arquivo do bucket 'midias' para 1GB (1073741824 bytes)
UPDATE storage.buckets
SET file_size_limit = 1073741824
WHERE id = 'midias';
