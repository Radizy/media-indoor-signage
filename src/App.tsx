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
    const email = `${codigo.trim().toLowerCase()}@midia.indoor`;
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: codigo.trim(),
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
    <div className="relative flex min-h-screen items-center justify-center bg-slate-950 px-4 text-white">
      {/* Botão invisível no canto superior direito para ir ao admin */}
      <button
        onClick={() => navigate('/admin')}
        className="absolute top-4 right-4 w-24 h-16 opacity-0 cursor-default"
        title="Área Administrativa"
      />
      <div className="w-full max-w-md rounded-2xl bg-slate-900/80 p-8 shadow-2xl border border-slate-800 backdrop-blur-md">
        <h2 className="text-center text-3xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
          Mídia Indoor CMS
        </h2>
        <p className="mt-2 text-center text-sm text-slate-400">
          Insira seu código de licença para gerenciar sua tela.
        </p>
        <form className="mt-8 space-y-6" onSubmit={handleLogin}>
          <div>
            <label htmlFor="license-code" className="sr-only">Código de Licença</label>
            <input
              id="license-code"
              type="text"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-800/50 px-4 py-3 text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-center uppercase tracking-widest font-mono"
              placeholder="CÓDIGO DE ATIVAÇÃO"
            />
          </div>
          {error && <p className="text-sm text-red-400 text-center">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-500 py-3 font-semibold text-white hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Acessar Painel'}
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
  const [profileUsername, setProfileUsername] = useState(licenca?.username || '');
  const [profileSaving, setProfileSaving] = useState(false);

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

  const activePlaylistCount = playlists.length;

  return (
    <div className="min-h-screen bg-[#f5f8fa] text-slate-800 font-sans select-none flex flex-col">
      {/* HEADER DE NAVEGAÇÃO SUPERIOR */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <Folder className="h-5 w-5 text-amber-500" />
          <div className="flex items-center gap-2 text-sm font-semibold">
            {view === 'list' ? (
              <>
                <span className="text-slate-400">/</span>
                <span className="text-slate-800"> (Playlists: {activePlaylistCount} / {licenca?.limite_playlists || 10})</span>
              </>
            ) : (
              <>
                <span 
                  onClick={() => setView('list')} 
                  className="text-indigo-600 hover:underline cursor-pointer"
                >
                  /
                </span>
                <span className="text-slate-400">/</span>
                <span className="text-slate-800 truncate max-w-[200px]" title={currentPlaylist?.nome}>
                  {currentPlaylist?.nome.toLowerCase().replace(/\s+/g, '-')}
                </span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setView('list')}
            disabled={view === 'list'}
            className="flex items-center gap-1 bg-white hover:bg-slate-50 border border-slate-300 disabled:opacity-50 disabled:cursor-not-allowed px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 transition"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Voltar
          </button>
          
          <button
            onClick={handleCriarPlaylist}
            className="flex items-center gap-1 bg-[#4f46e5] hover:bg-indigo-700 border border-transparent px-3 py-1.5 rounded-lg text-xs font-semibold text-white shadow-sm transition"
          >
            <Plus className="h-3.5 w-3.5" /> Criar Playlist
          </button>

          {view === 'detail' && (
            <label className="flex items-center gap-1 bg-[#10b981] hover:bg-emerald-700 border border-transparent px-3 py-1.5 rounded-lg text-xs font-semibold text-white shadow-sm transition cursor-pointer">
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
                  <Upload className="h-3.5 w-3.5" /> Subir Arquivo
                </>
              )}
            </label>
          )}

          <button
            onClick={() => setShowProfileModal(true)}
            className="flex items-center gap-1 bg-[#6366f1] hover:bg-indigo-750 border border-transparent px-3 py-1.5 rounded-lg text-xs font-semibold text-white shadow-sm transition"
          >
            <User className="h-3.5 w-3.5" /> Minha Conta
          </button>

          <button
            onClick={logout}
            className="flex items-center gap-1 bg-[#ef4444] hover:bg-red-700 border border-transparent px-3 py-1.5 rounded-lg text-xs font-semibold text-white shadow-sm transition"
          >
            <LogOut className="h-3.5 w-3.5" /> Sair
          </button>
        </div>
      </header>

      {/* CONTAINER PRINCIPAL */}
      <main className="flex-1 p-6 max-w-7xl w-full mx-auto space-y-6">
        
        {/* BANNER DE INFORMAÇÕES IMPORTANTE */}
        <div className="bg-[#e0f2fe] border border-sky-200 rounded-xl p-5 text-sky-900 space-y-3.5 shadow-sm">
          <p className="text-sm flex flex-wrap items-center gap-2">
            Bem-vindo <span className="font-bold">{licenca?.codigo_ativacao}</span>!
            <span className="text-xs text-sky-850 bg-white/70 px-2 py-0.5 rounded-lg border border-sky-300">
              Token de ativação das TVs: <span className="font-mono font-bold select-all">{licenca?.codigo_ativacao}</span>
            </span>
          </p>
          
          <div className="space-y-1">
            <h3 className="text-xs font-bold uppercase tracking-wider text-sky-800 flex items-center gap-1">
              <Info className="h-4 w-4" /> Atenção - Leia antes de criar sua playlist
            </h3>
            <ul className="text-xs list-disc list-inside space-y-1 pl-1 text-sky-950 font-medium">
              <li>Tamanho máximo de arquivo: <span className="font-bold">99MB</span></li>
              <li>Vídeos somente no formato <span className="font-bold">MP4</span>. Imagens somente <span className="font-bold">JPG ou PNG</span>.</li>
              <li>Tamanho ideal para vídeos ou imagens:
                <ul className="list-circle pl-6 mt-1 space-y-0.5 font-normal">
                  <li>Horizontal: <span className="font-bold">1280px x 720px</span></li>
                  <li>Vertical: <span className="font-bold">720px x 1280px</span></li>
                </ul>
              </li>
            </ul>
          </div>

          <p className="text-xs font-bold text-red-600">
            Nunca insira vídeos ou imagens maiores que:
          </p>
          <p className="text-xs font-semibold text-sky-900">
            Horizontal: <span className="font-bold">1920px x 1080px</span> - Vertical: <span className="font-bold">1080px x 1920px</span>
          </p>

          <p className="text-[11px] font-bold tracking-wide uppercase text-sky-800">
            O bom funcionamento do sistema depende somente da qualidade das suas mídias.
          </p>

          <div className="flex gap-2 pt-1.5">
            <a href="https://microcosmo.io" target="_blank" rel="noreferrer" className="flex items-center gap-1 bg-[#64748b] hover:bg-slate-600 px-3 py-1.5 rounded-lg text-xs font-semibold text-white shadow-sm transition">
              <HelpCircle className="h-3.5 w-3.5" /> Como otimizar mídias
            </a>
            <button className="flex items-center gap-1 bg-slate-400 opacity-60 cursor-not-allowed px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition">
              Ajuda (em breve)
            </button>
          </div>
        </div>

        {/* LISTAGEM DE PLAYLISTS (PASTA PRINCIPAL) */}
        {view === 'list' && (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Loader2 className="h-8 w-8 text-indigo-600 animate-spin" />
                <span className="text-slate-400 text-xs font-semibold">Carregando playlists...</span>
              </div>
            ) : playlists.length === 0 ? (
              <div className="text-center py-20 text-slate-400 flex flex-col items-center gap-2">
                <Folder className="h-12 w-12 text-slate-300" />
                <p className="text-sm font-semibold">Nenhuma playlist encontrada.</p>
                <p className="text-xs">Clique em "Criar Playlist" acima para começar.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-150">
                {playlists.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between p-4 hover:bg-slate-50 transition"
                  >
                    <div 
                      onClick={() => openPlaylist(p)}
                      className="flex items-center gap-3 cursor-pointer overflow-hidden flex-1"
                    >
                      <div className="flex items-center gap-2.5 overflow-hidden flex-wrap">
                        <span className="text-xs font-bold text-slate-700 truncate hover:text-indigo-600 transition" title={p.nome}>
                          Playlist: {p.nome}
                        </span>

                        {/* Botão de Renomear Playlist */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRenamePlaylist(p);
                          }}
                          title="Renomear Playlist"
                          className="text-slate-400 hover:text-indigo-650 p-0.5 hover:bg-slate-100 rounded transition shrink-0"
                        >
                          <Edit2 className="h-3 w-3" />
                        </button>

                        {/* Botão de TV com contagem de dispositivos */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openTvManager(p.id);
                          }}
                          title="Dispositivos vinculados a esta playlist (Ver/Desconectar)"
                          className="bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 text-[10px] px-2 py-0.5 rounded font-mono font-bold shrink-0 flex items-center gap-1 transition shadow-sm"
                        >
                          <Monitor className="h-3 w-3" />
                          <span>{tvs.filter(t => t.playlist_id === p.id).length} TVs</span>
                        </button>

                        <span className="bg-slate-100 border border-slate-200 text-slate-600 text-[10px] px-1.5 py-0.5 rounded font-mono font-bold shrink-0">
                          Tamanho: {formatBytes(getPlaylistSize(p))}
                        </span>

                        <span className="bg-indigo-50 border border-indigo-200 text-indigo-700 text-[10px] px-1.5 py-0.5 rounded font-mono font-bold shrink-0 tracking-wider">
                          Código TV: {p.codigo}
                        </span>
                        <span className="text-[10px] text-slate-400 shrink-0 font-medium">
                          ({formatDate(p.created_at)})
                        </span>
                        {p.ativa && (
                          <span className="bg-emerald-100 border border-emerald-300 text-emerald-700 px-1.5 py-0.2 rounded text-[9px] font-bold uppercase shrink-0">
                            Ativa
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 ml-4 shrink-0">


                      {/* Botão de Copiar Código da Playlist */}
                      <button
                        onClick={() => handleCopyCode(p.codigo)}
                        title="Copiar Código da Playlist"
                        className="bg-white hover:bg-slate-50 border border-slate-350 hover:border-slate-450 p-2 rounded-lg text-slate-600 hover:text-slate-800 transition flex items-center justify-center gap-1.5 shadow-sm"
                      >
                        <span className="text-[10px] font-bold text-slate-600 font-mono hidden md:inline tracking-wider">
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
                        className="bg-white hover:bg-slate-50 border border-[#22d3ee] p-2 rounded-lg text-cyan-600 hover:bg-cyan-50/30 transition shadow-sm"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>

                      {/* Botão de Deletar Playlist */}
                      <button
                        onClick={() => handleDeletarPlaylist(p.id)}
                        title="Deletar Playlist"
                        className="bg-white hover:bg-slate-50 border border-[#f87171] p-2 rounded-lg text-red-500 hover:bg-red-50/30 transition shadow-sm"
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
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Loader2 className="h-8 w-8 text-indigo-600 animate-spin" />
                <span className="text-slate-400 text-xs font-semibold">Carregando itens da playlist...</span>
              </div>
            ) : playlistItens.length === 0 ? (
              <div className="text-center py-20 text-slate-400 flex flex-col items-center gap-2">
                <Upload className="h-12 w-12 text-slate-300 animate-bounce" />
                <p className="text-sm font-semibold">Esta playlist está vazia.</p>
                <p className="text-xs">Selecione "Subir Arquivo" acima para adicionar imagens ou vídeos.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-150">
                {playlistItens.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-4 hover:bg-slate-50 transition"
                  >
                    <div className="flex items-center gap-3 overflow-hidden flex-1">
                      {item.midias.tipo === 'video' ? (
                        <FileVideo className="h-5 w-5 text-red-500 shrink-0" />
                      ) : (
                        <FileImage className="h-5 w-5 text-emerald-500 shrink-0" />
                      )}
                      <div className="flex items-center gap-2.5 overflow-hidden">
                        <span className="text-xs font-bold text-slate-700 truncate" title={item.midias.nome}>
                          {item.midias.nome}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium shrink-0">
                          ({formatBytes(item.midias.tamanho_bytes)})
                        </span>
                        {item.midias.tipo === 'imagem' ? (
                          <span className="bg-indigo-50 border border-indigo-200 text-indigo-600 text-[10px] px-1.5 py-0.2 rounded font-semibold font-mono shrink-0">
                            Exibição: {item.duracao_segundos}s
                          </span>
                        ) : (
                          <span className="bg-slate-100 border border-slate-200 text-slate-500 text-[10px] px-1.5 py-0.2 rounded font-semibold shrink-0">
                            Vídeo
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 ml-4 shrink-0">
                      {/* Botão de Download */}
                      <a
                        href={item.midias.url_arquivo}
                        target="_blank"
                        rel="noreferrer"
                        title="Visualizar / Download"
                        className="bg-white hover:bg-slate-50 border border-slate-350 p-2 rounded-lg text-slate-600 hover:text-slate-800 transition flex items-center justify-center shadow-sm"
                      >
                        <Download className="h-4 w-4" />
                      </a>

                      {/* Botão de Editar configurações de item */}
                      <button
                        onClick={() => handleEditItem(item)}
                        title={item.midias.tipo === 'imagem' ? 'Editar Tempo' : 'Editar Nome'}
                        className="bg-white hover:bg-slate-50 border border-[#22d3ee] p-2 rounded-lg text-cyan-600 hover:bg-cyan-50/30 transition shadow-sm"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      {/* Botão de Deletar item */}
                      <button
                        onClick={() => handleDeletarItem(item.id, item.midias.url_arquivo, item.midias.id)}
                        title="Remover da Playlist"
                        className="bg-white hover:bg-slate-50 border border-[#f87171] p-2 rounded-lg text-red-500 hover:bg-red-50/30 transition shadow-sm"
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
      </main>

      {/* MODAL DE CONTROLE E PAREAMENTO DA TV */}
      {showTvModal && activeTvPlaylistId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-slate-100 overflow-hidden flex flex-col">
            <header className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-sm text-slate-800 flex items-center gap-1.5">
                <Monitor className="h-4.5 w-4.5 text-indigo-500" />
                Painel de Controle da TV
              </h3>
              <button
                onClick={() => {
                  setShowTvModal(false);
                  setActiveTvPlaylistId(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="p-5 space-y-4">
              <div className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
                Playlist: <span className="text-slate-800 font-bold">
                  {playlists.find(p => p.id === activeTvPlaylistId)?.nome}
                </span>
              </div>

              {tvs.filter(t => t.playlist_id === activeTvPlaylistId).length === 0 ? (
                // TV pendente de pareamento
                <div className="space-y-4">
                  <div className="p-3.5 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-lg font-medium leading-relaxed">
                    Nenhuma TV vinculada a esta playlist ainda. Para parear, acesse a rota <span className="font-bold">/tv</span> no navegador da TV Box e digite o código desta playlist:
                  </div>
                  <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl text-center shadow-inner">
                    <span className="text-3xl font-mono font-black text-indigo-600 tracking-widest select-all">
                      {playlists.find(p => p.id === activeTvPlaylistId)?.codigo || '------'}
                    </span>
                  </div>
                </div>
              ) : (
                // TVs pareadas e ativas
                <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto pr-1 space-y-1">
                  {tvs.filter(t => t.playlist_id === activeTvPlaylistId).map((tv) => (
                    <div key={tv.id} className="py-3.5 flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="bg-emerald-50 text-emerald-600 p-1.5 rounded-lg border border-emerald-100">
                            <Monitor className="h-4.5 w-4.5" />
                          </div>
                          <div>
                            <span className="text-xs font-bold text-slate-800 block truncate max-w-[180px]" title={tv.dispositivo_id}>
                              ID: {tv.dispositivo_id.substring(0, 8)}...
                            </span>
                            <span className="text-[10px] text-emerald-650 font-semibold uppercase font-mono">
                              Conectado
                            </span>
                          </div>
                        </div>
                        
                        <span className="bg-slate-100 border border-slate-200 text-slate-705 text-[10px] px-2 py-0.5 rounded capitalize font-semibold">
                          {tv.orientacao.replace('-', ' ')}
                        </span>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => handleToggleTvOrientation(tv)}
                          className="flex-1 flex items-center justify-center gap-1 bg-slate-800 hover:bg-slate-700 text-white py-1.5 px-3 rounded-lg text-xs font-bold transition shadow-sm"
                        >
                          <RotateCw className="h-3.5 w-3.5" /> Girar Tela (4 vias)
                        </button>
                        <button
                          onClick={() => handleDisconnectTv(tv.id)}
                          className="flex items-center justify-center gap-1 bg-red-50 hover:bg-red-100 text-red-650 border border-red-200 py-1.5 px-3 rounded-lg text-xs font-bold transition shadow-sm"
                        >
                          <X className="h-3.5 w-3.5" /> Deslogar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <footer className="px-5 py-3.5 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button
                onClick={() => {
                  setShowTvModal(false);
                  setActiveTvPlaylistId(null);
                }}
                className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs py-2 px-4 rounded-lg transition"
              >
                Fechar
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* MODAL MINHA CONTA */}
      {showProfileModal && licenca && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-slate-100 overflow-hidden flex flex-col">
            <header className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-sm text-slate-800 flex items-center gap-1.5">
                <User className="h-4.5 w-4.5 text-indigo-500" />
                Minha Conta
              </h3>
              <button
                onClick={() => {
                  setShowProfileModal(false);
                  setProfileUsername(licenca.username || '');
                }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <form onSubmit={handleSaveProfile} className="p-5 space-y-4">
              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Nome de Usuário</label>
                <input
                  type="text"
                  required
                  value={profileUsername}
                  onChange={(e) => setProfileUsername(e.target.value.replace(/[^a-zA-Z0-9]/g, ''))}
                  className="w-full rounded-lg border border-slate-350 px-3 py-2 text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-bold text-xs"
                  placeholder="Seu nome de usuário para login"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Token de Ativação das TVs</label>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center">
                  <span className="font-mono text-sm font-bold text-indigo-700 tracking-wider select-all">
                    {licenca.codigo_ativacao}
                  </span>
                  <p className="text-[10px] text-slate-400 mt-1 uppercase font-semibold">
                    Use este token para ativar e parear novas TVs
                  </p>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Vencimento da Licença</label>
                <p className="text-xs font-semibold text-slate-700">
                  {new Date(licenca.data_vencimento).toLocaleDateString('pt-BR')}
                </p>
              </div>

              <div className="flex gap-3 pt-3 border-t border-slate-100 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowProfileModal(false);
                    setProfileUsername(licenca.username || '');
                  }}
                  className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs py-2 px-4 rounded-lg transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={profileSaving}
                  className="bg-[#4f46e5] hover:bg-indigo-700 text-white font-bold text-xs py-2 px-5 rounded-lg transition shadow-sm flex items-center gap-1.5"
                >
                  {profileSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Salvar Alterações'}
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
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-slate-950 text-white p-4">
        <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-8 shadow-2xl">
          <h2 className="text-center text-3xl font-extrabold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
            Ativar Tela (TV)
          </h2>
          <p className="mt-2 text-center text-sm text-slate-400 mb-8">
            Digite o token de 8 caracteres da sua licença para ativar este dispositivo.
          </p>

          <form onSubmit={handlePair} className="space-y-6">
            <div>
              <label htmlFor="token-code-input" className="sr-only">Token de Licença</label>
              <input
                id="token-code-input"
                type="text"
                maxLength={8}
                required
                value={tokenCode}
                onChange={(e) => setTokenCode(e.target.value.replace(/[^a-zA-Z0-9]/g, ''))}
                className="w-full rounded-xl border border-slate-700 bg-slate-800/50 px-4 py-3 text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-center uppercase tracking-widest font-mono text-2xl font-black"
                placeholder="TOKEN DE ATIVAÇÃO"
                disabled={pairingLoading}
              />
            </div>

            {pairingError && <p className="text-sm text-red-400 text-center font-semibold">{pairingError}</p>}

            <button
              type="submit"
              disabled={pairingLoading || tokenCode.length !== 8}
              className="w-full rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-500 py-3.5 font-bold text-white hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition flex items-center justify-center gap-2"
            >
              {pairingLoading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" /> Ativando...
                </>
              ) : (
                'Ativar e Parear Tela'
              )}
            </button>
          </form>
          <p className="text-[10px] text-slate-500 text-center mt-8 font-mono">Dispositivo ID: {dispositivoId}</p>
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
      loop={loop}
      onEnded={onVideoEnded}
      className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ease-in-out will-change-transform ${
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

  if (!isActive && !isNext) return null;

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
  const [playlist, setPlaylist] = useState<any[]>([]);
  const [activePlaylistInfo, setActivePlaylistInfo] = useState<{ id: string; nome: string; codigo: string } | null>(null);
  const [indiceAtual, setIndiceAtual] = useState(0);

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
    return playlist.map((item) => item.midias?.url_arquivo).filter(Boolean);
  }, [playlist]);
  const { cachedUrls } = useMediaCache(mediaUrls);

  // Timer regressivo da tela de boot (10 segundos)
  useEffect(() => {
    if (!mostrarBoot) return;

    // Se algum modal estiver aberto ou configurações ativas, o countdown é pausado
    if (activeModal !== null || showSettings) {
      return;
    }

    if (countdown <= 0) {
      if (playlist.length > 0) {
        setMostrarBoot(false);
      }
      return;
    }

    const timer = setInterval(() => {
      setCountdown(prev => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [mostrarBoot, countdown, activeModal, showSettings, playlist.length]);

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
        setPlaylist([]);
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
        setPlaylist(itens);
        setIndiceAtual(0);
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

  // Loop da playlist
  useEffect(() => {
    if (mostrarBoot || playlist.length === 0) return;

    const item = playlist[indiceAtual];
    const tipo = item.midias?.tipo || 'imagem';
    const duracao = tipo === 'imagem' ? (item.duracao_segundos || 10) * 1000 : 0;

    if (duracao > 0) {
      const timer = setTimeout(() => {
        setIndiceAtual((prev) => (prev + 1) % playlist.length);
      }, duracao);
      return () => clearTimeout(timer);
    }
  }, [playlist, indiceAtual, mostrarBoot]);

  const handleVideoEnded = () => {
    setIndiceAtual((prev) => (prev + 1) % playlist.length);
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

  const loop = playlist.length === 1;

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-black overflow-hidden select-none relative">
      <div style={rotationStyle} className={`transition-transform duration-500 ease-in-out flex items-center justify-center relative w-full h-full overflow-hidden ${
        mostrarBoot ? 'bg-white' : 'bg-black'
      }`}>
        
        {mostrarBoot ? (
          // ==========================================
          // TELA DE BOOT CUSTOMIZADA (MÍDIA INDOOR)
          // ==========================================
          <div className="w-full max-w-md flex flex-col items-center space-y-6 px-6 text-slate-800">
            {/* Logo Customizada */}
            <div className="flex items-center justify-center gap-3">
              <div className="relative flex items-center justify-center w-20 h-14 border-[5px] border-indigo-950 rounded-xl bg-white shadow-md">
                <svg className="h-6 w-6 text-[#1e40af] fill-current" viewBox="0 0 24 24">
                  <polygon points="5 3 19 12 5 21" />
                </svg>
                <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-8 h-3 bg-indigo-950 rounded-sm"></div>
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-3 h-2 bg-indigo-950"></div>
              </div>
              <div className="flex flex-col items-start leading-none font-sans font-black font-extrabold">
                <span className="text-3xl text-[#1e40af] tracking-tight uppercase">MÍDIA</span>
                <div className="w-full h-1 bg-[#1e40af] my-0.5"></div>
                <span className="text-3xl text-slate-800 tracking-wide uppercase">INDOOR</span>
              </div>
            </div>

            {/* Info da Licença / Usuário */}
            <div className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-left space-y-2 shadow-sm text-xs">
              <div className="flex justify-between items-center pb-1 border-b border-slate-100">
                <span className="font-semibold text-slate-500">Status:</span>
                <span className="bg-emerald-100 border border-emerald-300 text-emerald-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase">
                  Ativado
                </span>
              </div>
              <div className="flex justify-between items-center pb-1 border-b border-slate-100">
                <span className="font-semibold text-slate-500">Usuário:</span>
                <span className="font-bold text-slate-800 truncate max-w-[200px]" title={session?.user?.email || ''}>
                  {session?.user?.email ? session.user.email.split('@')[0].toUpperCase() : '---'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-semibold text-slate-500">Vencimento:</span>
                <span className="font-bold text-slate-850">
                  {licenca?.data_vencimento ? new Date(licenca.data_vencimento).toLocaleDateString('pt-BR') : '---'}
                </span>
              </div>
            </div>

            {/* Painel de Botões Alinhado */}
            <div className="w-full space-y-4">
              {/* Linha 1: Mídia Indoor */}
              <div className="flex items-center justify-between w-full">
                <div className="w-36 text-right font-bold text-slate-700 text-[11px] tracking-wider uppercase flex items-center justify-end gap-1.5 pr-2">
                  <svg className="h-3.5 w-3.5 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                  Mídia Indoor
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setActiveModal('url'); }}
                    className="bg-[#52525b] hover:bg-[#3f3f46] text-white py-2.5 rounded text-xs font-bold w-28 tracking-wider transition uppercase shadow-sm"
                  >
                    URL/Código
                  </button>
                  <button
                    onClick={() => { if (playlist.length > 0) setMostrarBoot(false); }}
                    disabled={playlist.length === 0}
                    className="bg-[#52525b] hover:bg-[#3f3f46] disabled:opacity-50 text-white py-2.5 rounded text-xs font-bold w-28 tracking-wider transition uppercase border border-indigo-400/20 shadow-sm"
                  >
                    {(activeModal || showSettings) ? 'Iniciar' : `Iniciar (${countdown}s)`}
                  </button>
                </div>
              </div>

              {/* Linha 2: Configurações */}
              <div className="flex items-center justify-between w-full">
                <div className="w-36 text-right font-bold text-slate-700 text-[11px] tracking-wider uppercase flex items-center justify-end gap-1.5 pr-2">
                  <svg className="h-3.5 w-3.5 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                  </svg>
                  Configurações
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setShowSettings(true); }}
                    className="bg-[#52525b] hover:bg-[#3f3f46] text-white py-2.5 rounded text-xs font-bold w-28 tracking-wider transition uppercase shadow-sm"
                  >
                    Rotação
                  </button>
                  <button
                    onClick={() => { setActiveModal('config'); }}
                    className="bg-[#52525b] hover:bg-[#3f3f46] text-white py-2.5 rounded text-xs font-bold w-28 tracking-wider transition uppercase shadow-sm"
                  >
                    Config
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          // ==========================================
          // REPRODUTOR DE PLAYLIST (MÍDIA EM LOOP)
          // ==========================================
          playlist.map((item, index) => {
            const isActive = index === indiceAtual;
            const isNext = index === (indiceAtual + 1) % playlist.length;
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
      <header className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center justify-between sticky top-0 z-40 text-white shadow-md">
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-10 h-7 border-2 border-indigo-400 rounded bg-indigo-900">
            <svg className="h-3 w-3 text-white fill-current" viewBox="0 0 24 24">
              <polygon points="5 3 19 12 5 21" />
            </svg>
          </div>
          <span className="text-sm font-bold tracking-wider">Mídia Indoor - PAINEL ADMINISTRADOR</span>
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-1.5 bg-red-650 hover:bg-red-700 px-3.5 py-2 rounded-lg text-xs font-bold text-white shadow-sm transition"
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
          <div className="px-6 py-4 border-b border-slate-150 flex flex-col sm:flex-row sm:items-center sm:justify-between bg-slate-50 gap-4">
            <h3 className="font-bold text-sm text-slate-800">Listagem de Licenças de Clientes</h3>
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por código..."
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-700 focus:border-indigo-500 focus:outline-none w-56 font-mono uppercase"
              />
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-1 bg-[#4f46e5] hover:bg-indigo-700 px-3 py-1.5 rounded-lg text-xs font-bold text-white shadow-sm transition whitespace-nowrap"
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
            <div className="overflow-x-auto">
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
          )}
        </div>
      </main>

      {/* MODAL PARA CRIAÇÃO DE LICENÇA */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-slate-100 overflow-hidden flex flex-col">
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

            <form onSubmit={handleCreateLicense} className="p-5 space-y-4">
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

              <div className="flex gap-3 pt-3 border-t border-slate-100 justify-end">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs py-2 px-4 rounded-lg transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="bg-[#4f46e5] hover:bg-indigo-700 text-white font-bold text-xs py-2 px-5 rounded-lg transition shadow-sm flex items-center gap-1.5"
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
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-slate-100 overflow-hidden flex flex-col">
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

            <form onSubmit={handleSaveEdit} className="p-5 space-y-4">
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

              <div className="flex gap-3 pt-3 border-t border-slate-100 justify-end">
                <button
                  type="button"
                  onClick={() => { setShowEditModal(false); setEditingLicenca(null); }}
                  className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs py-2 px-4 rounded-lg transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="bg-[#4f46e5] hover:bg-indigo-700 text-white font-bold text-xs py-2 px-5 rounded-lg transition shadow-sm flex items-center gap-1.5"
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
