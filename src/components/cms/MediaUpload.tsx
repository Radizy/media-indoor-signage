import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../App';
import { Film, Image, Trash2, Upload, Loader2 } from 'lucide-react';

interface Midia {
  id: string;
  nome: string;
  url_arquivo: string;
  tipo: 'imagem' | 'video';
  tamanho_bytes: number;
}

export const MediaUpload: React.FC = () => {
  const { licenca } = useAuth();
  const [midias, setMidias] = useState<Midia[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loadingList, setLoadingList] = useState(false);
  const [error, setError] = useState('');

  const fetchMidias = async () => {
    if (!licenca) return;
    setLoadingList(true);
    try {
      const { data, error: fetchError } = await supabase
        .from('midias')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setMidias(data || []);
    } catch (err: any) {
      console.error('Erro ao buscar mídias:', err);
      setError('Falha ao buscar mídias do servidor.');
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    fetchMidias();
  }, [licenca]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError('');
    const files = e.target.files;
    if (!files || files.length === 0 || !licenca) return;

    setUploading(true);
    const file = files[0];
    const fileExt = file.name.split('.').pop();
    const cleanFileName = `${crypto.randomUUID()}.${fileExt}`;
    const filePath = `${licenca.id}/${cleanFileName}`;

    try {
      // 1. Envia o arquivo para o storage
      const { error: uploadError } = await supabase.storage
        .from('midias')
        .upload(filePath, file, { cacheControl: '3600', upsert: true });

      if (uploadError) throw uploadError;

      // 2. Obtém a URL pública do arquivo
      const { data: { publicUrl } } = supabase.storage
        .from('midias')
        .getPublicUrl(filePath);

      // 3. Salva os metadados da mídia na tabela 'midias'
      const tipo = file.type.startsWith('video/') ? 'video' : 'imagem';
      const { error: insertError } = await supabase.from('midias').insert({
        licenca_id: licenca.id,
        url_arquivo: publicUrl,
        tipo,
        nome: file.name,
        tamanho_bytes: file.size,
      });

      if (insertError) throw insertError;

      // Atualiza a listagem
      fetchMidias();
    } catch (err: any) {
      console.error('Erro no upload:', err);
      setError(err.message || 'Falha ao realizar o upload do arquivo.');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string, url: string) => {
    if (!window.confirm('Tem certeza que deseja excluir esta mídia? Ela será removida de todas as playlists.')) return;
    setError('');

    try {
      // Tenta extrair o caminho do arquivo a partir da URL pública
      const pathParts = url.split('/storage/v1/object/public/midias/');
      if (pathParts.length > 1) {
        const filePath = pathParts[1];
        // Remove do Storage
        await supabase.storage.from('midias').remove([filePath]);
      }

      // Remove do Banco
      const { error: deleteError } = await supabase
        .from('midias')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;

      // Atualiza a listagem
      setMidias((prev) => prev.filter((m) => m.id !== id));
    } catch (err: any) {
      console.error('Erro ao deletar mídia:', err);
      setError(err.message || 'Falha ao excluir a mídia.');
    }
  };

  return (
    <div className="space-y-4">
      {/* Upload area */}
      <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-800 hover:border-indigo-500 rounded-xl p-6 text-center transition cursor-pointer bg-slate-900/30">
        <input
          type="file"
          accept="image/png, image/jpeg, image/webp, video/mp4"
          onChange={handleUpload}
          disabled={uploading}
          className="hidden"
        />
        {uploading ? (
          <div className="flex flex-col items-center">
            <Loader2 className="h-8 w-8 text-indigo-500 animate-spin" />
            <span className="mt-2 text-sm text-slate-300">Enviando mídia...</span>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <Upload className="h-8 w-8 text-slate-500 mb-2" />
            <p className="text-slate-300 text-sm font-medium">
              Clique para selecionar imagem ou vídeo
            </p>
            <span className="text-xs text-slate-500 mt-1">
              Aceita MP4, JPG, PNG e WebP
            </span>
          </div>
        )}
      </label>

      {error && <p className="text-xs text-red-400 bg-red-950/20 border border-red-900/30 p-2 rounded-lg">{error}</p>}

      {/* Media List */}
      <div className="mt-6">
        <h4 className="text-sm font-semibold text-slate-400 mb-3">Biblioteca de Mídias</h4>
        {loadingList ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 text-slate-500 animate-spin" />
          </div>
        ) : midias.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-6">Nenhuma mídia enviada ainda.</p>
        ) : (
          <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
            {midias.map((midia) => (
              <div
                key={midia.id}
                className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900 border border-slate-850 hover:border-slate-700 transition"
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  {midia.tipo === 'video' ? (
                    <Film className="h-4 w-4 text-indigo-400 shrink-0" />
                  ) : (
                    <Image className="h-4 w-4 text-cyan-400 shrink-0" />
                  )}
                  <span className="text-xs text-slate-300 truncate font-medium max-w-[180px]" title={midia.nome}>
                    {midia.nome}
                  </span>
                </div>
                <button
                  onClick={() => handleDelete(midia.id, midia.url_arquivo)}
                  className="text-slate-500 hover:text-red-400 p-1.5 rounded transition hover:bg-slate-800"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MediaUpload;
