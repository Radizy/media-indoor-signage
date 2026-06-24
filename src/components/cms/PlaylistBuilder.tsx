import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../App';
import { ToggleLeft, ToggleRight, Plus, Trash2, ArrowUp, ArrowDown, Film, Image, Loader2, ListMusic } from 'lucide-react';

interface Playlist {
  id: string;
  nome: string;
  ativa: boolean;
}

interface Midia {
  id: string;
  nome: string;
  tipo: 'imagem' | 'video';
  url_arquivo: string;
}

interface PlaylistItem {
  id: string;
  playlist_id: string;
  midia_id: string;
  ordem: number;
  duracao_segundos: number;
  dias_semana?: number[];
  midias: Midia;
}

export const PlaylistBuilder: React.FC = () => {
  const { licenca } = useAuth();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [playlistItens, setPlaylistItens] = useState<PlaylistItem[]>([]);
  const [bibliotecaMidias, setBibliotecaMidias] = useState<Midia[]>([]);
  const [novaPlaylistNome, setNovaPlaylistNome] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchPlaylists = async () => {
    if (!licenca) return;
    try {
      const { data, error: fetchError } = await supabase
        .from('playlists')
        .select('*')
        .order('created_at', { ascending: true });

      if (fetchError) throw fetchError;
      setPlaylists(data || []);
      
      // Se não houver playlist selecionada, seleciona a primeira ou a ativa
      if (data && data.length > 0 && !selectedPlaylist) {
        const ativa = data.find((p) => p.ativa) || data[0];
        setSelectedPlaylist(ativa);
      }
    } catch (err: any) {
      console.error('Erro ao buscar playlists:', err);
    }
  };

  const fetchBiblioteca = async () => {
    if (!licenca) return;
    try {
      const { data, error: fetchError } = await supabase
        .from('midias')
        .select('id, nome, tipo, url_arquivo')
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setBibliotecaMidias(data || []);
    } catch (err: any) {
      console.error('Erro ao buscar biblioteca:', err);
    }
  };

  const fetchPlaylistItens = async (playlistId: string) => {
    setLoading(true);
    try {
      const { data, error: fetchError } = await supabase
        .from('playlist_itens')
        .select('*, midias(id, nome, tipo, url_arquivo)')
        .eq('playlist_id', playlistId)
        .order('ordem', { ascending: true });

      if (fetchError) throw fetchError;
      setPlaylistItens(data || []);
    } catch (err: any) {
      console.error('Erro ao buscar itens da playlist:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlaylists();
    fetchBiblioteca();
  }, [licenca]);

  useEffect(() => {
    if (selectedPlaylist) {
      fetchPlaylistItens(selectedPlaylist.id);
    } else {
      setPlaylistItens([]);
    }
  }, [selectedPlaylist]);

  const handleCriarPlaylist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novaPlaylistNome.trim() || !licenca) return;
    setError('');

    try {
      const { data, error: insertError } = await supabase
        .from('playlists')
        .insert({
          licenca_id: licenca.id,
          nome: novaPlaylistNome.trim(),
          ativa: false,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      setNovaPlaylistNome('');
      await fetchPlaylists();
      if (data) setSelectedPlaylist(data);
    } catch (err: any) {
      console.error('Erro ao criar playlist:', err);
      setError(err.message || 'Falha ao criar playlist.');
    }
  };

  const handleDeletarPlaylist = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir esta playlist e todos os seus itens?')) return;
    setError('');

    try {
      const { error: deleteError } = await supabase
        .from('playlists')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;

      if (selectedPlaylist?.id === id) {
        setSelectedPlaylist(null);
      }
      await fetchPlaylists();
    } catch (err: any) {
      console.error('Erro ao deletar playlist:', err);
      setError(err.message || 'Falha ao excluir a playlist.');
    }
  };

  const handleAlternarAtiva = async (playlist: Playlist) => {
    setError('');
    const novoStatus = !playlist.ativa;

    try {
      if (novoStatus) {
        // Desativa todas as outras playlists primeiro
        await supabase
          .from('playlists')
          .update({ ativa: false })
          .eq('licenca_id', licenca.id);
      }

      const { error: updateError } = await supabase
        .from('playlists')
        .update({ ativa: novoStatus })
        .eq('id', playlist.id);

      if (updateError) throw updateError;

      await fetchPlaylists();
      if (selectedPlaylist?.id === playlist.id) {
        setSelectedPlaylist({ ...playlist, ativa: novoStatus });
      }
    } catch (err: any) {
      console.error('Erro ao alterar status da playlist:', err);
      setError(err.message || 'Falha ao ativar a playlist.');
    }
  };

  const handleAdicionarItem = async (mediaId: string) => {
    if (!selectedPlaylist) return;
    setError('');

    try {
      // Próxima ordem na fila
      const proximaOrdem = playlistItens.length > 0 
        ? Math.max(...playlistItens.map(i => i.ordem)) + 1 
        : 1;

      const { error: insertError } = await supabase
        .from('playlist_itens')
        .insert({
          playlist_id: selectedPlaylist.id,
          midia_id: mediaId,
          ordem: proximaOrdem,
          duracao_segundos: 10, // Padrão
        });

      if (insertError) throw insertError;

      await fetchPlaylistItens(selectedPlaylist.id);
    } catch (err: any) {
      console.error('Erro ao adicionar item:', err);
      setError(err.message || 'Falha ao adicionar mídia à playlist.');
    }
  };

  const handleRemoverItem = async (itemId: string) => {
    if (!selectedPlaylist) return;
    setError('');

    try {
      const { error: deleteError } = await supabase
        .from('playlist_itens')
        .delete()
        .eq('id', itemId);

      if (deleteError) throw deleteError;

      await fetchPlaylistItens(selectedPlaylist.id);
    } catch (err: any) {
      console.error('Erro ao remover item:', err);
      setError(err.message || 'Falha ao remover item da playlist.');
    }
  };

  const handleMudarDuracao = async (itemId: string, segundos: number) => {
    if (segundos < 1 || !selectedPlaylist) return;
    try {
      await supabase
        .from('playlist_itens')
        .update({ duracao_segundos: segundos })
        .eq('id', itemId);

      setPlaylistItens((prev) =>
        prev.map((item) =>
          item.id === itemId ? { ...item, duracao_segundos: segundos } : item
        )
      );
    } catch (err: any) {
      console.error('Erro ao atualizar duração:', err);
    }
  };

  const handleToggleDiaSemana = async (itemId: string, diasAtuais: number[], diaClicado: number) => {
    let novosDias: number[];
    if (diasAtuais.includes(diaClicado)) {
      novosDias = diasAtuais.filter((d) => d !== diaClicado);
    } else {
      novosDias = [...diasAtuais, diaClicado].sort();
    }

    try {
      const { error: updateError } = await supabase
        .from('playlist_itens')
        .update({ dias_semana: novosDias })
        .eq('id', itemId);

      if (updateError) throw updateError;

      setPlaylistItens((prev) =>
        prev.map((item) =>
          item.id === itemId ? { ...item, dias_semana: novosDias } : item
        )
      );
    } catch (err: any) {
      console.error('Erro ao atualizar dias da semana:', err);
      setError(err.message || 'Falha ao atualizar dias de exibição.');
    }
  };

  const moverItem = async (index: number, direcao: 'up' | 'down') => {
    if (!selectedPlaylist) return;
    const novoIndex = direcao === 'up' ? index - 1 : index + 1;
    if (novoIndex < 0 || novoIndex >= playlistItens.length) return;

    const listaEditada = [...playlistItens];
    const itemAtual = listaEditada[index];
    const itemAlvo = listaEditada[novoIndex];

    // Troca de ordens
    const ordemTemp = itemAtual.ordem;
    itemAtual.ordem = itemAlvo.ordem;
    itemAlvo.ordem = ordemTemp;

    try {
      // Salva no banco as novas ordens
      await supabase
        .from('playlist_itens')
        .update({ ordem: itemAtual.ordem })
        .eq('id', itemAtual.id);

      await supabase
        .from('playlist_itens')
        .update({ ordem: itemAlvo.ordem })
        .eq('id', itemAlvo.id);

      fetchPlaylistItens(selectedPlaylist.id);
    } catch (err) {
      console.error('Erro ao ordenar itens:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Playlists selectors */}
      <div className="space-y-3">
        <form onSubmit={handleCriarPlaylist} className="flex gap-2">
          <input
            type="text"
            required
            value={novaPlaylistNome}
            onChange={(e) => setNovaPlaylistNome(e.target.value)}
            placeholder="Nome da Playlist..."
            className="flex-1 rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2 text-white text-xs placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 px-3 py-2 rounded-lg text-xs transition font-semibold flex items-center gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Criar
          </button>
        </form>

        <div className="space-y-1.5 max-h-[140px] overflow-y-auto">
          {playlists.map((p) => (
            <div
              key={p.id}
              onClick={() => setSelectedPlaylist(p)}
              className={`flex items-center justify-between p-2 rounded-lg border cursor-pointer transition ${
                selectedPlaylist?.id === p.id
                  ? 'border-indigo-500/80 bg-indigo-500/10'
                  : 'border-slate-850 bg-slate-900/50 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center gap-2 overflow-hidden">
                <ListMusic className="h-4 w-4 text-slate-400 shrink-0" />
                <span className="text-xs font-semibold truncate text-slate-200">{p.nome}</span>
              </div>
              <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => handleAlternarAtiva(p)}
                  title={p.ativa ? 'Desativar na TV' : 'Ativar na TV'}
                  className="p-1 rounded hover:bg-slate-800"
                >
                  {p.ativa ? (
                    <ToggleRight className="h-5 w-5 text-indigo-400" />
                  ) : (
                    <ToggleLeft className="h-5 w-5 text-slate-500" />
                  )}
                </button>
                <button
                  onClick={() => handleDeletarPlaylist(p.id)}
                  className="text-slate-500 hover:text-red-400 p-1.5 rounded transition hover:bg-slate-800"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {error && <p className="text-xs text-red-400 bg-red-950/20 border border-red-900/30 p-2 rounded-lg">{error}</p>}

      {/* Playlist Items / Builder */}
      {selectedPlaylist && (
        <div className="pt-4 border-t border-slate-800 grid grid-cols-1 xl:grid-cols-2 gap-4">
          {/* Fila da Playlist */}
          <div>
            <h4 className="text-xs font-bold text-slate-400 mb-2.5 flex items-center justify-between">
              <span>Fila: {selectedPlaylist.nome}</span>
              {selectedPlaylist.ativa && (
                <span className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
                  Ativa na TV
                </span>
              )}
            </h4>
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 text-slate-500 animate-spin" />
              </div>
            ) : playlistItens.length === 0 ? (
              <div className="border border-dashed border-slate-800 rounded-xl p-6 text-center text-xs text-slate-500">
                Arraste ou adicione mídias da biblioteca para esta playlist.
              </div>
            ) : (
              <div className="space-y-1.5 max-h-[250px] overflow-y-auto pr-1">
                {playlistItens.map((item, index) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-slate-900/90 border border-slate-850 hover:border-slate-800"
                  >
                    <div className="flex flex-col overflow-hidden max-w-[130px] sm:max-w-[180px]">
                      <div className="flex items-center gap-2 overflow-hidden">
                        {item.midias.tipo === 'video' ? (
                          <Film className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                        ) : (
                          <Image className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                        )}
                        <span className="text-xs text-slate-300 truncate font-semibold" title={item.midias.nome}>
                          {item.midias.nome}
                        </span>
                      </div>
                      <div className="flex gap-0.5 mt-1 pl-[22px]">
                        {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((diaLabel, diaIdx) => {
                          const ativo = item.dias_semana ? item.dias_semana.includes(diaIdx) : true;
                          return (
                            <button
                              key={diaIdx}
                              onClick={() => handleToggleDiaSemana(item.id, item.dias_semana || [0,1,2,3,4,5,6], diaIdx)}
                              className={`w-3.5 h-3.5 text-[8px] font-black rounded flex items-center justify-center transition-all ${
                                ativo 
                                  ? 'bg-indigo-600 text-white font-black hover:bg-indigo-700' 
                                  : 'bg-slate-950 text-slate-600 hover:bg-slate-900 border border-slate-850'
                              }`}
                              title={`${diaLabel} (Clique para alternar)`}
                            >
                              {diaLabel}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {/* Duração se for imagem */}
                      {item.midias.tipo === 'imagem' ? (
                        <div className="flex items-center gap-1 mr-1 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-850">
                          <span className="text-[10px] text-slate-500">Seg:</span>
                          <input
                            type="number"
                            min={1}
                            value={item.duracao_segundos}
                            onChange={(e) => handleMudarDuracao(item.id, parseInt(e.target.value))}
                            className="w-8 text-[11px] text-indigo-300 font-bold bg-transparent text-center focus:outline-none"
                          />
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-500 mr-2 bg-slate-950/50 px-1.5 py-0.5 rounded border border-slate-850">Vídeo</span>
                      )}

                      {/* Ordenação */}
                      <button
                        disabled={index === 0}
                        onClick={() => moverItem(index, 'up')}
                        className="p-1 rounded text-slate-500 hover:text-indigo-400 disabled:opacity-30 hover:bg-slate-850"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        disabled={index === playlistItens.length - 1}
                        onClick={() => moverItem(index, 'down')}
                        className="p-1 rounded text-slate-500 hover:text-indigo-400 disabled:opacity-30 hover:bg-slate-850"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleRemoverItem(item.id)}
                        className="p-1 rounded text-slate-500 hover:text-red-400 hover:bg-slate-850 ml-1"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Selecionador da Biblioteca */}
          <div>
            <h4 className="text-xs font-bold text-slate-400 mb-2.5">Adicionar da Biblioteca</h4>
            {bibliotecaMidias.length === 0 ? (
              <div className="border border-dashed border-slate-800 rounded-xl p-6 text-center text-xs text-slate-500">
                Envie arquivos na aba de mídias primeiro.
              </div>
            ) : (
              <div className="space-y-1.5 max-h-[250px] overflow-y-auto pr-1">
                {bibliotecaMidias.map((midia) => (
                  <div
                    key={midia.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-slate-900 border border-slate-850 hover:bg-slate-850/30 transition"
                  >
                    <div className="flex items-center gap-2 overflow-hidden">
                      {midia.tipo === 'video' ? (
                        <Film className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                      ) : (
                        <Image className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                      )}
                      <span className="text-xs text-slate-300 truncate max-w-[150px]" title={midia.nome}>
                        {midia.nome}
                      </span>
                    </div>
                    <button
                      onClick={() => handleAdicionarItem(midia.id)}
                      className="bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600 hover:text-white px-2 py-1 rounded text-[10px] font-bold transition flex items-center gap-1"
                    >
                      <Plus className="h-3 w-3" /> Adicionar
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PlaylistBuilder;
