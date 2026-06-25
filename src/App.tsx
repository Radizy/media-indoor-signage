import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from './lib/supabase';
import { useMediaCache } from './hooks/useMediaCache';
import { 
  Folder, 
  Download, 
  Edit2, 
  Trash2, 
  Monitor, 
  ArrowLeft, 
  Plus, 
  LogOut, 
  Upload, 
  HelpCircle, 
  X, 
  Copy, 
  Check, 
  Info,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  FileVideo,
  FileImage,
  Loader2,
  User
} from 'lucide-react';

// ----------------------------------------------------
// 1. CONTEXTO DE AUTENTICAÇÃO E LICENCIAMENTO (CORE)
// ----------------------------------------------------
interface AuthContextType {
  session: Session | null;
  licenca: any | null;
  loading: boolean;
  login: (codigo: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [licenca, setLicenca] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  // Monitora alterações na sessão do Supabase
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchLicenca(session.user.id);
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        fetchLicenca(session.user.id);
      } else {
        setLicenca(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchLicenca = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('licencas')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error || !data) throw error || new Error('Licença não encontrada');

      const vencimento = new Date(data.data_vencimento).getTime();
      if (vencimento < Date.now() || data.status !== 'ativa') {
        alert('Esta licença expirou ou foi suspensa.');
        await logout();
      } else {
        setLicenca(data);
      }
    } catch (err) {
      console.error('Erro ao carregar licença:', err);
      await logout();
    } finally {
      setLoading(false);
    }
  };

  const login = async (codigo: string) => {
    const cleanCode = codigo.trim().toLowerCase();
    const email = `${cleanCode}@midia.indoor`;
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: cleanCode,
    });

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  };

  const logout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('tv_activation_code');
    setSession(null);
    setLicenca(null);
  };

  // Verificação periódica de validade (a cada 30 segundos)
  useEffect(() => {
    if (!licenca) return;

    const interval = setInterval(() => {
      const vencimento = new Date(licenca.data_vencimento).getTime();
      if (vencimento < Date.now()) {
        alert('Licença expirou durante o uso. Desconectando...');
        logout();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [licenca]);

  return (
    <AuthContext.Provider value={{ session, licenca, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  return context;
};

// ----------------------------------------------------
// 2. COMPONENTES DE ROTA PROTEGIDA
// ----------------------------------------------------
const ProtectedCMS: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-950 text-white">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-indigo-500"></div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

// ----------------------------------------------------
// 3. COMPONENTE LOGIN (CMS)
// ----------------------------------------------------
const CMSLogin: React.FC = () => {
  const { login } = useAuth();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const res = await login(code);
    if (res.success) {
      navigate('/');
    } else {
      setError('Código de ativação inválido ou vencido.');
    }
    setLoading(false);
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 overflow-hidden text-white">
      {/* Background Blobs Animados */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10 bg-[#030712]">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-600/10 rounded-full blur-[100px] animate-blob-1" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-cyan-600/10 rounded-full blur-[100px] animate-blob-2" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-violet-600/5 rounded-full blur-[120px] animate-blob-3" />
      </div>

      {/* Botão invisível no canto superior direito para ir ao admin */}
      <button
        onClick={() => navigate('/admin')}
        className="absolute top-4 right-4 w-24 h-16 opacity-0 cursor-default z-50"
        title="Área Administrativa"
      />

      <div className="w-full max-w-md rounded-2xl glass-panel p-8 shadow-2xl relative border border-slate-800/80 hover:border-indigo-500/20 transition-all duration-500">
        {/* Glow no topo do card */}
        <div className="absolute top-0 left-1/4 right-1/4 h-[1px] bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent" />

        <div className="flex flex-col items-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-indigo-600/10 border border-indigo-500/25 flex items-center justify-center mb-4 shadow-[0_0_15px_rgba(99,102,241,0.15)]">
            <Monitor className="h-7 w-7 text-indigo-400" />
          </div>
          <h2 className="text-center text-3xl font-black tracking-tight bg-gradient-to-r from-indigo-400 via-violet-400 to-cyan-400 bg-clip-text text-transparent">
            MÍDIA INDOOR
          </h2>
          <span className="text-[10px] uppercase font-bold tracking-widest text-indigo-500/80 mt-1">
            Painel de Controle CMS
          </span>
          <p className="mt-3 text-center text-xs text-slate-400 max-w-[280px]">
            Insira o código de licença da sua conta para gerenciar playlists e telas.
          </p>
        </div>

        <form className="mt-6 space-y-5" onSubmit={handleLogin}>
          <div className="space-y-1">
            <label htmlFor="license-code" className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block ml-1">
              Código de Ativação / Licença
            </label>
            <input
              id="license-code"
              type="text"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full rounded-xl border border-slate-800 bg-slate-950/70 px-4 py-3.5 text-white placeholder-slate-600 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 text-center uppercase tracking-widest font-mono text-lg font-black transition-all duration-200 shadow-inner"
              placeholder="DIGITE SEU CÓDIGO"
            />
          </div>

          {error && (
            <p className="text-xs text-red-400 text-center font-medium bg-red-950/20 border border-red-900/30 py-2 px-3 rounded-lg animate-pulse">
              ⚠️ {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-cyan-500 py-3.5 font-bold text-sm text-white hover:opacity-95 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all duration-150 flex items-center justify-center gap-2 shadow-lg shadow-indigo-950/30"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Verificando...
              </>
            ) : (
              'Acessar Painel'
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

// ----------------------------------------------------
// 4. COMPONENTE PORTAL CMS (DASHBOARD COMPLETO)
// ----------------------------------------------------
interface Playlist {
  id: string;
  nome: string;
  codigo: string;
  ativa: boolean;
  created_at: string;
  playlist_itens?: {
    midias?: {
      tamanho_bytes: number;
    } | null;
  }[];
}

interface PlaylistItem {
  id: string;
  playlist_id: string;
  midia_id: string;
  ordem: number;
  duracao_segundos: number;
  dias_semana?: number[];
  midias: {
    id: string;
    nome: string;
    tipo: 'imagem' | 'video';
    url_arquivo: string;
    tamanho_bytes: number;
  };
}

const CMSDashboard: React.FC = () => {
  const { licenca, logout } = useAuth();
  const [view, setView] = useState<'list' | 'detail'>('list');
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [currentPlaylist, setCurrentPlaylist] = useState<Playlist | null>(null);
  const [playlistItens, setPlaylistItens] = useState<PlaylistItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // TV states
  const [showTvModal, setShowTvModal] = useState(false);
  const [activeTvPlaylistId, setActiveTvPlaylistId] = useState<string | null>(null);
  
  // Gestão de TVs por Playlist
  const [tvs, setTvs] = useState<any[]>([]);

  // Profile settings state
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showMobileTvsModal, setShowMobileTvsModal] = useState(false);
  const [profileUsername, setProfileUsername] = useState(licenca?.username || '');
  const [profileSaving, setProfileSaving] = useState(false);
  const [showSpecs, setShowSpecs] = useState(false);

  useEffect(() => {
    if (licenca?.username) {
      setProfileUsername(licenca.username);
    }
  }, [licenca]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileUsername.trim() || !licenca) return;
    setProfileSaving(true);
    try {
      const { data: res, error } = await supabase.rpc('atualizar_licenca_e_usuario', {
        p_licenca_id: licenca.id,
        p_novo_username: profileUsername.trim().toLowerCase(),
        p_novo_token: licenca.codigo_ativacao,
        p_novo_status: licenca.status,
        p_nova_validade: licenca.data_vencimento,
        p_novo_limite: licenca.limite_playlists
      });

      if (error) throw error;

      if (res === 'username_duplicado') {
        alert('Este nome de usuário já está em uso por outro cliente.');
      } else {
        alert('Nome de usuário atualizado com sucesso! Por favor, faça login novamente com o seu novo usuário.');
        await logout();
      }
    } catch (err: any) {
      console.error(err);
      alert('Erro ao atualizar dados: ' + err.message);
    } finally {
      setProfileSaving(false);
    }
  };

  // Tamanho total acumulado da playlist
  const getPlaylistSize = (p: Playlist) => {
    if (!p.playlist_itens) return 0;
    return p.playlist_itens.reduce((acc, item) => {
      return acc + (item.midias?.tamanho_bytes || 0);
    }, 0);
  };

  // Carrega as playlists
  const fetchPlaylists = async () => {
    if (!licenca) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('playlists')
        .select('*, playlist_itens(*, midias(tamanho_bytes))')
        .eq('licenca_id', licenca.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setPlaylists(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Carrega a lista completa de TVs associadas a esta licença
  const fetchTvs = async () => {
    if (!licenca) return;
    try {
      const { data, error } = await supabase
        .from('tvs')
        .select('*')
        .eq('licenca_id', licenca.id);

      if (error) throw error;
      setTvs(data || []);
    } catch (err) {
      console.error('Erro ao carregar TVs:', err);
    }
  };

  // Renomeia a playlist
  const handleRenamePlaylist = async (p: Playlist) => {
    const novoNome = prompt('Digite o novo nome da playlist:', p.nome);
    if (!novoNome || !novoNome.trim() || novoNome.trim() === p.nome) return;

    try {
      const { error } = await supabase
        .from('playlists')
        .update({ nome: novoNome.trim() })
        .eq('id', p.id);

      if (error) throw error;
      fetchPlaylists();
    } catch (err) {
      console.error(err);
      alert('Falha ao renomear playlist.');
    }
  };

  // Alterna a rotação da TV em 4 posições (0, 90, 180, 270)
  const handleToggleTvOrientation = async (tv: any) => {
    const orientacoes: ('horizontal' | 'vertical' | 'horizontal-invertido' | 'vertical-invertido')[] = [
      'horizontal',
      'vertical',
      'horizontal-invertido',
      'vertical-invertido'
    ];
    const currentIndex = orientacoes.indexOf(tv.orientacao as any);
    const nextIndex = (currentIndex + 1) % orientacoes.length;
    const novaOrientacao = orientacoes[nextIndex];

    try {
      const { error } = await supabase
        .from('tvs')
        .update({ orientacao: novaOrientacao })
        .eq('id', tv.id);

      if (error) throw error;
      fetchTvs(); // Atualiza a lista em tempo real
    } catch (err) {
      console.error('Erro ao alterar orientação da TV:', err);
      alert('Erro ao alterar orientação.');
    }
  };

  // Desconecta/Desloga a TV Box da licença e playlist
  const handleDisconnectTv = async (tvId: string) => {
    if (!window.confirm('Tem certeza que deseja deslogar e desconectar este dispositivo da sua licença?')) return;
    try {
      const { error } = await supabase
        .from('tvs')
        .update({
          licenca_id: null,
          playlist_id: null,
          status: 'pendente',
          codigo_pin: '0000',
          codigo_ativacao_temp: null
        })
        .eq('id', tvId);

      if (error) throw error;
      fetchTvs();
    } catch (err) {
      console.error(err);
      alert('Erro ao desconectar dispositivo.');
    }
  };

  // Renomeia a TV com nome personalizado
  const handleRenameTv = async (tvId: string, nomeAtual: string) => {
    const novoNome = prompt('Digite o novo nome para esta TV:', nomeAtual || '');
    if (novoNome === null) return;
    
    try {
      const { error } = await supabase
        .from('tvs')
        .update({ nome: novoNome.trim() || null })
        .eq('id', tvId);

      if (error) throw error;
      fetchTvs();
    } catch (err: any) {
      console.error('Erro ao renomear TV:', err);
      alert('Erro ao renomear TV: ' + err.message);
    }
  };

  // Altera a playlist vinculada da TV no dropdown
  const handleTvPlaylistChange = async (tvId: string, playlistId: string | null) => {
    try {
      const { error } = await supabase
        .from('tvs')
        .update({ playlist_id: playlistId || null })
        .eq('id', tvId);

      if (error) throw error;
      fetchTvs();
    } catch (err: any) {
      console.error('Erro ao associar playlist:', err);
      alert('Erro ao associar playlist: ' + err.message);
    }
  };

  useEffect(() => {
    fetchPlaylists();
    fetchTvs();

    // Assina atualizações de TV em tempo real no CMS
    if (!licenca) return;
    const channel = supabase
      .channel('tv_status_channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tvs', filter: `licenca_id=eq.${licenca.id}` },
        () => {
          fetchTvs();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [licenca]);

  // Carrega itens de uma playlist aberta
  const fetchPlaylistItens = async (playlistId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('playlist_itens')
        .select('*, midias(*)')
        .eq('playlist_id', playlistId)
        .order('ordem', { ascending: true });

      if (error) throw error;
      setPlaylistItens(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Cria uma nova playlist
  const handleCriarPlaylist = async () => {
    if (playlists.length >= (licenca?.limite_playlists || 10)) {
      alert(`Você atingiu o limite de playlists permitidas para sua licença (${licenca?.limite_playlists || 10}).`);
      return;
    }
    const nome = prompt('Digite o nome da nova playlist:');
    if (!nome || !nome.trim() || !licenca) return;

    try {
      const { error } = await supabase.from('playlists').insert({
        licenca_id: licenca.id,
        nome: nome.trim(),
        ativa: false,
      });

      if (error) throw error;
      fetchPlaylists();
    } catch (err) {
      console.error(err);
      alert('Falha ao criar playlist.');
    }
  };

  // Exclui uma playlist
  const handleDeletarPlaylist = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir esta playlist?')) return;

    try {
      const { error } = await supabase.from('playlists').delete().eq('id', id);
      if (error) throw error;
      fetchPlaylists();
    } catch (err) {
      console.error(err);
      alert('Falha ao excluir a playlist.');
    }
  };

  // Abre a visualização da pasta da playlist
  const openPlaylist = (playlist: Playlist) => {
    setCurrentPlaylist(playlist);
    fetchPlaylistItens(playlist.id);
    setView('detail');
  };

  // Sobe um arquivo diretamente dentro da playlist aberta
  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !currentPlaylist || !licenca) return;

    setUploading(true);
    const file = files[0];
    const fileExt = file.name.split('.').pop();
    const cleanFileName = `${crypto.randomUUID()}.${fileExt}`;
    const filePath = `${licenca.id}/${cleanFileName}`;

    try {
      // 1. Envia arquivo para o storage
      const { error: uploadError } = await supabase.storage
        .from('midias')
        .upload(filePath, file, { cacheControl: '3600', upsert: true });

      if (uploadError) throw uploadError;

      // 2. Obtém a URL pública
      const { data: { publicUrl } } = supabase.storage
        .from('midias')
        .getPublicUrl(filePath);

      // 3. Salva na tabela midias
      const tipo = file.type.startsWith('video/') ? 'video' : 'imagem';
      const { data: midia, error: dbError } = await supabase
        .from('midias')
        .insert({
          licenca_id: licenca.id,
          url_arquivo: publicUrl,
          tipo,
          nome: file.name,
          tamanho_bytes: file.size,
        })
        .select()
        .single();

      if (dbError) throw dbError;

      // 4. Associa ao item da playlist
      const proximaOrdem = playlistItens.length > 0 
        ? Math.max(...playlistItens.map(i => i.ordem)) + 1 
        : 1;

      const { error: itemError } = await supabase
        .from('playlist_itens')
        .insert({
          playlist_id: currentPlaylist.id,
          midia_id: midia.id,
          ordem: proximaOrdem,
          duracao_segundos: 10,
        });

      if (itemError) throw itemError;

      fetchPlaylistItens(currentPlaylist.id);
    } catch (err: any) {
      console.error(err);
      alert('Erro no envio do arquivo: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleAddYoutubeLink = async () => {
    if (!currentPlaylist || !licenca) return;

    const url = prompt('Insira a URL ou ID do vídeo do YouTube:\n(Ex: https://www.youtube.com/watch?v=dQw4w9WgXcQ)');
    if (!url || !url.trim()) return;

    const cleanUrl = url.trim();
    // Validar URL do YouTube
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = cleanUrl.match(regExp);
    const videoId = (cleanUrl.length === 11) ? cleanUrl : (match && match[2].length === 11 ? match[2] : '');

    if (!videoId) {
      alert('Link do YouTube inválido. Certifique-se de colar um link válido de vídeo ou o ID de 11 caracteres.');
      return;
    }

    const nome = prompt('Nome do vídeo (opcional):', 'Vídeo do YouTube');
    const finalNome = nome && nome.trim() ? nome.trim() : 'Vídeo do YouTube';

    setUploading(true);

    try {
      // 1. Salva na tabela midias
      const { data: midia, error: dbError } = await supabase
        .from('midias')
        .insert({
          licenca_id: licenca.id,
          url_arquivo: cleanUrl,
          tipo: 'video', // 'video' por conta do check constraint
          nome: finalNome,
          tamanho_bytes: 0,
        })
        .select()
        .single();

      if (dbError) throw dbError;

      // 2. Associa ao item da playlist
      const proximaOrdem = playlistItens.length > 0 
        ? Math.max(...playlistItens.map(i => i.ordem)) + 1 
        : 1;

      const { error: itemError } = await supabase
        .from('playlist_itens')
        .insert({
          playlist_id: currentPlaylist.id,
          midia_id: midia.id,
          ordem: proximaOrdem,
          duracao_segundos: 10,
        });

      if (itemError) throw itemError;

      fetchPlaylistItens(currentPlaylist.id);
    } catch (err: any) {
      console.error(err);
      alert('Erro ao adicionar link do YouTube: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDeletarItem = async (_itemId: string, url: string, midiaId: string) => {
    if (!window.confirm('Tem certeza que deseja excluir esta mídia desta playlist?')) return;

    try {
      // Deleta do Storage
      const pathParts = url.split('/storage/v1/object/public/midias/');
      if (pathParts.length > 1) {
        const filePath = pathParts[1];
        await supabase.storage.from('midias').remove([filePath]);
      }

      // Deleta o registro na tabela midias (deletará o playlist_itens por cascade)
      const { error } = await supabase.from('midias').delete().eq('id', midiaId);
      if (error) throw error;

      fetchPlaylistItens(currentPlaylist!.id);
    } catch (err) {
      console.error(err);
      alert('Erro ao deletar arquivo.');
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
      alert('Falha ao atualizar dias de exibição: ' + err.message);
    }
  };

  // Copia o código da playlist para pareamento
  const handleCopyCode = (codigo: string) => {
    navigator.clipboard.writeText(codigo);
    setCopiedId(codigo);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Abre gerenciamento de TV
  const openTvManager = (playlistId: string) => {
    setActiveTvPlaylistId(playlistId);
    setShowTvModal(true);
  };

  // Edita duração de imagem ou nome de item da playlist
  const handleEditItem = async (item: PlaylistItem) => {
    if (item.midias.tipo === 'imagem') {
      const segundos = prompt('Digite o tempo de exibição da imagem em segundos:', item.duracao_segundos.toString());
      if (segundos === null) return;
      const num = parseInt(segundos);
      if (isNaN(num) || num < 1) {
        alert('Duração inválida.');
        return;
      }
      try {
        await supabase
          .from('playlist_itens')
          .update({ duracao_segundos: num })
          .eq('id', item.id);
        fetchPlaylistItens(currentPlaylist!.id);
      } catch (err) {
        console.error(err);
      }
    } else {
      const novoNome = prompt('Editar nome do vídeo:', item.midias.nome);
      if (!novoNome || !novoNome.trim()) return;
      try {
        await supabase
          .from('midias')
          .update({ nome: novoNome.trim() })
          .eq('id', item.midias.id);
        fetchPlaylistItens(currentPlaylist!.id);
      } catch (err) {
        console.error(err);
      }
    }
  };

  // Renderizador do painel lateral ou modal de gerenciamento de TVs
  const renderTvsManagerPanel = (isMobile: boolean = false) => {
    return (
      <div className={`glass-panel border border-slate-800/80 rounded-2xl overflow-hidden shadow-2xl flex flex-col ${isMobile ? 'h-full bg-slate-950/95' : 'bg-slate-905/40'}`}>
        <header className="px-4.5 py-4 border-b border-slate-850 flex items-center justify-between bg-slate-950/40 shrink-0">
          <h3 className="font-bold text-xs uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
            <Monitor className="h-4.5 w-4.5 text-indigo-400" />
            Minhas TVs ({tvs.length})
          </h3>
          {isMobile && (
            <button
              onClick={() => setShowMobileTvsModal(false)}
              className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-900 transition"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </header>

        <div className={`p-4.5 space-y-4 overflow-y-auto ${isMobile ? 'flex-1 max-h-[70vh]' : 'max-h-[600px]'}`}>
          <p className="text-[11px] text-slate-450 leading-relaxed">
            Direcione a programação e gerencie o nome de cada tela em tempo real.
          </p>

          {tvs.length === 0 ? (
            <div className="text-center py-8 text-slate-500 flex flex-col items-center gap-2">
              <Monitor className="h-8 w-8 text-slate-650 opacity-60 animate-pulse" />
              <p className="text-xs font-bold text-slate-400">Nenhuma TV conectada</p>
              <p className="text-[10px] text-slate-550 max-w-[200px] leading-normal mx-auto">
                Use o Token de Ativação do topo no app player para parear.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {tvs.map((tv) => {
                const displayName = tv.nome || `TV - ${tv.dispositivo_id.substring(0, 5).toUpperCase()}`;
                const isOnline = tv.status === 'pareado';
                return (
                  <div 
                    key={tv.id} 
                    className="p-3.5 rounded-xl bg-slate-950/50 border border-slate-850 hover:border-slate-800 transition-all duration-300 space-y-3 shadow-inner hover:shadow-indigo-950/5 relative group/tvcard"
                  >
                    {/* Status e Título */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span 
                          className="text-xs font-bold text-slate-200 truncate pr-1" 
                          title={displayName}
                        >
                          {displayName}
                        </span>
                        <button
                          onClick={() => handleRenameTv(tv.id, tv.nome || '')}
                          title="Renomear TV"
                          className="text-slate-500 hover:text-indigo-400 p-0.5 hover:bg-slate-900 rounded-md transition duration-150 shrink-0"
                        >
                          <Edit2 className="h-3 w-3" />
                        </button>
                      </div>

                      <span className="bg-slate-950 border border-slate-850 text-slate-450 text-[9px] px-1.5 py-0.5 rounded font-mono font-bold capitalize shrink-0">
                        {tv.orientacao ? tv.orientacao.replace('-', ' ') : 'horizontal'}
                      </span>
                    </div>

                    {/* Status Info */}
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-slate-450 font-semibold uppercase tracking-wider">Status:</span>
                      {isOnline ? (
                        <span className="text-emerald-450 font-bold uppercase font-mono tracking-wider flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
                          Online
                        </span>
                      ) : (
                        <span className="text-amber-500 font-bold uppercase font-mono tracking-wider flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-500 inline-block"></span>
                          Pendente
                        </span>
                      )}
                    </div>

                    {/* Seleção de Playlist */}
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-450 uppercase tracking-wider block">
                        Playlist Ativa
                      </label>
                      <select
                        value={tv.playlist_id || ''}
                        onChange={(e) => handleTvPlaylistChange(tv.id, e.target.value || null)}
                        className="w-full rounded-lg border border-slate-850 bg-slate-950 text-slate-200 py-1.5 px-2.5 text-xs font-semibold focus:border-indigo-500 focus:outline-none transition cursor-pointer font-sans"
                      >
                        <option value="" className="text-slate-500">Sem Programação (Desvinculada)</option>
                        {playlists.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.nome} ({p.codigo})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Ações da TV */}
                    <div className="grid grid-cols-2 gap-1.5 pt-1.5 border-t border-slate-900/60">
                      <button
                        onClick={() => handleToggleTvOrientation(tv)}
                        className="flex items-center justify-center gap-1 bg-slate-900/40 hover:bg-slate-900 border border-slate-850 hover:border-slate-800 text-slate-300 py-1.5 px-2 rounded-lg text-[10px] font-bold transition shadow-sm active:scale-95"
                        title="Girar Orientação da Tela"
                      >
                        <RotateCw className="h-3 w-3 text-slate-400" /> Girar
                      </button>
                      <button
                        onClick={() => handleDisconnectTv(tv.id)}
                        className="flex items-center justify-center gap-1 bg-red-950/10 hover:bg-red-950/20 text-red-400/90 border border-red-950/30 py-1.5 px-2 rounded-lg text-[10px] font-bold transition shadow-sm active:scale-95"
                        title="Desconectar do Painel"
                      >
                        <X className="h-3 w-3 text-red-500" /> Desconectar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  };

  // Formata o tamanho do arquivo
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = 2;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  // Formata a data dd/mm/aaaa
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  };

  return (
    <div className="min-h-screen relative text-slate-100 select-none flex flex-col overflow-x-hidden bg-[#030712]">
      {/* Background Blobs Animados */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-indigo-600/5 rounded-full blur-[120px] animate-blob-1" />
        <div className="absolute bottom-1/4 right-1/4 w-[600px] h-[600px] bg-cyan-600/5 rounded-full blur-[140px] animate-blob-2" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-violet-600/3 rounded-full blur-[160px] animate-blob-3" />
      </div>

      {/* HEADER DE NAVEGAÇÃO SUPERIOR */}
      <header className="glass-panel border-b border-slate-800/60 px-4 sm:px-6 py-4 flex flex-col md:flex-row gap-4 items-center justify-between sticky top-0 z-40 shadow-lg">
        <div className="flex items-center justify-between w-full md:w-auto gap-3">
          <div className="flex items-center gap-3">
            <Folder className="h-5 w-5 text-amber-500" />
          <div className="flex items-center gap-2 text-sm font-semibold">
            {view === 'list' ? (
              <>
                <span className="text-slate-500">/</span>
                <span className="text-slate-200"> (Playlists: {playlists.length} / {licenca?.limite_playlists || 10})</span>
              </>
            ) : (
              <>
                <span 
                  onClick={() => setView('list')} 
                  className="text-indigo-400 hover:text-indigo-300 hover:underline cursor-pointer"
                >
                  /
                </span>
                <span className="text-slate-500">/</span>
                <span className="text-slate-200 truncate max-w-[200px]" title={currentPlaylist?.nome}>
                  {currentPlaylist?.nome.toLowerCase().replace(/\s+/g, '-')}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 w-full md:w-auto justify-end flex-wrap">
          {view === 'detail' && (
            <button
              onClick={() => setView('list')}
              className="flex items-center justify-center gap-1 bg-slate-900 hover:bg-slate-800 border border-slate-800/80 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-200 shadow-sm transition active:scale-95 flex-1 md:flex-none min-w-[100px]"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> <span>Voltar</span>
            </button>
          )}
          
          {view === 'list' && (
            <button
              onClick={handleCriarPlaylist}
              className="flex items-center justify-center gap-1 bg-gradient-to-r from-indigo-600 via-indigo-500 to-indigo-400 hover:from-indigo-500 hover:to-indigo-300 border border-indigo-500/20 px-3.5 py-2 rounded-xl text-xs font-bold text-white shadow-md shadow-indigo-950/20 transition hover:-translate-y-0.5 active:scale-95 flex-1 md:flex-none min-w-[130px]"
            >
              <Plus className="h-3.5 w-3.5" /> <span>Criar Playlist</span>
            </button>
          )}

          {view === 'detail' && (
            <>
              <label className="flex items-center justify-center gap-1 bg-gradient-to-r from-emerald-600 via-emerald-500 to-emerald-400 hover:from-emerald-500 hover:to-emerald-300 border border-emerald-500/20 px-3.5 py-2 rounded-xl text-xs font-bold text-white shadow-md shadow-emerald-950/20 transition hover:-translate-y-0.5 active:scale-95 cursor-pointer flex-1 md:flex-none min-w-[120px]">
                <input
                  type="file"
                  accept="image/png, image/jpeg, image/webp, video/mp4"
                  onChange={handleUploadFile}
                  disabled={uploading}
                  className="hidden"
                />
                {uploading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Subindo...
                  </>
                ) : (
                  <>
                    <Upload className="h-3.5 w-3.5" /> Subir Mídia
                  </>
                )}
              </label>

              <button
                onClick={handleAddYoutubeLink}
                disabled={uploading}
                className="flex items-center justify-center gap-1 bg-gradient-to-r from-red-600 via-red-500 to-red-400 hover:from-red-500 hover:to-red-300 border border-red-500/20 px-3.5 py-2 rounded-xl text-xs font-bold text-white shadow-md shadow-red-950/20 transition hover:-translate-y-0.5 active:scale-95 flex-1 md:flex-none disabled:opacity-50 disabled:cursor-not-allowed min-w-[150px]"
              >
                <Plus className="h-3.5 w-3.5" /> Adicionar YouTube
              </button>
            </>
          )}

          {/* Botão de TVs visível apenas no Mobile */}
          <button
            onClick={() => setShowMobileTvsModal(true)}
            className="lg:hidden flex items-center justify-center gap-1 bg-gradient-to-r from-indigo-600 via-indigo-500 to-indigo-400 hover:from-indigo-500 hover:to-indigo-300 border border-indigo-500/20 px-3.5 py-2 rounded-xl text-xs font-bold text-white shadow-md shadow-indigo-950/20 transition hover:-translate-y-0.5 active:scale-95 flex-1 md:flex-none min-w-[120px]"
          >
            <Monitor className="h-3.5 w-3.5" /> <span>Minhas TVs</span>
          </button>

          <button
            onClick={() => setShowProfileModal(true)}
            className="flex items-center justify-center gap-1 bg-gradient-to-r from-violet-600 via-violet-500 to-violet-400 hover:from-violet-500 hover:to-violet-300 border border-violet-500/20 px-3.5 py-2 rounded-xl text-xs font-bold text-white shadow-md shadow-violet-950/20 transition hover:-translate-y-0.5 active:scale-95 flex-1 md:flex-none min-w-[120px]"
          >
            <User className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Minha Conta</span><span className="sm:hidden">Conta</span>
          </button>

          <button
            onClick={logout}
            className="flex items-center justify-center gap-1 bg-slate-905 hover:bg-red-950/30 border border-red-900/30 px-3.5 py-2 rounded-xl text-xs font-bold text-red-400 hover:text-red-300 transition-all flex-1 md:flex-none min-w-[90px]"
          >
            <LogOut className="h-3.5 w-3.5" /> <span>Sair</span>
          </button>
        </div>
      </header>

      {/* CONTAINER PRINCIPAL */}
      <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* COLUNA ESQUERDA: CONTEÚDO PRINCIPAL (8/9 colunas no desktop) */}
          <div className="lg:col-span-8 xl:col-span-9 space-y-6">
            {/* BANNER DE BOAS-VINDAS E ORIENTAÇÕES */}
            <div className="glass-panel border border-slate-800/80 rounded-2xl p-4 sm:p-6 shadow-xl space-y-4 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-44 h-44 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none -z-10 group-hover:bg-indigo-500/10 transition-all duration-500" />
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-850">
            <div>
              <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                Olá, <span className="bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent capitalize font-black">{licenca?.username || 'Cliente'}</span>! 👋
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Gerencie suas mídias e monitore o status de suas telas de forma simples.
              </p>
            </div>
            <div className="flex items-center justify-between w-full md:w-auto gap-2 bg-slate-950/80 border border-slate-800/80 px-3.5 py-2.5 rounded-xl shrink-0 hover:border-indigo-500/20 transition-all duration-300">
              <div className="text-left">
                <p className="text-[10px] uppercase font-black text-indigo-400 tracking-wider">Token de Ativação TV</p>
                <p className="text-sm font-mono font-black text-indigo-300 tracking-widest uppercase select-all">{licenca?.codigo_ativacao}</p>
              </div>
              <button
                onClick={() => handleCopyCode(licenca?.codigo_ativacao)}
                className="bg-slate-900 hover:bg-slate-800 border border-slate-800 p-1.5 rounded-lg text-indigo-400 hover:text-indigo-300 transition shadow-sm ml-1"
                title="Copiar Token"
              >
                {copiedId === licenca?.codigo_ativacao ? (
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          </div>

          <div className="space-y-3.5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-950/40 border border-slate-800/60 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 text-indigo-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-slate-200">
                    Requisitos e Limites de Mídia
                  </h3>
                  <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-slate-400 font-medium">
                    <span>• Arquivos até <strong className="text-slate-100">99MB</strong></span>
                    <span>• Vídeos em <strong className="text-slate-100">MP4</strong></span>
                    <span>• Imagens em <strong className="text-slate-100">JPG ou PNG</strong></span>
                  </div>
                </div>
              </div>
              
              <button
                onClick={() => setShowSpecs(!showSpecs)}
                className="flex items-center justify-center gap-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 px-3.5 py-2.5 rounded-xl text-xs font-semibold shadow-sm transition w-full md:w-auto"
              >
                {showSpecs ? (
                  <>
                    Ocultar Resoluções Ideais <ChevronUp className="h-3.5 w-3.5 text-slate-400" />
                  </>
                ) : (
                  <>
                    Ver Resoluções Ideais <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                  </>
                )}
              </button>
            </div>

            {showSpecs && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 border border-slate-800/80 rounded-2xl p-5 bg-slate-950/40 animate-fade-in">
                {/* Horizontal */}
                <div className="bg-slate-900/40 border border-slate-850 p-5 rounded-2xl space-y-4 hover:border-indigo-500/20 transition-all duration-300 shadow-inner">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 border-b border-slate-850 pb-2">
                    📺 Horizontal (Modo Paisagem)
                  </h4>
                  <div className="divide-y divide-slate-850/60 text-xs">
                    <div className="py-2.5 flex justify-between items-center">
                      <span className="font-semibold text-slate-300">1080p (Full HD - Recomendado)</span>
                      <span className="bg-indigo-950/60 border border-indigo-900/50 text-indigo-300 font-mono font-bold text-[11px] px-2 py-0.5 rounded-lg">1920px x 1080px</span>
                    </div>
                    <div className="py-2.5 flex justify-between items-center">
                      <span className="font-semibold text-slate-350">2K (Quad HD)</span>
                      <span className="bg-slate-900 border border-slate-800 text-slate-400 font-mono font-bold text-[11px] px-2 py-0.5 rounded-lg">2560px x 1440px</span>
                    </div>
                    <div className="py-2.5 flex justify-between items-center">
                      <span className="font-semibold text-slate-350">4K (Ultra HD)</span>
                      <span className="bg-slate-900 border border-slate-800 text-slate-400 font-mono font-bold text-[11px] px-2 py-0.5 rounded-lg">3840px x 2160px</span>
                    </div>
                  </div>
                </div>

                {/* Vertical */}
                <div className="bg-slate-900/40 border border-slate-850 p-5 rounded-2xl space-y-4 hover:border-indigo-500/20 transition-all duration-300 shadow-inner">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 border-b border-slate-850 pb-2">
                    📱 Vertical (Modo Retrato)
                  </h4>
                  <div className="divide-y divide-slate-850/60 text-xs">
                    <div className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <span className="font-semibold text-slate-300">1080p (Full HD - Recomendado)</span>
                      <span className="bg-indigo-950/60 border border-indigo-900/50 text-indigo-300 font-mono font-bold text-[11px] px-2 py-0.5 rounded-lg w-fit">1080px x 1920px</span>
                    </div>
                    <div className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <span className="font-semibold text-slate-350">2K (Quad HD)</span>
                      <span className="bg-slate-900 border border-slate-800 text-slate-400 font-mono font-bold text-[11px] px-2 py-0.5 rounded-lg w-fit">1440px x 2560px</span>
                    </div>
                    <div className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <span className="font-semibold text-slate-350">4K (Ultra HD)</span>
                      <span className="bg-slate-900 border border-slate-800 text-slate-400 font-mono font-bold text-[11px] px-2 py-0.5 rounded-lg w-fit">2160px x 3840px</span>
                    </div>
                  </div>
                </div>

                {/* Informação Técnica e Alerta */}
                <div className="col-span-1 md:col-span-2 bg-rose-950/15 border border-rose-900/30 rounded-2xl p-5 flex items-start gap-3.5 text-rose-200 shadow-sm animate-pulse-glow">
                  <AlertTriangle className="h-5 w-5 text-rose-450 shrink-0 mt-0.5" />
                  <div className="space-y-2 text-xs text-rose-350">
                    <h5 className="font-bold text-rose-450 uppercase tracking-wider text-[10px]">Diretrizes de Desempenho e Compatibilidade (TV Box)</h5>
                    <p className="leading-relaxed">
                      • <strong className="text-rose-200">Evite usar qualidades 2K ou 4K e vídeos de 60fps</strong>. A grande maioria das TV Boxes comerciais do mercado (MX9, Aquário, etc.) possuem processadores modestos que travam ou engasgam ao renderizar essas resoluções.
                    </p>
                    <p className="leading-relaxed">
                      • <strong className="text-rose-200">Ajuste de FPS & Bitrate recomendado:</strong> Para 1080p, configure seus vídeos para <strong className="text-rose-200">30fps</strong> com bitrate máximo de <strong className="text-rose-200">6 Mbps (Codec H.264)</strong>. Isso garante reprodução fluida e sem travamentos por superaquecimento.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-2 pt-1 w-full">
            <a href="https://microcosmo.io" target="_blank" rel="noreferrer" className="flex items-center justify-center gap-1 bg-slate-900/60 hover:bg-slate-855 border border-slate-800 px-3.5 py-2.5 rounded-xl text-xs font-bold text-slate-200 transition shadow-sm w-full sm:w-auto">
              <HelpCircle className="h-3.5 w-3.5 text-indigo-400" /> Como otimizar mídias
            </a>
            <button className="flex items-center justify-center gap-1 bg-slate-950/40 border border-slate-900/40 text-slate-500 opacity-40 px-3.5 py-2.5 rounded-xl text-xs font-bold transition cursor-not-allowed w-full sm:w-auto">
              Ajuda (em breve)
            </button>
          </div>
        </div>
        {/* LISTAGEM DE PLAYLISTS (PASTA PRINCIPAL) */}
        {view === 'list' && (
          <div className="glass-panel border border-slate-800/80 rounded-2xl overflow-hidden shadow-2xl animate-fade-in">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-24 gap-4">
                <Loader2 className="h-8 w-8 text-indigo-400 animate-spin" />
                <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Carregando playlists...</span>
              </div>
            ) : playlists.length === 0 ? (
              <div className="text-center py-20 text-slate-500 flex flex-col items-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-slate-950/60 border border-slate-850 flex items-center justify-center text-slate-600 mb-2">
                  <Folder className="h-6 w-6" />
                </div>
                <p className="text-sm font-bold text-slate-350">Nenhuma playlist encontrada</p>
                <p className="text-xs text-slate-550 max-w-[280px]">Clique em "Criar Playlist" no canto superior direito para iniciar seu canal de mídia.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-850/60">
                {playlists.map((p) => (
                  <div
                    key={p.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-5 hover:bg-indigo-500/[0.02] transition-all duration-300 border-b border-slate-850 last:border-0 hover:-translate-y-0.5 shadow-sm hover:shadow-indigo-950/5 gap-4 group"
                  >
                    <div 
                      onClick={() => openPlaylist(p)}
                      className="flex items-center gap-3 cursor-pointer overflow-hidden w-full sm:flex-1"
                    >
                      <div className="flex items-center gap-3 overflow-hidden flex-wrap">
                        <span className="text-sm font-bold text-slate-200 truncate group-hover:text-indigo-400 transition-colors duration-200" title={p.nome}>
                          Playlist: {p.nome}
                        </span>

                        {/* Botão de Renomear Playlist */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRenamePlaylist(p);
                          }}
                          title="Renomear Playlist"
                          className="text-slate-550 hover:text-indigo-455 p-1 hover:bg-slate-900 rounded-lg transition shrink-0"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>

                        {/* Botão de TV com contagem de dispositivos */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openTvManager(p.id);
                          }}
                          title="Dispositivos vinculados a esta playlist (Ver/Desconectar)"
                          className="bg-indigo-950/40 hover:bg-indigo-900/30 border border-indigo-900/50 text-indigo-300 text-[10px] px-2.5 py-0.5 rounded-lg font-mono font-bold shrink-0 flex items-center gap-1 transition shadow-sm"
                        >
                          <Monitor className="h-3.5 w-3.5" />
                          <span>{tvs.filter(t => t.playlist_id === p.id).length} TVs</span>
                        </button>

                        <span className="bg-slate-950 border border-slate-850 text-slate-400 text-[10px] px-2 py-0.5 rounded-lg font-mono font-bold shrink-0">
                          Tamanho: {formatBytes(getPlaylistSize(p))}
                        </span>

                        <span className="bg-indigo-950/40 border border-indigo-900/40 text-indigo-300 text-[10px] px-2 py-0.5 rounded-lg font-mono font-bold shrink-0 tracking-wider">
                          Código TV: {p.codigo}
                        </span>
                        
                        <span className="text-[10px] text-slate-500 shrink-0 font-semibold uppercase tracking-wider font-mono">
                          {formatDate(p.created_at)}
                        </span>
                        
                        {p.ativa && (
                          <span className="relative flex h-2 w-2 ml-1 shrink-0">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                          </span>
                        )}
                        {p.ativa && (
                          <span className="bg-emerald-950/50 border border-emerald-900/30 text-emerald-400 px-2 py-0.5 rounded-lg text-[9px] font-bold uppercase tracking-wider shrink-0">
                            Ativa
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end border-t border-slate-900/60 pt-3 sm:border-t-0 sm:pt-0 sm:ml-4 shrink-0">
                      {/* Botão de Copiar Código da Playlist */}
                      <button
                        onClick={() => handleCopyCode(p.codigo)}
                        title="Copiar Código da Playlist"
                        className="bg-slate-950/80 hover:bg-slate-900 border border-slate-850 p-2.5 rounded-xl text-slate-400 hover:text-slate-100 transition-all duration-200 flex items-center justify-center gap-1.5 shadow-sm active:scale-95 flex-1 sm:flex-none"
                      >
                        <span className="text-[10px] font-bold text-slate-400 font-mono hidden md:inline tracking-wider">
                          CÓDIGO: {p.codigo}
                        </span>
                        {copiedId === p.codigo ? (
                          <Check className="h-4 w-4 text-emerald-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </button>

                      {/* Botão de Abrir/Editar Playlist */}
                      <button
                        onClick={() => openPlaylist(p)}
                        title="Editar Itens"
                        className="bg-slate-950/80 hover:bg-slate-900 border border-cyan-900/40 hover:border-cyan-800 p-2.5 rounded-xl text-cyan-400 hover:bg-cyan-950/20 transition-all duration-200 shadow-sm active:scale-95 flex items-center justify-center flex-1 sm:flex-none"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>

                      {/* Botão de Deletar Playlist */}
                      <button
                        onClick={() => handleDeletarPlaylist(p.id)}
                        title="Deletar Playlist"
                        className="bg-slate-950/80 hover:bg-slate-900 border border-red-900/40 hover:border-red-800 p-2.5 rounded-xl text-red-400 hover:bg-red-950/20 transition-all duration-200 shadow-sm active:scale-95 flex items-center justify-center flex-1 sm:flex-none"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* LISTAGEM DE ARQUIVOS (DENTRO DE UMA PLAYLIST) */}
        {view === 'detail' && currentPlaylist && (
          <div className="glass-panel border border-slate-800/80 rounded-2xl overflow-hidden shadow-2xl animate-fade-in">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-24 gap-4">
                <Loader2 className="h-8 w-8 text-indigo-400 animate-spin" />
                <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Carregando itens da playlist...</span>
              </div>
            ) : playlistItens.length === 0 ? (
              <div className="text-center py-20 text-slate-500 flex flex-col items-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-slate-950/60 border border-slate-850 flex items-center justify-center text-slate-600 mb-2">
                  <Upload className="h-6 w-6 animate-bounce text-slate-400" />
                </div>
                <p className="text-sm font-bold text-slate-350">Esta playlist está vazia</p>
                <p className="text-xs text-slate-550 max-w-[280px]">Selecione "Subir Mídia" no menu superior para adicionar suas imagens ou vídeos.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-850/60">
                {playlistItens.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-5 hover:bg-indigo-500/[0.02] transition-all duration-300 border-b border-slate-850 last:border-0 hover:-translate-y-0.5 shadow-sm hover:shadow-indigo-950/5 gap-4 group"
                  >
                    <div className="flex items-center gap-3 overflow-hidden w-full sm:flex-1">
                      <div className="w-10 h-10 rounded-xl bg-slate-950/80 border border-slate-850 flex items-center justify-center shrink-0 shadow-inner group-hover:border-indigo-500/20 transition-all duration-300">
                        {isYouTubeUrl(item.midias.url_arquivo) ? (
                          <svg className="h-5 w-5 text-red-500 fill-current" viewBox="0 0 24 24">
                            <path d="M23.498 6.163a3.003 3.003 0 0 0-2.11-2.108C19.52 3.5 12 3.5 12 3.5s-7.52 0-9.388.555a3.002 3.002 0 0 0-2.11 2.108C0 8.03 0 12 0 12s0 3.97.502 5.837a3.003 3.003 0 0 0 2.11 2.108C4.48 20.5 12 20.5 12 20.5s7.52 0 9.388-.555a3.002 3.002 0 0 0 2.11-2.108C24 15.97 24 12 24 12s0-3.97-.502-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                          </svg>
                        ) : item.midias.tipo === 'video' ? (
                          <FileVideo className="h-5 w-5 text-red-400" />
                        ) : (
                          <FileImage className="h-5 w-5 text-emerald-400" />
                        )}
                      </div>
                      <div className="flex flex-col gap-1.5 overflow-hidden">
                        <div className="flex items-center gap-3 overflow-hidden flex-wrap">
                          <span className="text-xs font-bold text-slate-200 truncate group-hover:text-indigo-400 transition-colors duration-200 max-w-[200px] sm:max-w-xs" title={item.midias.nome}>
                            {item.midias.nome}
                          </span>
                          <span className="text-[10px] text-slate-500 font-semibold font-mono shrink-0">
                            {isYouTubeUrl(item.midias.url_arquivo) ? '(YouTube)' : `(${formatBytes(item.midias.tamanho_bytes)})`}
                          </span>
                          {item.midias.tipo === 'imagem' ? (
                            <span className="bg-indigo-950/40 border border-indigo-900/40 text-indigo-300 text-[10px] px-2 py-0.5 rounded-lg font-bold font-mono shrink-0">
                              Exibição: {item.duracao_segundos}s
                            </span>
                          ) : isYouTubeUrl(item.midias.url_arquivo) ? (
                            <span className="bg-red-950/60 border border-red-900/50 text-red-300 text-[10px] px-2 py-0.5 rounded-lg font-bold font-mono shrink-0">
                              Vídeo (YouTube)
                            </span>
                          ) : (
                            <span className="bg-slate-950 border border-slate-850 text-slate-400 text-[10px] px-2 py-0.5 rounded-lg font-bold font-mono shrink-0">
                              Vídeo (MP4)
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Exibir em:</span>
                          <div className="flex gap-0.5">
                            {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((diaLabel, diaIdx) => {
                              const ativo = item.dias_semana ? item.dias_semana.includes(diaIdx) : true;
                              return (
                                <button
                                  key={diaIdx}
                                  onClick={() => handleToggleDiaSemana(item.id, item.dias_semana || [0,1,2,3,4,5,6], diaIdx)}
                                  className={`w-5 h-5 text-[10px] font-bold rounded flex items-center justify-center transition-all ${
                                    ativo 
                                      ? 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.3)]' 
                                      : 'bg-slate-950 text-slate-500 border border-slate-850 hover:bg-slate-900 hover:text-slate-300'
                                  }`}
                                  title={`${diaLabel} (Clique para alternar)`}
                                >
                                  {diaLabel}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end border-t border-slate-900/60 pt-3 sm:border-t-0 sm:pt-0 sm:ml-4 shrink-0">
                      {/* Botão de Download */}
                      <a
                        href={item.midias.url_arquivo}
                        target="_blank"
                        rel="noreferrer"
                        title={isYouTubeUrl(item.midias.url_arquivo) ? "Assistir no YouTube" : "Visualizar / Download"}
                        className="bg-slate-950/80 hover:bg-slate-900 border border-slate-850 p-2.5 rounded-xl text-slate-400 hover:text-slate-100 transition-all duration-200 flex items-center justify-center shadow-sm active:scale-95 flex-1 sm:flex-none"
                      >
                        {isYouTubeUrl(item.midias.url_arquivo) ? (
                          <svg className="h-4 w-4 text-red-500 fill-current" viewBox="0 0 24 24">
                            <path d="M23.498 6.163a3.003 3.003 0 0 0-2.11-2.108C19.52 3.5 12 3.5 12 3.5s-7.52 0-9.388.555a3.002 3.002 0 0 0-2.11 2.108C0 8.03 0 12 0 12s0 3.97.502 5.837a3.003 3.003 0 0 0 2.11 2.108C4.48 20.5 12 20.5 12 20.5s7.52 0 9.388-.555a3.002 3.002 0 0 0 2.11-2.108C24 15.97 24 12 24 12s0-3.97-.502-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                          </svg>
                        ) : (
                          <Download className="h-4 w-4" />
                        )}
                      </a>

                      {/* Botão de Editar configurações de item */}
                      <button
                        onClick={() => handleEditItem(item)}
                        title={item.midias.tipo === 'imagem' ? 'Editar Tempo' : 'Editar Nome'}
                        className="bg-slate-950/80 hover:bg-slate-900 border border-cyan-900/40 hover:border-cyan-800 p-2.5 rounded-xl text-cyan-400 hover:bg-cyan-950/20 transition-all duration-200 shadow-sm active:scale-95 flex items-center justify-center flex-1 sm:flex-none"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      
                      {/* Botão de Deletar item */}
                      <button
                        onClick={() => handleDeletarItem(item.id, item.midias.url_arquivo, item.midias.id)}
                        title="Remover da Playlist"
                        className="bg-slate-950/80 hover:bg-slate-900 border border-red-900/40 hover:border-red-800 p-2.5 rounded-xl text-red-400 hover:bg-red-950/20 transition-all duration-200 shadow-sm active:scale-95 flex items-center justify-center flex-1 sm:flex-none"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
          </div>

          {/* COLUNA DIREITA: GERENCIAMENTO DE TVS (Apenas no desktop - lg:block) */}
          <div className="hidden lg:block lg:col-span-4 xl:col-span-3 shrink-0">
            {renderTvsManagerPanel(false)}
          </div>

        </div>
      </main>

      {/* MODAL DE CONTROLE E PAREAMENTO DA TV */}
      {showTvModal && activeTvPlaylistId && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="glass-panel rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col text-slate-100 border border-slate-800/80 max-h-[90vh]">
            <header className="px-5 py-4 border-b border-slate-850 flex items-center justify-between bg-slate-950/40 backdrop-blur-sm">
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
                <Monitor className="h-4.5 w-4.5 text-indigo-400" />
                Painel de Controle da TV
              </h3>
              <button
                onClick={() => {
                  setShowTvModal(false);
                  setActiveTvPlaylistId(null);
                }}
                className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-900 transition active:scale-95"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="p-5 space-y-4 overflow-y-auto">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Playlist: <span className="bg-indigo-950/50 border border-indigo-900/30 text-indigo-300 text-[10px] px-2 py-0.5 rounded-lg font-bold ml-1 font-mono">
                  {playlists.find(p => p.id === activeTvPlaylistId)?.nome}
                </span>
              </div>

              {tvs.filter(t => t.playlist_id === activeTvPlaylistId).length === 0 ? (
                // TV pendente de pareamento
                <div className="space-y-4">
                  <div className="p-3.5 bg-amber-950/20 border border-amber-900/30 text-amber-300 text-xs rounded-xl font-medium leading-relaxed">
                    Nenhuma TV vinculada a esta playlist ainda. Para parear, acesse a rota <span className="font-bold">/tv</span> no navegador da TV Box e digite o código desta playlist:
                  </div>
                  <div className="bg-slate-950/60 border border-slate-850 p-4 rounded-xl text-center shadow-inner">
                    <span className="text-3xl font-mono font-black text-indigo-400 tracking-widest select-all">
                      {playlists.find(p => p.id === activeTvPlaylistId)?.codigo || '------'}
                    </span>
                  </div>
                </div>
              ) : (
                // TVs pareadas e ativas
                <div className="divide-y divide-slate-850 max-h-72 overflow-y-auto pr-1 space-y-1">
                  {tvs.filter(t => t.playlist_id === activeTvPlaylistId).map((tv) => (
                    <div key={tv.id} className="py-3.5 flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="bg-emerald-950/60 text-emerald-400 p-2 rounded-xl border border-emerald-900/30 flex items-center justify-center shadow-inner animate-pulse-glow">
                            <Monitor className="h-4 w-4" />
                          </div>
                          <div>
                            <span className="text-xs font-bold text-slate-200 block truncate max-w-[180px]" title={tv.dispositivo_id}>
                              ID: {tv.dispositivo_id.substring(0, 8)}...
                            </span>
                            <span className="text-[10px] text-emerald-450 font-semibold uppercase font-mono tracking-wider flex items-center gap-1">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
                              Online
                            </span>
                          </div>
                        </div>
                        
                        <span className="bg-slate-950 border border-slate-850 text-slate-350 text-[10px] px-2 py-0.5 rounded-lg capitalize font-bold font-mono">
                          {tv.orientacao.replace('-', ' ')}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => handleToggleTvOrientation(tv)}
                          className="flex items-center justify-center gap-1 bg-slate-950 hover:bg-slate-900 border border-slate-850 text-slate-200 py-2 px-3 rounded-xl text-xs font-bold transition shadow-sm active:scale-95 hover:border-slate-700 w-full"
                        >
                          <RotateCw className="h-3.5 w-3.5" /> Girar Tela
                        </button>
                        <button
                          onClick={() => handleDisconnectTv(tv.id)}
                          className="flex items-center justify-center gap-1 bg-red-950/20 hover:bg-red-900/30 text-red-400 border border-red-900/20 py-2 px-3 rounded-xl text-xs font-bold transition shadow-sm active:scale-95 w-full"
                        >
                          <X className="h-3.5 w-3.5" /> Desconectar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <footer className="px-5 py-3.5 border-t border-slate-850 bg-slate-950/40 backdrop-blur-sm flex justify-end">
              <button
                onClick={() => {
                  setShowTvModal(false);
                  setActiveTvPlaylistId(null);
                }}
                className="bg-slate-900 hover:bg-slate-850 text-slate-300 font-bold text-xs py-2 px-4.5 rounded-xl transition active:scale-95 border border-slate-800"
              >
                Fechar
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* MODAL MINHA CONTA */}
      {showProfileModal && licenca && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="glass-panel rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col text-slate-100 border border-slate-800/80 max-h-[90vh]">
            <header className="px-5 py-4 border-b border-slate-850 flex items-center justify-between bg-slate-950/40 backdrop-blur-sm">
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
                <User className="h-4.5 w-4.5 text-indigo-400" />
                Minha Conta
              </h3>
              <button
                onClick={() => {
                  setShowProfileModal(false);
                  setProfileUsername(licenca.username || '');
                }}
                className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-900 transition active:scale-95"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <form onSubmit={handleSaveProfile} className="p-5 space-y-5 overflow-y-auto">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5 ml-1">Nome de Usuário</label>
                <input
                  type="text"
                  required
                  value={profileUsername}
                  onChange={(e) => setProfileUsername(e.target.value.replace(/[^a-zA-Z0-9]/g, ''))}
                  className="w-full rounded-xl bg-slate-950/80 border border-slate-850 px-3.5 py-3 text-slate-150 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 font-bold text-xs shadow-inner"
                  placeholder="Seu nome de usuário para login"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5 ml-1">Token de Ativação das TVs</label>
                <div className="bg-slate-950/60 border border-slate-850 rounded-xl p-3.5 text-center shadow-inner hover:border-indigo-500/20 transition-all duration-300">
                  <span className="font-mono text-base font-black text-indigo-400 tracking-widest select-all">
                    {licenca.codigo_ativacao}
                  </span>
                  <p className="text-[9px] text-slate-500 mt-1 uppercase font-bold tracking-wider">
                    Use este token para ativar e parear novas TVs no app player
                  </p>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1 ml-1">Vencimento da Licença</label>
                <p className="text-xs font-bold text-slate-200 ml-1">
                  📅 {new Date(licenca.data_vencimento).toLocaleDateString('pt-BR')}
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-slate-850 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowProfileModal(false);
                    setProfileUsername(licenca.username || '');
                  }}
                  className="bg-slate-900 hover:bg-slate-855 text-slate-355 font-bold text-xs py-2.5 px-4.5 rounded-xl transition active:scale-95 border border-slate-800 w-full sm:w-auto text-center"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={profileSaving}
                  className="bg-gradient-to-r from-indigo-600 via-indigo-500 to-indigo-400 hover:from-indigo-500 hover:to-indigo-300 border border-indigo-500/20 text-white font-bold text-xs py-2.5 px-5 rounded-xl transition shadow-md shadow-indigo-950/30 flex items-center justify-center gap-1.5 active:scale-95 w-full sm:w-auto"
                >
                  {profileSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL MOBILE DE GERENCIAMENTO DE TVS */}
      {showMobileTvsModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in lg:hidden">
          <div className="w-full max-w-md">
            {renderTvsManagerPanel(true)}
          </div>
        </div>
      )}
    </div>
  );
};

// ----------------------------------------------------
// 4. PLAYER DE MÍDIA DA TV (TV PLAYER)
// ----------------------------------------------------
const TVPlayer: React.FC = () => {
  const { session, licenca, loading: authLoading, login } = useAuth();
  const [tokenCode, setTokenCode] = useState('');
  const [pairingError, setPairingError] = useState('');
  const [pairingLoading, setPairingLoading] = useState(false);
  const [dispositivoId] = useState(() => {
    let id = localStorage.getItem('tv_dispositivo_id');
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem('tv_dispositivo_id', id);
    }
    return id;
  });

  const [tvStatus, setTvStatus] = useState<'loading' | 'pendente' | 'pareado'>('loading');
  const [tvLicencaId, setTvLicencaId] = useState<string | null>(null);

  const checkTvStatus = async () => {
    try {
      const { data, error } = await supabase
        .from('tvs')
        .select('status, licenca_id')
        .eq('dispositivo_id', dispositivoId)
        .maybeSingle();

      if (error) throw error;

      if (data && data.status === 'pareado' && data.licenca_id) {
        setTvStatus('pareado');
        setTvLicencaId(data.licenca_id);
      } else {
        setTvStatus('pendente');
        setTvLicencaId(null);
      }
    } catch (err) {
      console.error('Erro ao verificar status da TV:', err);
      setTvStatus('pendente');
      setTvLicencaId(null);
    }
  };

  useEffect(() => {
    checkTvStatus();

    // Monitora atualizações da TV em tempo real para refletir conexões/desconexões
    const channel = supabase
      .channel(`tv_status_${dispositivoId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'tvs', filter: `dispositivo_id=eq.${dispositivoId}` },
        (payload: any) => {
          if (payload.new && payload.new.status === 'pareado' && payload.new.licenca_id) {
            setTvStatus('pareado');
            setTvLicencaId(payload.new.licenca_id);
          } else {
            setTvStatus('pendente');
            setTvLicencaId(null);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [dispositivoId]);

  // Se houver uma licença vinculada no banco de dados, mas o usuário não estiver logado localmente com a licença correta, tenta o login automático
  useEffect(() => {
    if (tvStatus === 'pareado' && tvLicencaId) {
      const savedCode = localStorage.getItem('tv_activation_code');
      
      const performAutoLogin = async () => {
        if (!session || (session && session.user.id !== tvLicencaId)) {
          if (savedCode) {
            const res = await login(savedCode);
            if (!res.success) {
              console.error('Erro no login automático da TV:', res.error);
              setTvStatus('pendente');
            }
          } else {
            setTvStatus('pendente');
          }
        }
      };
      
      performAutoLogin();
    }
  }, [tvStatus, tvLicencaId, session, login]);

  const handlePair = async (e: React.FormEvent) => {
    e.preventDefault();
    setPairingError('');
    setPairingLoading(true);

    const cleanToken = tokenCode.trim().toUpperCase();
    if (cleanToken.length !== 8) {
      setPairingError('O token deve conter exatamente 8 caracteres.');
      setPairingLoading(false);
      return;
    }

    try {
      // Chama a função RPC para vincular a TV Box usando o token da licença
      const { data: ativacao, error } = await supabase.rpc('vincular_tv_por_licenca', {
        p_dispositivo_id: dispositivoId,
        p_codigo_licenca: cleanToken,
      });

      if (error || !ativacao) {
        setPairingError('Token de licença inválido, expirado ou suspenso.');
        setPairingLoading(false);
        return;
      }

      // Salva no localStorage e efetua login automático
      localStorage.setItem('tv_activation_code', ativacao);
      const res = await login(ativacao);

      if (res.success) {
        const { data: { session: newSession } } = await supabase.auth.getSession();
        setTvStatus('pareado');
        setTvLicencaId(newSession?.user?.id || null);
      } else {
        setPairingError('Erro ao realizar o login da TV: ' + res.error);
      }
    } catch (err: any) {
      console.error(err);
      setPairingError('Ocorreu um erro ao ativar a tela.');
    } finally {
      setPairingLoading(false);
    }
  };

  const handleUnlink = () => {
    localStorage.removeItem('tv_activation_code');
    setTvStatus('pendente');
    setTvLicencaId(null);
  };

  if (authLoading || tvStatus === 'loading' || (tvStatus === 'pareado' && (!session || !licenca))) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-black text-white">
        <p className="text-xl animate-pulse">Carregando Player...</p>
      </div>
    );
  }

  if (tvStatus === 'pendente' || !session || !licenca || session.user.id !== tvLicencaId) {
    return (
      <div className="relative flex h-screen w-screen flex-col items-center justify-center px-6 overflow-hidden text-white bg-[#030712] font-sans select-none">
        {/* Background simplificado sem blobs para evitar lentidão na digitação */}
        <div className="absolute inset-0 pointer-events-none -z-10 bg-[#030712]" />

        {/* Grid responsivo de conteúdo */}
        <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-12 gap-8 items-center z-10">
          
          {/* Lado Esquerdo: Logo, Título e Guia de Ativação (7 colunas) */}
          <div className="md:col-span-7 flex flex-col space-y-6 text-left p-2">
            <div className="flex items-center gap-3">
              <div className="relative flex items-center justify-center w-14 h-11 border border-indigo-500/25 rounded-xl bg-slate-950 shadow-[0_0_20px_rgba(99,102,241,0.15)]">
                <svg className="h-4.5 w-4.5 text-indigo-400 fill-current" viewBox="0 0 24 24">
                  <polygon points="5 3 19 12 5 21" />
                </svg>
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-5 h-1.5 bg-indigo-500/35 rounded-sm"></div>
              </div>
              <div className="flex flex-col items-start leading-none font-sans font-black">
                <span className="text-xl text-indigo-400 tracking-tight uppercase">MÍDIA</span>
                <div className="w-full h-[1px] bg-indigo-400/30 my-0.5"></div>
                <span className="text-xl text-slate-200 tracking-wide uppercase">INDOOR</span>
              </div>
            </div>

            <div className="space-y-2">
              <h1 className="text-3xl sm:text-4xl font-black bg-gradient-to-r from-white via-slate-200 to-indigo-300 bg-clip-text text-transparent tracking-tight">
                Parear Novo Aparelho
              </h1>
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">
                  Pronto para Sincronização
                </span>
              </div>
            </div>

            {/* Guia Linha do Tempo */}
            <div className="relative pl-5 border-l border-indigo-950/80 space-y-5 mt-2">
              <div className="relative">
                <div className="absolute -left-[25.5px] top-1.5 w-2.5 h-2.5 rounded-full bg-indigo-500 ring-4 ring-[#030712]" />
                <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">1. Gere o token no CMS</h4>
                <p className="text-[11px] text-slate-400 leading-normal">
                  Acesse o painel do administrador em outro computador ou celular, vá na aba <strong>TVs</strong> e clique em Adicionar.
                </p>
              </div>

              <div className="relative">
                <div className="absolute -left-[25.5px] top-1.5 w-2.5 h-2.5 rounded-full bg-indigo-500 ring-4 ring-[#030712]" />
                <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">2. Insira o token ao lado</h4>
                <p className="text-[11px] text-slate-400 leading-normal">
                  Digite o código de pareamento temporário de 8 dígitos exibido no painel neste dispositivo.
                </p>
              </div>

              <div className="relative">
                <div className="absolute -left-[25.5px] top-1.5 w-2.5 h-2.5 rounded-full bg-indigo-500 ring-4 ring-[#030712]" />
                <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">3. Pronto! Sinalização ativa</h4>
                <p className="text-[11px] text-slate-400 leading-normal">
                  A TV começará a baixar e exibir suas fotos e vídeos programados em tela cheia de forma automatizada.
                </p>
              </div>
            </div>
          </div>

          {/* Lado Direito: Card de Pareamento (5 colunas) */}
          <div className="md:col-span-5 w-full rounded-2xl bg-slate-900/90 p-8 shadow-2xl relative border border-slate-800/80 hover:border-indigo-500/20 transition-all duration-500 flex flex-col justify-between min-h-[360px] group">
            {/* Glow no topo do card */}
            <div className="absolute top-0 left-1/4 right-1/4 h-[1px] bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent" />

            <div className="flex flex-col items-center mb-5">
              <div className="w-11 h-11 rounded-xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center mb-3 shadow-[0_0_15px_rgba(99,102,241,0.15)] group-hover:scale-105 transition-transform duration-300">
                <Monitor className="h-5.5 w-5.5 text-indigo-400" />
              </div>
              <h3 className="text-center text-base font-black tracking-tight text-slate-100 uppercase">
                ATIVAR PLAYER
              </h3>
              <p className="mt-1 text-center text-[10px] text-slate-400 uppercase tracking-wider">
                Código de Pareamento
              </p>
            </div>

            <form onSubmit={handlePair} className="space-y-4">
              <div>
                <label htmlFor="token-code-input" className="sr-only">Token de Licença</label>
                <input
                  id="token-code-input"
                  type="text"
                  maxLength={8}
                  required
                  value={tokenCode}
                  onChange={(e) => setTokenCode(e.target.value.replace(/[^a-zA-Z0-9]/g, ''))}
                  className="w-full rounded-xl border border-slate-850 bg-slate-950/80 px-4 py-4 text-white placeholder-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 text-center uppercase tracking-widest font-mono text-2xl font-black transition-all duration-200 shadow-inner"
                  placeholder="--------"
                  disabled={pairingLoading}
                />
              </div>

              {pairingError && (
                <p className="text-[11px] text-red-400 text-center font-bold bg-red-950/20 border border-red-900/30 py-2 px-3 rounded-lg animate-pulse leading-snug">
                  ⚠️ {pairingError}
                </p>
              )}

              <button
                type="submit"
                disabled={pairingLoading || tokenCode.length !== 8}
                className="w-full rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-cyan-500 py-3.5 font-bold text-xs text-white uppercase tracking-wider hover:opacity-95 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all duration-150 flex items-center justify-center gap-2 shadow-lg shadow-indigo-950/30"
              >
                {pairingLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Pareando...
                  </>
                ) : (
                  'Ativar e Conectar Tela'
                )}
              </button>
            </form>
            
            <div className="border-t border-slate-900 mt-5 pt-4 text-center">
              <p className="text-[9px] text-slate-500 font-mono tracking-wide">
                DISPOSITIVO ID:<br/>
                <span className="text-slate-400 select-all">{dispositivoId}</span>
              </p>
            </div>
          </div>

        </div>
      </div>
    );
  }

  return <ActivePlayer licencaId={licenca.id} dispositivoId={dispositivoId} onUnlink={handleUnlink} />;
};

// ----------------------------------------------------
// Componentes otimizados para exibição de mídias (60fps)
// ----------------------------------------------------
const VideoPlayerItem: React.FC<{
  cachedUrl: string;
  isActive: boolean;
  onVideoEnded: () => void;
  loop: boolean;
}> = ({ cachedUrl, isActive, onVideoEnded, loop }) => {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const [playingUrl, setPlayingUrl] = useState(cachedUrl);

  // Evita interrupções no player de vídeo se a URL do cache mudar enquanto ele está rodando (bloqueia o update da URL enquanto ativo)
  useEffect(() => {
    if (!isActive) {
      setPlayingUrl(cachedUrl);
    }
  }, [cachedUrl, isActive]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isActive) {
      video.currentTime = 0;
      video.play().catch((err) => {
        // Silencia erros normais de aborto causados por novas solicitações de carregamento
        if (err.name !== 'AbortError') {
          console.error('Erro ao reproduzir vídeo:', err);
        }
      });
    } else {
      video.pause();
    }
  }, [isActive, playingUrl]);

  return (
    <video
      ref={videoRef}
      src={playingUrl}
      muted
      playsInline
      preload="auto"
      controls={false}
      autoPlay={isActive}
      loop={loop}
      onEnded={onVideoEnded}
      className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ease-in-out will-change-transform ${
        isActive ? 'opacity-100 z-10' : 'opacity-0 z-0'
      }`}
      style={{ transform: 'translate3d(0, 0, 0)', backfaceVisibility: 'hidden' }}
    />
  );
};

const isYouTubeUrl = (url: string) => {
  if (!url) return false;
  return url.includes('youtube.com') || url.includes('youtu.be') || url.trim().length === 11;
};

// Componente para reprodução de vídeos do YouTube
const YouTubePlayerItem: React.FC<{
  videoUrl: string;
  isActive: boolean;
  onVideoEnded: () => void;
}> = ({ videoUrl, isActive, onVideoEnded }) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const playerRef = React.useRef<any>(null);
  const [apiReady, setApiReady] = useState(!!(window as any).YT);

  const getVideoId = (url: string) => {
    if (!url) return '';
    const cleanUrl = url.trim();
    if (cleanUrl.length === 11) return cleanUrl;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = cleanUrl.match(regExp);
    return (match && match[2].length === 11) ? match[2] : '';
  };

  const videoId = useMemo(() => getVideoId(videoUrl), [videoUrl]);

  useEffect(() => {
    if ((window as any).YT) {
      setApiReady(true);
      return;
    }

    const previousReady = (window as any).onYouTubeIframeAPIReady;
    (window as any).onYouTubeIframeAPIReady = () => {
      if (previousReady) previousReady();
      setApiReady(true);
    };

    if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
    }
  }, []);

  useEffect(() => {
    if (!apiReady || !videoId || !containerRef.current) return;

    let player: any = null;

    const createPlayer = () => {
      if (!containerRef.current) return;
      containerRef.current.innerHTML = '<div class="w-full h-full"></div>';
      const targetEl = containerRef.current.firstChild;

      player = new (window as any).YT.Player(targetEl, {
        videoId: videoId,
        playerVars: {
          autoplay: isActive ? 1 : 0,
          mute: 1,
          controls: 0,
          rel: 0,
          showinfo: 0,
          modestbranding: 1,
          iv_load_policy: 3,
          autohide: 1,
          fs: 0,
          playsinline: 1,
          enablejsapi: 1,
        },
        events: {
          onReady: (event: any) => {
            playerRef.current = event.target;
            if (isActive) {
              event.target.playVideo();
            } else {
              event.target.pauseVideo();
            }
          },
          onStateChange: (event: any) => {
            if (event.data === 0) {
              onVideoEnded();
            }
          }
        }
      });
    };

    const timer = setTimeout(createPlayer, 100);

    return () => {
      clearTimeout(timer);
      if (player && typeof player.destroy === 'function') {
        player.destroy();
      }
      playerRef.current = null;
    };
  }, [apiReady, videoId]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player || typeof player.playVideo !== 'function') return;

    if (isActive) {
      player.seekTo(0, true);
      player.playVideo();
    } else {
      player.pauseVideo();
    }
  }, [isActive]);

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 w-full h-full pointer-events-none transition-opacity duration-500 ease-in-out ${
        isActive ? 'opacity-100 z-10' : 'opacity-0 z-0'
      }`}
      style={{ transform: 'translate3d(0, 0, 0)', backfaceVisibility: 'hidden' }}
    />
  );
};

interface PlayerItemProps {
  item: any;
  isActive: boolean;
  isNext: boolean;
  cachedUrl: string;
  onVideoEnded: () => void;
  loop: boolean;
}

const PlayerItem: React.FC<PlayerItemProps> = ({ item, isActive, isNext, cachedUrl, onVideoEnded, loop }) => {
  const tipo = item.midias?.tipo || 'imagem';
  const [displayUrl, setDisplayUrl] = useState(cachedUrl);

  // Congela a imagem exibida quando ela está ativa para evitar recarregamento visual (flickering) ao trocar HTTPS por blob
  useEffect(() => {
    if (!isActive) {
      setDisplayUrl(cachedUrl);
    }
  }, [cachedUrl, isActive]);

  const isVideo = tipo === 'video' || isYouTubeUrl(item.midias?.url_arquivo);
  if (isVideo && !isActive) return null;
  if (!isActive && !isNext) return null;

  if (isYouTubeUrl(item.midias?.url_arquivo)) {
    return (
      <YouTubePlayerItem
        videoUrl={item.midias.url_arquivo}
        isActive={isActive}
        onVideoEnded={onVideoEnded}
      />
    );
  }

  if (tipo === 'imagem') {
    return (
      <img
        src={displayUrl}
        alt="Mídia Indoor"
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ease-in-out ${
          isActive ? 'opacity-100 z-10' : 'opacity-0 z-0'
        }`}
        style={{ backfaceVisibility: 'hidden' }}
      />
    );
  }

  return (
    <VideoPlayerItem
      cachedUrl={cachedUrl}
      isActive={isActive}
      onVideoEnded={onVideoEnded}
      loop={loop}
    />
  );
};

// ----------------------------------------------------
// 5. PLAYER DE MÍDIA EM EXECUÇÃO (TV PLAYER ATIVO)
// ----------------------------------------------------
const ActivePlayer: React.FC<{ licencaId: string; dispositivoId: string; onUnlink: () => void }> = ({ licencaId, dispositivoId, onUnlink }) => {
  const { licenca, session } = useAuth();
  const [orientacao, setOrientacao] = useState<'horizontal' | 'vertical' | 'horizontal-invertido' | 'vertical-invertido'>(() => {
    return (localStorage.getItem('tv_local_rotation') as any) || 'horizontal';
  });
  const [playlistCarregada, setPlaylistCarregada] = useState<any[]>([]);
  const [playlistExibida, setPlaylistExibida] = useState<any[]>([]);
  const [activePlaylistInfo, setActivePlaylistInfo] = useState<{ id: string; nome: string; codigo: string } | null>(null);
  const [indiceAtual, setIndiceAtual] = useState(0);

  const [localTime, setLocalTime] = useState(new Date());

  useEffect(() => {
    const clockTimer = setInterval(() => {
      setLocalTime(new Date());
    }, 1000);
    return () => clearInterval(clockTimer);
  }, []);

  // States para a tela de Boot e configurações
  const [mostrarBoot, setMostrarBoot] = useState(true);
  const [countdown, setCountdown] = useState(10);
  const [activeModal, setActiveModal] = useState<'token' | 'comprar' | 'url' | 'config' | null>(null);

  const [showGear, setShowGear] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const hideTimeoutRef = React.useRef<any>(null);

  // States para vinculação de playlist no menu
  const [playlistInputCode, setPlaylistInputCode] = useState('');
  const [linkingError, setLinkingError] = useState('');
  const [linkingLoading, setLinkingLoading] = useState(false);

  const handleLinkPlaylist = async (e: React.FormEvent) => {
    e.preventDefault();
    setLinkingError('');
    setLinkingLoading(true);

    const cleanCode = playlistInputCode.trim().toUpperCase();
    if (cleanCode.length !== 8) {
      setLinkingError('O código deve conter exatamente 8 caracteres.');
      setLinkingLoading(false);
      return;
    }

    try {
      // Busca a playlist com o código informado
      const { data: playlistData, error: playlistErr } = await supabase
        .from('playlists')
        .select('id, nome, codigo')
        .eq('codigo', cleanCode)
        .maybeSingle();

      if (playlistErr || !playlistData) {
        setLinkingError('Playlist não encontrada ou não pertence a esta licença.');
        setLinkingLoading(false);
        return;
      }

      // Vincula a playlist à TV Box no Supabase
      const { error: updateErr } = await supabase
        .from('tvs')
        .update({ playlist_id: playlistData.id })
        .eq('dispositivo_id', dispositivoId);

      if (updateErr) {
        throw updateErr;
      }

      setPlaylistInputCode('');
      setActiveModal(null);
      await carregarPlaylistAtiva();
    } catch (err: any) {
      console.error(err);
      setLinkingError('Erro ao vincular a playlist.');
    } finally {
      setLinkingLoading(false);
    }
  };

  const handleUnlinkPlaylist = async () => {
    if (!window.confirm('Tem certeza que deseja desvincular esta playlist?')) return;
    setLinkingError('');
    setLinkingLoading(true);
    try {
      const { error: updateErr } = await supabase
        .from('tvs')
        .update({ playlist_id: null })
        .eq('dispositivo_id', dispositivoId);

      if (updateErr) {
        throw updateErr;
      }

      setActiveModal(null);
      await carregarPlaylistAtiva();
    } catch (err: any) {
      console.error(err);
      alert('Erro ao desvincular playlist.');
    } finally {
      setLinkingLoading(false);
    }
  };

  // Mapeamento de URLs para cache offline
  const mediaUrls = useMemo(() => {
    return playlistCarregada.map((item) => item.midias?.url_arquivo).filter(Boolean);
  }, [playlistCarregada]);
  const { cachedUrls, loading, progress } = useMediaCache(mediaUrls);

  // Double-buffering: atualiza a playlist exibida na tela apenas quando o cache do novo carregamento estiver 100% concluído,
  // ou se o player estiver na tela de boot. Isso impede interrupções brutas ou streaming lento de vídeos novos.
  useEffect(() => {
    if (mostrarBoot || !loading) {
      setPlaylistExibida(playlistCarregada);
    }
  }, [loading, playlistCarregada, mostrarBoot]);

  // Filtra as mídias da playlist para o dia da semana atual (0 = Domingo, 1 = Segunda, etc.)
  const diaSemanaAtual = localTime.getDay();
  const playlistFiltrada = useMemo(() => {
    return playlistExibida.filter((item) => {
      if (!item.dias_semana) return true;
      return item.dias_semana.includes(diaSemanaAtual);
    });
  }, [playlistExibida, diaSemanaAtual]);



  // Timer regressivo da tela de boot (10 segundos)
  useEffect(() => {
    if (!mostrarBoot) return;

    // Se algum modal estiver aberto ou configurações ativas, o countdown é pausado
    if (activeModal !== null || showSettings) {
      return;
    }

    if (countdown <= 0) {
      if (playlistCarregada.length > 0) {
        setMostrarBoot(false);
      }
      return;
    }

    const timer = setInterval(() => {
      setCountdown(prev => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [mostrarBoot, countdown, activeModal, showSettings, playlistCarregada.length]);

  // Intercepta botão de Voltar físico no controle remoto (TV Box/Android TV)
  useEffect(() => {
    const handleBackButton = (e: KeyboardEvent) => {
      if (
        e.key === 'Escape' ||
        e.key === 'Backspace' ||
        e.key === 'GoBack' ||
        e.key === 'BrowserBack' ||
        e.keyCode === 4
      ) {
        // Se a playlist estiver tocando, volta para a tela de boot (menu local) em vez de fechar o app
        if (!mostrarBoot) {
          e.preventDefault();
          setMostrarBoot(true);
          setCountdown(10); // Reseta o countdown de inatividade para iniciar novamente em 10s
        }
      }
    };

    window.addEventListener('keydown', handleBackButton);
    return () => window.removeEventListener('keydown', handleBackButton);
  }, [mostrarBoot]);

  // Gerenciamento de auto-hide do botão de engrenagem (3 segundos de inatividade)
  const resetHideTimer = () => {
    setShowGear(true);
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
    }
    hideTimeoutRef.current = setTimeout(() => {
      setShowGear(false);
    }, 3000);
  };

  useEffect(() => {
    resetHideTimer();

    const handleInteraction = () => {
      resetHideTimer();
      if (mostrarBoot && activeModal === null && !showSettings) {
        setCountdown(10);
      }
    };

    window.addEventListener('mousemove', handleInteraction);
    window.addEventListener('touchstart', handleInteraction);
    window.addEventListener('keydown', handleInteraction);

    return () => {
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
      window.removeEventListener('mousemove', handleInteraction);
      window.removeEventListener('touchstart', handleInteraction);
      window.removeEventListener('keydown', handleInteraction);
    };
  }, [mostrarBoot, activeModal, showSettings]);

  const carregarPlaylistAtiva = async () => {
    try {
      // 1. Obtém as informações da TV para verificar se há playlist_id atrelada diretamente
      const { data: tvInfo } = await supabase
        .from('tvs')
        .select('playlist_id')
        .eq('dispositivo_id', dispositivoId)
        .maybeSingle();

      let targetPlaylistId: string | null = null;
      let playlistInfo: any = null;

      if (tvInfo && tvInfo.playlist_id) {
        // Se a TV está atrelada diretamente a uma playlist específica, busca essa playlist
        const { data: specificPlaylist } = await supabase
          .from('playlists')
          .select('id, nome, codigo')
          .eq('id', tvInfo.playlist_id)
          .maybeSingle();

        if (specificPlaylist) {
          targetPlaylistId = specificPlaylist.id;
          playlistInfo = specificPlaylist;
        }
      }

      // 2. Não há Fallback! A playlist deve vir vazia se não estiver vinculada diretamente.
      if (!targetPlaylistId) {
        setPlaylistCarregada([]);
        setActivePlaylistInfo(null);
        return;
      }

      setActivePlaylistInfo(playlistInfo);

      // 3. Carrega os itens da playlist resolvida
      const { data: itens } = await supabase
        .from('playlist_itens')
        .select('*, midias(url_arquivo, tipo)')
        .eq('playlist_id', targetPlaylistId)
        .order('ordem', { ascending: true });

      if (itens) {
        setPlaylistCarregada(itens);
        setIndiceAtual((prev) => (prev >= itens.length ? 0 : prev));
      }
    } catch (err) {
      console.error('Erro ao carregar playlist ativa:', err);
    }
  };

  // Escuta orientação e alterações na playlist em tempo real
  useEffect(() => {
    supabase
      .from('tvs')
      .select('orientacao, licenca_id, status, playlist_id')
      .eq('dispositivo_id', dispositivoId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          if (data.orientacao) {
            setOrientacao(data.orientacao as any);
            localStorage.setItem('tv_local_rotation', data.orientacao);
          }
          // Se foi deslogado/desvinculado remotamente pelo CMS
          if (data.status === 'pendente' || !data.licenca_id) {
            onUnlink();
          }
        }
      });

    const tvChannel = supabase
      .channel('tv_config_changes')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'tvs', filter: `dispositivo_id=eq.${dispositivoId}` },
        (payload: any) => {
          if (payload.new.orientacao) {
            setOrientacao(payload.new.orientacao);
            localStorage.setItem('tv_local_rotation', payload.new.orientacao);
          }
          // Se o administrador alterou a playlist vinculada desta TV, recarrega-a
          carregarPlaylistAtiva();

          // Se foi deslogado/desvinculado remotamente pelo CMS
          if (payload.new.status === 'pendente' || !payload.new.licenca_id) {
            onUnlink();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(tvChannel);
    };
  }, [dispositivoId, onUnlink]);

  useEffect(() => {
    carregarPlaylistAtiva();

    const playlistChannel = supabase
      .channel('playlist_updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'playlists', filter: `licenca_id=eq.${licencaId}` },
        () => carregarPlaylistAtiva()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'playlist_itens' },
        () => carregarPlaylistAtiva()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(playlistChannel);
    };
  }, [licencaId]);

  // Loop da playlist (exibindo apenas mídias agendadas para o dia atual)
  const activeIndex = playlistFiltrada.length > 0 ? (indiceAtual % playlistFiltrada.length) : 0;

  useEffect(() => {
    if (mostrarBoot || playlistFiltrada.length === 0) return;

    const item = playlistFiltrada[activeIndex];
    if (!item) return;
    const tipo = item.midias?.tipo || 'imagem';
    const duracao = tipo === 'imagem' ? (item.duracao_segundos || 10) * 1000 : 0;

    if (duracao > 0) {
      const timer = setTimeout(() => {
        setIndiceAtual((prev) => (prev + 1) % playlistFiltrada.length);
      }, duracao);
      return () => clearTimeout(timer);
    }
  }, [playlistFiltrada, activeIndex, mostrarBoot]);

  const handleVideoEnded = () => {
    setIndiceAtual((prev) => (prev + 1) % playlistFiltrada.length);
  };

  // Altera a rotação da tela localmente e atualiza o Supabase + localStorage
  const handleRotate = async (novaOrientacao: 'horizontal' | 'vertical' | 'horizontal-invertido' | 'vertical-invertido') => {
    setOrientacao(novaOrientacao);
    localStorage.setItem('tv_local_rotation', novaOrientacao);
    
    try {
      await supabase
        .from('tvs')
        .update({ orientacao: novaOrientacao })
        .eq('dispositivo_id', dispositivoId);
    } catch (e) {
      console.error('Erro ao sincronizar orientação com o banco:', e);
    }
  };

  // Desvincula a tela diretamente no player
  const handlePlayerUnlink = async () => {
    if (!window.confirm('Deseja realmente desvincular esta tela?')) return;
    try {
      await supabase
        .from('tvs')
        .update({
          licenca_id: null,
          status: 'pendente',
          codigo_pin: '0000',
          codigo_ativacao_temp: null,
          playlist_id: null
        })
        .eq('dispositivo_id', dispositivoId);
    } catch (e) {
      console.error('Erro ao desvincular no Supabase:', e);
    }
    onUnlink();
  };

  const rotationStyle: React.CSSProperties = (() => {
    switch (orientacao) {
      case 'vertical':
        return { transform: 'rotate(90deg)', transformOrigin: 'center center', width: '100vh', height: '100vw' };
      case 'horizontal-invertido':
        return { transform: 'rotate(180deg)', transformOrigin: 'center center', width: '100vw', height: '100vh' };
      case 'vertical-invertido':
        return { transform: 'rotate(270deg)', transformOrigin: 'center center', width: '100vh', height: '100vw' };
      case 'horizontal':
      default:
        return { width: '100vw', height: '100vh' };
    }
  })();

  const loop = playlistFiltrada.length === 1;

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-black overflow-hidden select-none relative">
      <div style={rotationStyle} className={`transition-transform duration-500 ease-in-out flex items-center justify-center relative w-full h-full overflow-hidden ${
        mostrarBoot ? 'bg-[#030712]' : 'bg-black'
      }`}>
        
        {mostrarBoot ? (
          // ==========================================
          // TELA DE BOOT CUSTOMIZADA (MÍDIA INDOOR - SMART TV DASHBOARD)
          // ==========================================
          <div className="relative flex h-full w-full items-center justify-center text-white p-6 font-sans select-none">
            {/* Background simplificado sem blobs para evitar lentidão */}
            <div className="absolute inset-0 pointer-events-none bg-[#030712]" />

            <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-12 gap-6 z-10">
              
              {/* Painel Lateral Esquerdo: Status & Relógio (4 colunas) */}
              <div className="md:col-span-4 rounded-2xl bg-slate-900/90 p-6 border border-slate-800/80 flex flex-col justify-between shadow-2xl min-h-[380px]">
                <div className="space-y-6">
                  {/* Logo */}
                  <div className="flex items-center gap-2">
                    <div className="relative flex items-center justify-center w-12 h-10 border border-indigo-500/25 rounded-lg bg-slate-950 shadow-md">
                      <svg className="h-4.5 w-4.5 text-indigo-400 fill-current" viewBox="0 0 24 24">
                        <polygon points="5 3 19 12 5 21" />
                      </svg>
                    </div>
                    <div className="flex flex-col items-start leading-none font-black text-xs">
                      <span className="text-indigo-400 tracking-tight">MÍDIA</span>
                      <span className="text-slate-200 tracking-wide">INDOOR</span>
                    </div>
                  </div>

                  {/* Relógio Digital */}
                  <div className="space-y-1 text-left">
                    <p className="text-3xl sm:text-4xl font-black font-mono tracking-wider text-indigo-400 bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
                      {localTime.toLocaleTimeString('pt-BR')}
                    </p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none mt-1">
                      {localTime.toLocaleDateString('pt-BR', { 
                        weekday: 'short', 
                        day: '2-digit', 
                        month: 'short', 
                        year: 'numeric' 
                      })}
                    </p>
                  </div>
                </div>

                {/* Info Licença */}
                <div className="space-y-3 border-t border-slate-900 pt-5 text-left text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 font-medium">Status:</span>
                    <span className="bg-emerald-950/60 border border-emerald-900/30 text-emerald-400 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest animate-pulse">
                      ATIVO
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 font-medium">Usuário:</span>
                    <span className="font-bold text-slate-200 truncate max-w-[150px]" title={session?.user?.email || ''}>
                      {session?.user?.email ? session.user.email.split('@')[0].toUpperCase() : '---'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 font-medium">Expiração:</span>
                    <span className="font-bold text-slate-200">
                      {licenca?.data_vencimento ? new Date(licenca.data_vencimento).toLocaleDateString('pt-BR') : '---'}
                    </span>
                  </div>
                  <div className="text-[9px] text-slate-550 font-mono mt-2 pt-2 border-t border-slate-950 truncate select-all" title={dispositivoId}>
                    ID: {dispositivoId}
                  </div>
                </div>
              </div>

              {/* Painel Direito: Grade de Cards Interativos (8 colunas) */}
              <div className="md:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* Card 1: Iniciar Player (Padrão/Countdown) */}
                <button
                  onClick={() => { if (playlistCarregada.length > 0) setMostrarBoot(false); }}
                  disabled={playlistCarregada.length === 0}
                  className={`relative overflow-hidden text-left p-6 rounded-2xl hover:bg-slate-850/80 bg-slate-900/90 border flex flex-col justify-between transition-all duration-300 min-h-[180px] group ${
                    playlistCarregada.length === 0 
                      ? 'opacity-50 cursor-not-allowed border-slate-900' 
                      : 'border-slate-800/80 hover:border-indigo-500/40 shadow-lg'
                  }`}
                >
                  <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-bl-full pointer-events-none group-hover:bg-indigo-500/10 transition-colors" />
                  
                  <div className="flex justify-between items-start w-full">
                    <div>
                      <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Ação Principal</p>
                      <h3 className="text-lg font-black text-slate-100 uppercase tracking-tight mt-1">Iniciar Player</h3>
                    </div>
                    {/* Anel Circular de Contagem Regressiva em SVG */}
                    {playlistCarregada.length > 0 && !(activeModal || showSettings) && (
                      <div className="relative flex items-center justify-center w-11 h-11">
                        <svg className="w-11 h-11 transform -rotate-90">
                          {/* Background Circle */}
                          <circle
                            cx="22"
                            cy="22"
                            r="18"
                            className="text-slate-800/50"
                            strokeWidth="3.5"
                            stroke="currentColor"
                            fill="transparent"
                          />
                          {/* Animated Foreground Circle */}
                          <circle
                            cx="22"
                            cy="22"
                            r="18"
                            className="text-indigo-400 transition-all duration-1000 ease-linear"
                            strokeWidth="3.5"
                            strokeDasharray={2 * Math.PI * 18}
                            strokeDashoffset={(2 * Math.PI * 18) - (countdown / 10) * (2 * Math.PI * 18)}
                            strokeLinecap="round"
                            stroke="currentColor"
                            fill="transparent"
                          />
                        </svg>
                        <span className="absolute text-[11px] font-black font-mono text-slate-100">
                          {countdown}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5 mt-4">
                    <p className="text-xs text-slate-400 line-clamp-1">
                      {playlistCarregada.length > 0 
                        ? `Playlist ativa: ${activePlaylistInfo?.nome || 'Padrão'}` 
                        : 'Nenhuma playlist sincronizada'}
                    </p>
                    <span className="inline-flex items-center gap-1.5 text-[9px] font-bold text-indigo-400 bg-indigo-950/45 px-2 py-0.5 rounded border border-indigo-900/35 uppercase tracking-wider">
                      {playlistCarregada.length} {playlistCarregada.length === 1 ? 'Mídia' : 'Mídias'}
                    </span>
                  </div>
                </button>

                {/* Card 2: Código da Playlist */}
                <button
                  onClick={() => setActiveModal('url')}
                  className="relative overflow-hidden text-left p-6 rounded-2xl hover:bg-slate-850/80 bg-slate-900/90 border border-slate-800/80 hover:border-indigo-500/40 flex flex-col justify-between transition-all duration-300 min-h-[180px] group"
                >
                  <div className="absolute top-0 right-0 w-20 h-20 bg-cyan-500/5 rounded-bl-full pointer-events-none group-hover:bg-cyan-500/10 transition-colors" />
                  
                  <div className="flex justify-between items-start w-full">
                    <div>
                      <p className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest">Sincronização</p>
                      <h3 className="text-lg font-black text-slate-100 uppercase tracking-tight mt-1">Playlist</h3>
                    </div>
                    <div className="p-2 rounded-lg bg-cyan-600/10 border border-cyan-500/20 text-cyan-400">
                      <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                      </svg>
                    </div>
                  </div>

                  <div className="space-y-1.5 mt-4">
                    <p className="text-xs text-slate-400 truncate">
                      {activePlaylistInfo ? `Nome: ${activePlaylistInfo.nome}` : 'Sincronizar playlist via código de 8 dígitos'}
                    </p>
                    <span className="inline-flex items-center gap-1.5 text-[9px] font-bold text-cyan-400 bg-cyan-950/45 px-2 py-0.5 rounded border border-cyan-900/35 uppercase tracking-wider">
                      {activePlaylistInfo ? `CÓDIGO: ${activePlaylistInfo.codigo}` : 'PENDENTE'}
                    </span>
                  </div>
                </button>

                {/* Card 3: Ajustar Rotação */}
                <button
                  onClick={() => setShowSettings(true)}
                  className="relative overflow-hidden text-left p-6 rounded-2xl hover:bg-slate-850/80 bg-slate-900/90 border border-slate-800/80 hover:border-indigo-500/40 flex flex-col justify-between transition-all duration-300 min-h-[180px] group"
                >
                  <div className="absolute top-0 right-0 w-20 h-20 bg-violet-500/5 rounded-bl-full pointer-events-none group-hover:bg-violet-500/10 transition-colors" />
                  
                  <div className="flex justify-between items-start w-full">
                    <div>
                      <p className="text-[10px] font-bold text-violet-450 uppercase tracking-widest">Tela e Orientação</p>
                      <h3 className="text-lg font-black text-slate-100 uppercase tracking-tight mt-1">Ajustar Rotação</h3>
                    </div>
                    <div className="p-2 rounded-lg bg-violet-600/10 border border-violet-500/20 text-violet-400">
                      <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 7.89M9 11l3-3 3 3" />
                      </svg>
                    </div>
                  </div>

                  <div className="space-y-1.5 mt-4">
                    <p className="text-xs text-slate-400 capitalize truncate">
                      Orientação: {orientacao.replace('-', ' ')}
                    </p>
                    <span className="inline-flex items-center gap-1.5 text-[9px] font-bold text-violet-400 bg-violet-950/45 px-2 py-0.5 rounded border border-violet-900/35 uppercase tracking-wider">
                      {orientacao === 'horizontal' || orientacao === 'horizontal-invertido' ? 'Paisagem' : 'Retrato'}
                    </span>
                  </div>
                </button>

                {/* Card 4: Desvincular Aparelho */}
                <button
                  onClick={handlePlayerUnlink}
                  className="relative overflow-hidden text-left p-6 rounded-2xl hover:bg-slate-850/80 bg-slate-900/90 border border-slate-800/80 hover:border-red-500/20 flex flex-col justify-between transition-all duration-300 min-h-[180px] group"
                >
                  <div className="absolute top-0 right-0 w-20 h-20 bg-red-500/5 rounded-bl-full pointer-events-none group-hover:bg-red-500/10 transition-colors" />
                  
                  <div className="flex justify-between items-start w-full">
                    <div>
                      <p className="text-[10px] font-bold text-red-400 uppercase tracking-widest">Configuração</p>
                      <h3 className="text-lg font-black text-slate-100 uppercase tracking-tight mt-1">Desvincular Tela</h3>
                    </div>
                    <div className="p-2 rounded-lg bg-red-650/10 border border-red-500/20 text-red-400">
                      <Trash2 className="h-4.5 w-4.5" />
                    </div>
                  </div>

                  <div className="space-y-1.5 mt-4">
                    <p className="text-xs text-slate-400">
                      Desconecta esta TV Box da conta do CMS.
                    </p>
                    <span className="inline-flex items-center gap-1.5 text-[9px] font-bold text-red-400 bg-red-950/45 px-2 py-0.5 rounded border border-red-900/35 uppercase tracking-wider">
                      Desvincular
                    </span>
                  </div>
                </button>

              </div>

            </div>
          </div>
        ) : (!mostrarBoot && loading && playlistExibida.length === 0) ? (
          // ==========================================
          // TELA LEVE DE CARREGAMENTO INICIAL DO CACHE (0% a 100%)
          // ==========================================
          <div className="flex h-full w-full flex-col items-center justify-center bg-[#030712] text-slate-400 p-6 text-center select-none font-sans">
            <Monitor className="h-10 w-10 text-indigo-500/80 mb-4 animate-pulse" />
            <p className="text-sm font-bold text-slate-200">Sincronizando Playlist...</p>
            <p className="text-xs text-slate-550 mt-1">Baixando arquivos para reprodução offline.</p>
            
            {/* Barra de Progresso Estilizada e Leve */}
            <div className="w-full max-w-xs bg-slate-900 border border-slate-800 rounded-full h-3.5 mt-5 overflow-hidden">
              <div 
                className="bg-indigo-500 h-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-[11px] font-mono font-black text-indigo-400 mt-2">
              {progress}%
            </span>
          </div>
        ) : playlistFiltrada.length === 0 ? (
          // ==========================================
          // TELA DE FALLBACK SEM PROGRAMAÇÃO ATIVA PARA O DIA
          // ==========================================
          <div className="flex h-full w-full flex-col items-center justify-center bg-[#030712] text-slate-400 p-6 text-center select-none font-sans">
            <Monitor className="h-12 w-12 text-slate-700 mb-3 animate-pulse" />
            <p className="text-sm font-bold text-slate-300">Sem Programação Ativa</p>
            <p className="text-xs text-slate-550 mt-1 max-w-[280px]">Nenhuma mídia desta playlist está programada para ser exibida hoje.</p>
            <p className="text-[10px] font-mono text-indigo-400 mt-4 bg-indigo-950/30 border border-indigo-900/20 px-2.5 py-1 rounded-lg">
              Hoje é {localTime.toLocaleDateString('pt-BR', { weekday: 'long' })}
            </p>
          </div>
        ) : (
          // ==========================================
          // REPRODUTOR DE PLAYLIST (MÍDIA EM LOOP FILTRADA)
          // ==========================================
          playlistFiltrada.map((item, index) => {
            const isActive = index === activeIndex;
            const isNext = index === (activeIndex + 1) % playlistFiltrada.length;
            const urlOriginal = item.midias?.url_arquivo;
            const urlMidia = cachedUrls[urlOriginal] || urlOriginal;

            return (
              <PlayerItem
                key={item.id}
                item={item}
                isActive={isActive}
                isNext={isNext}
                cachedUrl={urlMidia}
                onVideoEnded={handleVideoEnded}
                loop={loop}
              />
            );
          })
        )}
      </div>

      {/* Ícone de engrenagem flutuante discreto (visível somente quando a playlist roda) */}
      {!mostrarBoot && (showGear || showSettings) && (
        <button
          onClick={() => setShowSettings(prev => !prev)}
          className="absolute bottom-6 right-6 z-50 p-3 bg-black/40 hover:bg-black/70 border border-slate-700/50 backdrop-blur-md rounded-full text-slate-400 hover:text-white transition duration-200 shadow-lg active:scale-95"
          title="Configurações da Tela"
        >
          <SettingsIcon className="h-5 w-5 animate-hover-spin" />
        </button>
      )}

      {/* Modais Informativos de Habilitação / token na tela de boot */}
      {activeModal && (
        <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 text-white rounded-2xl w-full max-w-sm p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <h4 className="font-bold text-sm text-slate-200 uppercase tracking-wide">
                {activeModal === 'token' && 'Token de Licença'}
                {activeModal === 'url' && 'Código da Playlist'}
                {activeModal === 'config' && 'Opções do Sistema'}
              </h4>
              <button
                onClick={() => {
                  setActiveModal(null);
                  setLinkingError('');
                  setPlaylistInputCode('');
                }}
                className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="text-xs text-slate-300 leading-relaxed font-medium">
              {/* Modal de Token removido - informações agora mostradas na tela de boot */}
              {activeModal === 'url' && (
                <div className="space-y-4">
                  {activePlaylistInfo ? (
                    <div className="p-3 bg-indigo-950/40 border border-indigo-900/50 rounded-xl space-y-2">
                      <p className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">Playlist Sincronizada:</p>
                      <p className="text-sm font-bold text-white">{activePlaylistInfo.nome}</p>
                      <p className="font-mono text-xs text-indigo-300">Código: {activePlaylistInfo.codigo}</p>
                      <button
                        onClick={handleUnlinkPlaylist}
                        disabled={linkingLoading}
                        className="w-full mt-2 bg-red-950/40 hover:bg-red-900/60 text-red-400 border border-red-900/50 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Desvincular Playlist
                      </button>
                    </div>
                  ) : (
                    <p className="text-slate-400 text-[11px] leading-relaxed">
                      Nenhuma playlist vinculada. Digite o código de 8 caracteres da playlist gerado no CMS para sincronizar esta TV.
                    </p>
                  )}

                  <form onSubmit={handleLinkPlaylist} className="space-y-3">
                    <div>
                      <label htmlFor="modal-playlist-code" className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        Código da Playlist (8 Caracteres)
                      </label>
                      <input
                        id="modal-playlist-code"
                        type="text"
                        maxLength={8}
                        required
                        value={playlistInputCode}
                        onChange={(e) => setPlaylistInputCode(e.target.value.replace(/[^a-zA-Z0-9]/g, ''))}
                        className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-white placeholder-slate-600 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-center uppercase tracking-widest font-mono font-bold text-sm"
                        placeholder="CÓDIGO DE 8 DÍGITOS"
                        disabled={linkingLoading}
                      />
                    </div>

                    {linkingError && <p className="text-xs text-red-400 text-center font-semibold">{linkingError}</p>}

                    <button
                      type="submit"
                      disabled={linkingLoading || playlistInputCode.length !== 8}
                      className="w-full rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-500 py-2.5 font-bold text-white hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition flex items-center justify-center gap-2 text-xs"
                    >
                      {linkingLoading ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Vinculando...
                        </>
                      ) : (
                        'Vincular Playlist'
                      )}
                    </button>
                  </form>
                </div>
              )}
              {activeModal === 'config' && (
                <div className="space-y-3">
                  <p>Ações de gerenciamento disponíveis para esta tela:</p>
                  <button
                    onClick={() => { setActiveModal(null); handlePlayerUnlink(); }}
                    className="w-full bg-red-950/40 hover:bg-red-900/60 text-red-400 border border-red-900/50 py-2.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <X className="h-3.5 w-3.5" /> Desvincular Tela (Token)
                  </button>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-800">
              <button
                onClick={() => {
                  setActiveModal(null);
                  setLinkingError('');
                  setPlaylistInputCode('');
                }}
                className="bg-indigo-650 hover:bg-indigo-700 text-white font-bold text-xs py-2 px-4 rounded transition shadow-sm"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de rotações e desvinculação */}
      {showSettings && (
        <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm p-6 shadow-2xl space-y-5 text-white">
            <div className="flex justify-between items-center pb-2 border-b border-slate-800">
              <h3 className="font-bold text-sm text-slate-200 flex items-center gap-1.5">
                <SettingsIcon className="h-4.5 w-4.5 text-indigo-400" />
                Configurações do Player
              </h3>
              <button 
                onClick={() => setShowSettings(false)}
                className="text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-800 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Rotação da Tela:</span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleRotate('horizontal')}
                  className={`py-2 px-3 rounded-lg text-xs font-bold transition flex flex-col items-center gap-1 border ${
                    orientacao === 'horizontal' 
                      ? 'bg-indigo-600 border-indigo-500 text-white' 
                      : 'bg-slate-800/50 border-slate-700/50 hover:bg-slate-800 text-slate-300'
                  }`}
                >
                  <span className="text-[10px]">Horizontal</span>
                  <span className="font-mono text-[9px] opacity-70">Padrão (0°)</span>
                </button>

                <button
                  onClick={() => handleRotate('vertical')}
                  className={`py-2 px-3 rounded-lg text-xs font-bold transition flex flex-col items-center gap-1 border ${
                    orientacao === 'vertical' 
                      ? 'bg-indigo-600 border-indigo-500 text-white' 
                      : 'bg-slate-800/50 border-slate-700/50 hover:bg-slate-800 text-slate-300'
                  }`}
                >
                  <span className="text-[10px]">Retrato</span>
                  <span className="font-mono text-[9px] opacity-70">Girar 90°</span>
                </button>

                <button
                  onClick={() => handleRotate('horizontal-invertido')}
                  className={`py-2 px-3 rounded-lg text-xs font-bold transition flex flex-col items-center gap-1 border ${
                    orientacao === 'horizontal-invertido' 
                      ? 'bg-indigo-600 border-indigo-500 text-white' 
                      : 'bg-slate-800/50 border-slate-700/50 hover:bg-slate-800 text-slate-300'
                  }`}
                >
                  <span className="text-[10px]">Horizontal Inv.</span>
                  <span className="font-mono text-[9px] opacity-70">Girar 180°</span>
                </button>

                <button
                  onClick={() => handleRotate('vertical-invertido')}
                  className={`py-2 px-3 rounded-lg text-xs font-bold transition flex flex-col items-center gap-1 border ${
                    orientacao === 'vertical-invertido' 
                      ? 'bg-indigo-600 border-indigo-500 text-white' 
                      : 'bg-slate-800/50 border-slate-700/50 hover:bg-slate-800 text-slate-300'
                  }`}
                >
                  <span className="text-[10px]">Retrato Inv.</span>
                  <span className="font-mono text-[9px] opacity-70">Girar 270°</span>
                </button>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-850 flex gap-2">
              <button
                onClick={() => { setShowSettings(false); handlePlayerUnlink(); }}
                className="w-full bg-red-950/40 hover:bg-red-900/60 text-red-400 border border-red-900/50 py-2.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm"
              >
                <X className="h-3.5 w-3.5" /> Desvincular Tela
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ----------------------------------------------------
// 5. PAINEL DE CONTROLE ADMINISTRADOR (ADMIN PANEL)
// ----------------------------------------------------
const AdminDashboard: React.FC = () => {
  const { session, loading, logout } = useAuth();
  const navigate = useNavigate();
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  const [licencas, setLicencas] = useState<any[]>([]);
  const [tvs, setTvs] = useState<any[]>([]);
  const [allPlaylists, setAllPlaylists] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [newValidade, setNewValidade] = useState('');
  const [newLimite, setNewLimite] = useState(10);
  const [actionLoading, setActionLoading] = useState(false);

  // Edit modal states
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingLicenca, setEditingLicenca] = useState<any | null>(null);
  const [editUsername, setEditUsername] = useState('');
  const [editToken, setEditToken] = useState('');
  const [editStatus, setEditStatus] = useState<'ativa' | 'suspensa' | 'cancelada'>('ativa');
  const [editValidade, setEditValidade] = useState('');
  const [editLimite, setEditLimite] = useState(10);

  const isAdmin = session?.user?.email === 'vini2fernandes@gmail.com';

  const fetchAdminData = async () => {
    if (!isAdmin) return;
    setLoadingData(true);
    try {
      // Fetch licenses
      const { data: licData, error: licErr } = await supabase
        .from('licencas')
        .select('*')
        .order('created_at', { ascending: false });

      if (licErr) throw licErr;
      setLicencas(licData || []);

      // Fetch all TVs
      const { data: tvData, error: tvErr } = await supabase
        .from('tvs')
        .select('*');

      if (tvErr) throw tvErr;
      setTvs(tvData || []);

      // Fetch all playlists to calculate current count
      const { data: playData, error: playErr } = await supabase
        .from('playlists')
        .select('id, licenca_id');

      if (playErr) throw playErr;
      setAllPlaylists(playData || []);
    } catch (err) {
      console.error('Erro ao buscar dados do admin:', err);
    } finally {
      setLoadingData(false);
    }
  };

  const playlistCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    allPlaylists.forEach((p) => {
      counts[p.licenca_id] = (counts[p.licenca_id] || 0) + 1;
    });
    return counts;
  }, [allPlaylists]);

  const filteredLicencas = useMemo(() => {
    return licencas.filter(lic =>
      lic.codigo_ativacao !== 'ADMIN' &&
      (lic.codigo_ativacao.toLowerCase().includes(searchQuery.toLowerCase()) ||
       `${lic.codigo_ativacao.toLowerCase()}@midia.indoor`.includes(searchQuery.toLowerCase()))
    );
  }, [licencas, searchQuery]);

  const handleGenerateToken = async (licId: string) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let token = '';
    for (let i = 0; i < 8; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    try {
      const { error } = await supabase
        .from('licencas')
        .update({ codigo_ativacao: token })
        .eq('id', licId);
      if (error) throw error;
      fetchAdminData();
    } catch (err: any) {
      alert('Erro ao gerar token: ' + err.message);
    }
  };

  const handleGenerateNewCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewCode(code);
  };

  useEffect(() => {
    if (isAdmin) {
      fetchAdminData();
    }
  }, [isAdmin]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: adminEmail.trim(),
        password: adminPassword.trim(),
      });
      if (error) {
        setLoginError('Credenciais administrativas inválidas.');
      }
    } catch (err) {
      setLoginError('Erro de conexão ao realizar o login.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleCreateLicense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode.trim() || !newValidade) return;
    setActionLoading(true);
    try {
      const { error } = await supabase.rpc('criar_licenca', {
        p_codigo: newCode.trim().toUpperCase(),
        p_validade: new Date(newValidade).toISOString(),
        p_limite_playlists: newLimite
      });

      if (error) throw error;

      alert('Licença criada com sucesso!');
      setShowCreateModal(false);
      setNewCode('');
      setNewValidade('');
      setNewLimite(10);
      fetchAdminData();
    } catch (err: any) {
      console.error(err);
      alert('Erro ao criar licença: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenEditModal = (lic: any) => {
    setEditingLicenca(lic);
    setEditUsername(lic.username || '');
    setEditToken(lic.codigo_ativacao || '');
    setEditStatus(lic.status);
    const dateFormatted = lic.data_vencimento ? new Date(lic.data_vencimento).toISOString().split('T')[0] : '';
    setEditValidade(dateFormatted);
    setEditLimite(lic.limite_playlists || 10);
    setShowEditModal(true);
  };

  const handleRegenerateEditToken = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let token = '';
    for (let i = 0; i < 8; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setEditToken(token);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLicenca || !editValidade || !editUsername.trim() || !editToken.trim()) return;
    setActionLoading(true);
    try {
      const { data: res, error } = await supabase.rpc('atualizar_licenca_e_usuario', {
        p_licenca_id: editingLicenca.id,
        p_novo_username: editUsername.trim().toLowerCase(),
        p_novo_token: editToken.trim().toUpperCase(),
        p_novo_status: editStatus,
        p_nova_validade: new Date(editValidade + 'T23:59:59Z').toISOString(),
        p_novo_limite: editLimite
      });

      if (error) throw error;

      if (res === 'username_duplicado') {
        alert('Este nome de usuário já está em uso por outro cliente.');
      } else if (res === 'token_duplicado') {
        alert('Este token já está em uso por outro cliente.');
      } else {
        alert('Licença atualizada com sucesso!');
        setShowEditModal(false);
        setEditingLicenca(null);
        fetchAdminData();
      }
    } catch (err: any) {
      console.error(err);
      alert('Erro ao atualizar licença: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleExcluirLicenca = async (id: string, codigo: string) => {
    if (codigo === 'ADMIN') {
      alert('A licença administradora não pode ser excluída.');
      return;
    }
    if (!window.confirm(`Tem certeza que deseja excluir permanentemente a licença ${codigo}? Isso também removerá todos os seus arquivos, playlists e TVs vinculadas.`)) return;

    try {
      const { error } = await supabase
        .from('licencas')
        .delete()
        .eq('id', id);

      if (error) throw error;
      fetchAdminData();
    } catch (err: any) {
      alert('Erro ao excluir licença: ' + err.message);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-950 text-white">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-indigo-500"></div>
      </div>
    );
  }

  if (!session || !isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-white">
        <div className="w-full max-w-md rounded-2xl bg-slate-900/80 p-8 shadow-2xl border border-slate-800 backdrop-blur-md">
          <h2 className="text-center text-3xl font-extrabold tracking-tight bg-gradient-to-r from-red-400 to-indigo-500 bg-clip-text text-transparent">
            Admin Mídia Indoor
          </h2>
          <p className="mt-2 text-center text-sm text-slate-400">
            Painel de Controle Administrativo Global
          </p>
          <form className="mt-8 space-y-6" onSubmit={handleLogin}>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">E-mail Administrativo</label>
                <input
                  type="email"
                  required
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800/50 px-4 py-3 text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  placeholder="E-mail"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Senha</label>
                <input
                  type="password"
                  required
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800/50 px-4 py-3 text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  placeholder="••••••••"
                />
              </div>
            </div>
            {loginError && <p className="text-sm text-red-400 text-center font-medium">{loginError}</p>}
            <button
              type="submit"
              disabled={loginLoading}
              className="w-full rounded-xl bg-gradient-to-r from-indigo-650 to-indigo-500 py-3 font-semibold text-white hover:opacity-90 transition flex items-center justify-center gap-2"
            >
              {loginLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Entrar no Sistema'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="w-full mt-4 rounded-xl border border-slate-700 bg-slate-800/30 hover:bg-slate-800/60 py-2.5 text-xs font-semibold text-slate-350 hover:text-white transition flex items-center justify-center gap-2"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Voltar para Login de Cliente
            </button>
          </form>
        </div>
      </div>
    );
  }

  const activeLicencasCount = licencas.filter(l => l.status === 'ativa').length;
  const pairedTvsCount = tvs.filter(t => t.status === 'pareado').length;

  return (
    <div className="min-h-screen bg-[#f5f8fa] text-slate-800 font-sans flex flex-col">
      <header className="bg-slate-900 border-b border-slate-800 px-4 sm:px-6 py-4 flex flex-col sm:flex-row gap-3 items-center justify-between sticky top-0 z-40 text-white shadow-md">
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-10 h-7 border-2 border-indigo-400 rounded bg-indigo-900">
            <svg className="h-3 w-3 text-white fill-current" viewBox="0 0 24 24">
              <polygon points="5 3 19 12 5 21" />
            </svg>
          </div>
          <span className="text-sm font-bold tracking-wider text-center sm:text-left">Mídia Indoor - PAINEL ADMINISTRADOR</span>
        </div>
        <button
          onClick={logout}
          className="flex items-center justify-center gap-1.5 bg-red-650 hover:bg-red-700 px-3.5 py-2 rounded-lg text-xs font-bold text-white shadow-sm transition w-full sm:w-auto"
        >
          <LogOut className="h-3.5 w-3.5" /> Sair do Admin
        </button>
      </header>

      <main className="flex-1 p-6 max-w-7xl w-full mx-auto space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Total de Licenças</span>
              <span className="text-2xl font-black text-slate-800">{Math.max(0, licencas.length - 1)}</span>
            </div>
            <div className="bg-indigo-50 border border-indigo-150 p-2.5 rounded-lg text-indigo-600">
              <Folder className="h-6 w-6" />
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Licenças Ativas</span>
              <span className="text-2xl font-black text-slate-800">{Math.max(0, activeLicencasCount - 1)}</span>
            </div>
            <div className="bg-emerald-50 border border-emerald-150 p-2.5 rounded-lg text-emerald-600">
              <Check className="h-6 w-6" />
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">TVs Conectadas</span>
              <span className="text-2xl font-black text-slate-800">{pairedTvsCount}</span>
            </div>
            <div className="bg-cyan-50 border border-cyan-150 p-2.5 rounded-lg text-cyan-600">
              <Monitor className="h-6 w-6" />
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm flex flex-col">
          <div className="px-6 py-4 border-b border-slate-150 flex flex-col md:flex-row md:items-center md:justify-between bg-slate-50 gap-4">
            <h3 className="font-bold text-sm text-slate-800">Listagem de Licenças de Clientes</h3>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por código..."
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-700 focus:border-indigo-500 focus:outline-none w-full sm:w-56 font-mono uppercase"
              />
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center justify-center gap-1 bg-[#4f46e5] hover:bg-indigo-700 px-3 py-2 sm:py-1.5 rounded-lg text-xs font-bold text-white shadow-sm transition whitespace-nowrap w-full sm:w-auto"
              >
                <Plus className="h-3.5 w-3.5" /> Criar Nova Licença
              </button>
            </div>
          </div>

          {loadingData ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="h-8 w-8 text-indigo-600 animate-spin" />
              <span className="text-slate-400 text-xs font-semibold">Buscando informações do banco...</span>
            </div>
          ) : filteredLicencas.length === 0 ? (
            <div className="text-center py-20 text-slate-400 flex flex-col items-center gap-2">
              <Folder className="h-12 w-12 text-slate-300" />
              <p className="text-sm font-semibold">Nenhuma licença de cliente encontrada.</p>
              <p className="text-xs">
                {searchQuery ? 'Tente ajustar sua busca por código.' : 'Clique no botão "Criar Nova Licença" para registrar o primeiro cliente.'}
              </p>
            </div>
          ) : (
            <>
              {/* LAYOUT DE TABELA PARA DESKTOP */}
              <div className="hidden md:block overflow-x-auto w-full">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-150 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      <th className="px-6 py-3">Usuário (E-mail)</th>
                      <th className="px-6 py-3">Token (Código)</th>
                      <th className="px-6 py-3">Status</th>
                      <th className="px-6 py-3">Validade</th>
                      <th className="px-6 py-3 text-center">Playlists (Qtd/Limite)</th>
                      <th className="px-6 py-3 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                    {filteredLicencas.map((lic) => {
                      const vencimento = new Date(lic.data_vencimento).getTime();
                      const isExpirada = vencimento < Date.now();
                      const playlistCount = playlistCounts[lic.id] || 0;
                      
                      return (
                        <tr key={lic.id} className="hover:bg-slate-50/50 transition">
                          <td className="px-6 py-4 text-slate-700 font-mono">
                            {lic.username ? `${lic.username.toLowerCase()}@midia.indoor` : 'Sem e-mail'}
                          </td>
                          <td className="px-6 py-4 font-mono font-bold text-slate-800 text-sm select-all">
                            {lic.codigo_ativacao ? (
                              <span className="bg-slate-150 border border-slate-200 px-2 py-0.5 rounded text-xs select-all text-slate-750">
                                {lic.codigo_ativacao}
                              </span>
                            ) : (
                              <button
                                onClick={() => handleGenerateToken(lic.id)}
                                className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-2 py-1 rounded text-[10px] font-bold transition"
                              >
                                Gerar Token
                              </button>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            {lic.status === 'ativa' && !isExpirada && (
                              <span className="bg-emerald-100 border border-emerald-200 text-emerald-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase">
                                Ativa
                              </span>
                            )}
                            {lic.status === 'ativa' && isExpirada && (
                              <span className="bg-amber-100 border border-amber-200 text-amber-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase">
                                Expirada
                              </span>
                            )}
                            {lic.status !== 'ativa' && (
                              <span className="bg-red-100 border border-red-200 text-red-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase">
                                {lic.status}
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 font-mono">
                            {new Date(lic.data_vencimento).toLocaleDateString('pt-BR')}
                          </td>
                          <td className="px-6 py-4 text-center font-bold text-sm">
                            {playlistCount} / {lic.limite_playlists}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleOpenEditModal(lic)}
                                title="Editar Cliente"
                                className="bg-white hover:bg-slate-50 border border-indigo-200 py-1.5 px-3 rounded-lg text-indigo-650 hover:bg-indigo-50/30 transition shadow-sm flex items-center gap-1 text-[10px] font-bold"
                              >
                                <Edit2 className="h-3.5 w-3.5" /> Editar
                              </button>
                              <button
                                onClick={() => handleExcluirLicenca(lic.id, lic.codigo_ativacao)}
                                title="Excluir Cliente"
                                className="bg-white hover:bg-slate-50 border border-red-200 py-1.5 px-3 rounded-lg text-red-500 hover:bg-red-50/30 transition shadow-sm flex items-center gap-1 text-[10px] font-bold"
                              >
                                <Trash2 className="h-3.5 w-3.5" /> Excluir
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* LAYOUT DE CARDS PARA MOBILE */}
              <div className="block md:hidden divide-y divide-slate-100">
                {filteredLicencas.map((lic) => {
                  const vencimento = new Date(lic.data_vencimento).getTime();
                  const isExpirada = vencimento < Date.now();
                  const playlistCount = playlistCounts[lic.id] || 0;

                  return (
                    <div key={lic.id} className="p-4 space-y-3 bg-white hover:bg-slate-50/50 transition">
                      {/* E-mail e Status */}
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-slate-700 font-bold break-all max-w-[70%] text-xs">
                          {lic.username ? `${lic.username.toLowerCase()}@midia.indoor` : 'Sem e-mail'}
                        </span>
                        <div>
                          {lic.status === 'ativa' && !isExpirada && (
                            <span className="bg-emerald-100 border border-emerald-200 text-emerald-700 px-2.5 py-0.5 rounded-lg text-[9px] font-bold uppercase tracking-wider">
                              Ativa
                            </span>
                          )}
                          {lic.status === 'ativa' && isExpirada && (
                            <span className="bg-amber-100 border border-amber-200 text-amber-700 px-2.5 py-0.5 rounded-lg text-[9px] font-bold uppercase tracking-wider">
                              Expirada
                            </span>
                          )}
                          {lic.status !== 'ativa' && (
                            <span className="bg-red-100 border border-red-200 text-red-700 px-2.5 py-0.5 rounded-lg text-[9px] font-bold uppercase tracking-wider">
                              {lic.status}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Informações detalhadas */}
                      <div className="grid grid-cols-2 gap-3 text-xs text-slate-650">
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Token / Código</span>
                          {lic.codigo_ativacao ? (
                            <span className="bg-slate-150 border border-slate-200 px-2 py-0.5 rounded font-mono font-bold text-slate-750 text-xs select-all inline-block">
                              {lic.codigo_ativacao}
                            </span>
                          ) : (
                            <button
                              onClick={() => handleGenerateToken(lic.id)}
                              className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-2 py-1 rounded text-[10px] font-bold transition"
                            >
                              Gerar Token
                            </button>
                          )}
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Playlists</span>
                          <span className="font-bold text-slate-800 text-xs">
                            {playlistCount} / {lic.limite_playlists}
                          </span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Validade</span>
                          <span className="font-mono font-semibold">
                            {new Date(lic.data_vencimento).toLocaleDateString('pt-BR')}
                          </span>
                        </div>
                      </div>

                      {/* Ações (Editar / Excluir) */}
                      <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                        <button
                          onClick={() => handleOpenEditModal(lic)}
                          title="Editar Cliente"
                          className="flex-1 bg-white hover:bg-slate-50 border border-indigo-200 py-1.5 rounded-lg text-indigo-650 transition flex items-center justify-center gap-1.5 text-[10px] font-bold shadow-sm"
                        >
                          <Edit2 className="h-3.5 w-3.5" /> Editar
                        </button>
                        <button
                          onClick={() => handleExcluirLicenca(lic.id, lic.codigo_ativacao)}
                          title="Excluir Cliente"
                          className="flex-1 bg-white hover:bg-slate-50 border border-red-200 py-1.5 rounded-lg text-red-500 transition flex items-center justify-center gap-1.5 text-[10px] font-bold shadow-sm"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Excluir
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </main>

      {/* MODAL PARA CRIAÇÃO DE LICENÇA */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
            <header className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-sm text-slate-800 flex items-center gap-1.5">
                <Plus className="h-4.5 w-4.5 text-indigo-500" />
                Criar Nova Licença de Cliente
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <form onSubmit={handleCreateLicense} className="p-5 space-y-4 overflow-y-auto">
              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Código de Ativação (Licença)</label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value.replace(/[^a-zA-Z0-9]/g, ''))}
                    className="w-full rounded-lg border border-slate-350 pr-20 px-4 py-2.5 text-slate-800 placeholder-slate-450 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 uppercase tracking-wider font-mono font-bold"
                    placeholder="EX: CLIN1234"
                  />
                  {!newCode && (
                    <button
                      type="button"
                      onClick={handleGenerateNewCode}
                      className="absolute right-2 top-1/2 -translate-y-1/2 bg-indigo-50 hover:bg-indigo-100 text-indigo-650 px-2.5 py-1 rounded text-[10px] font-bold border border-indigo-200 transition"
                    >
                      Gerar
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Data de Vencimento</label>
                <input
                  type="date"
                  required
                  value={newValidade}
                  onChange={(e) => setNewValidade(e.target.value)}
                  className="w-full rounded-lg border border-slate-350 px-4 py-2.5 text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-medium"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Limite de Playlists</label>
                <input
                  type="number"
                  required
                  min={1}
                  value={newLimite}
                  onChange={(e) => setNewLimite(parseInt(e.target.value) || 10)}
                  className="w-full rounded-lg border border-slate-350 px-4 py-2.5 text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-bold"
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-3 border-t border-slate-100 justify-end">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs py-2.5 px-4 rounded-lg transition w-full sm:w-auto text-center"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="bg-[#4f46e5] hover:bg-indigo-700 text-white font-bold text-xs py-2.5 px-5 rounded-lg transition shadow-sm flex items-center justify-center gap-1.5 w-full sm:w-auto"
                >
                  {actionLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Criar Licença'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL PARA EDIÇÃO DE LICENÇA */}
      {showEditModal && editingLicenca && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
            <header className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-sm text-slate-800 flex items-center gap-1.5">
                <Edit2 className="h-4.5 w-4.5 text-indigo-500" />
                Editar Licença: <span className="font-mono text-indigo-700">{editingLicenca.codigo_ativacao}</span>
              </h3>
              <button
                onClick={() => { setShowEditModal(false); setEditingLicenca(null); }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <form onSubmit={handleSaveEdit} className="p-5 space-y-4 overflow-y-auto">
              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Nome de Usuário</label>
                <input
                  type="text"
                  required
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value.replace(/[^a-zA-Z0-9]/g, ''))}
                  className="w-full rounded-lg border border-slate-350 px-3 py-2 text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-bold text-xs"
                  placeholder="EX: joao123"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Token de Ativação (TV)</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    maxLength={8}
                    value={editToken}
                    onChange={(e) => setEditToken(e.target.value.replace(/[^a-zA-Z0-9]/g, ''))}
                    className="flex-1 rounded-lg border border-slate-350 px-3 py-2 text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono font-bold text-xs uppercase"
                    placeholder="EX: TESTE123"
                  />
                  <button
                    type="button"
                    onClick={handleRegenerateEditToken}
                    className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-3 py-2 rounded-lg text-xs font-bold transition whitespace-nowrap"
                  >
                    Regerar
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Status da Licença</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as any)}
                  className="w-full rounded-lg border border-slate-350 px-3 py-2 text-slate-800 bg-white focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-semibold text-xs"
                >
                  <option value="ativa">Ativa</option>
                  <option value="suspensa">Suspensa</option>
                  <option value="cancelada">Cancelada</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Data de Vencimento</label>
                <input
                  type="date"
                  required
                  value={editValidade}
                  onChange={(e) => setEditValidade(e.target.value)}
                  className="w-full rounded-lg border border-slate-350 px-3 py-2 text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-medium text-xs"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Limite de Playlists</label>
                <input
                  type="number"
                  required
                  min={1}
                  value={editLimite}
                  onChange={(e) => setEditLimite(parseInt(e.target.value) || 10)}
                  className="w-full rounded-lg border border-slate-350 px-3 py-2 text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-bold text-xs"
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-3 border-t border-slate-100 justify-end">
                <button
                  type="button"
                  onClick={() => { setShowEditModal(false); setEditingLicenca(null); }}
                  className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs py-2.5 px-4 rounded-lg transition w-full sm:w-auto text-center"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="bg-[#4f46e5] hover:bg-indigo-700 text-white font-bold text-xs py-2.5 px-5 rounded-lg transition shadow-sm flex items-center justify-center gap-1.5 w-full sm:w-auto"
                >
                  {actionLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// ----------------------------------------------------
// SettingsIcon helper component
// ----------------------------------------------------
const SettingsIcon = (props: any) => (
  <svg
    {...props}
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

// ----------------------------------------------------
// RotateCW icon fallback component
// ----------------------------------------------------
const RotateCw = (props: any) => (
  <svg
    {...props}
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.72 2.78L21 8" />
    <polyline points="21 3 21 8 16 8" />
  </svg>
);

// ----------------------------------------------------
// 6. COMPONENTE PRINCIPAL DE APLICATIVO
// ----------------------------------------------------
export const App: React.FC = () => {
  const isCapacitor = typeof (window as any).Capacitor !== 'undefined';

  if (!isSupabaseConfigured) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        backgroundColor: '#0f172a',
        color: '#f8fafc',
        fontFamily: 'sans-serif',
        padding: '20px',
        textAlign: 'center'
      }}>
        <div style={{
          backgroundColor: '#1e293b',
          borderRadius: '12px',
          padding: '30px',
          boxShadow: '0 10px 15px -3px rgba(0,0,0,0.3)',
          maxWidth: '500px',
          border: '1px solid #334155'
        }}>
          <h1 style={{ color: '#ef4444', marginBottom: '16px', fontSize: '24px', fontWeight: 'bold' }}>
            Configuração do Supabase Ausente
          </h1>
          <p style={{ color: '#94a3b8', lineHeight: '1.6', marginBottom: '24px', fontSize: '15px' }}>
            As credenciais do Supabase não foram configuradas no ambiente de compilação (build-time) do seu Easypanel.
          </p>
          <div style={{
            textAlign: 'left',
            backgroundColor: '#0f172a',
            padding: '16px',
            borderRadius: '8px',
            fontSize: '14px',
            fontFamily: 'monospace',
            color: '#38bdf8',
            marginBottom: '24px',
            border: '1px solid #334155'
          }}>
            VITE_SUPABASE_URL<br/>
            VITE_SUPABASE_ANON_KEY
          </div>
          <p style={{ color: '#cbd5e1', fontSize: '15px', lineHeight: '1.5' }}>
            <strong>Como resolver:</strong> Adicione estas duas variáveis na aba <strong>Environment</strong> do seu app no Easypanel, salve e clique em <strong>Deploy / Rebuild</strong> para recompilar o aplicativo.
          </p>
        </div>
      </div>
    );
  }

  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<CMSLogin />} />
          <Route
            path="/"
            element={
              isCapacitor ? (
                <Navigate to="/tv" replace />
              ) : (
                <ProtectedCMS>
                  <CMSDashboard />
                </ProtectedCMS>
              )
            }
          />
          <Route path="/tv" element={<TVPlayer />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="*" element={<Navigate to={isCapacitor ? "/tv" : "/"} replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
