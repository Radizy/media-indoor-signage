import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../App';
import { Monitor, Unlink, RotateCw, Loader2, Check } from 'lucide-react';

interface TV {
  id: string;
  codigo_pin: string;
  orientacao: 'horizontal' | 'vertical';
  dispositivo_id: string;
  status: 'pendente' | 'pareado';
}

export const TvController: React.FC = () => {
  const { licenca } = useAuth();
  const [tvs, setTvs] = useState<TV[]>([]);
  const [pinInput, setPinInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [pairing, setPairing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchTvs = async () => {
    if (!licenca) return;
    setLoading(true);
    try {
      const { data, error: fetchError } = await supabase
        .from('tvs')
        .select('*')
        .eq('licenca_id', licenca.id);

      if (fetchError) throw fetchError;
      setTvs(data || []);
    } catch (err: any) {
      console.error('Erro ao buscar TVs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTvs();

    // Assina atualizações em tempo real para as TVs vinculadas a esta licença
    if (!licenca) return;

    const channel = supabase
      .channel('tv_cms_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tvs', filter: `licenca_id=eq.${licenca.id}` },
        () => fetchTvs()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [licenca]);

  const handlePair = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!pinInput.trim() || pinInput.length !== 4 || !licenca) {
      setError('O PIN deve conter exatamente 4 dígitos.');
      return;
    }

    setPairing(true);
    try {
      // 1. Busca a TV pendente com o PIN informado
      const { data: tv, error: findError } = await supabase
        .from('tvs')
        .select('*')
        .eq('codigo_pin', pinInput.trim())
        .eq('status', 'pendente')
        .maybeSingle();

      if (findError) throw findError;
      if (!tv) {
        setError('PIN inválido ou tela de pareamento expirada.');
        setPairing(false);
        return;
      }

      // 2. Associa a TV à licença ativa
      const { error: updateError } = await supabase
        .from('tvs')
        .update({
          licenca_id: licenca.id,
          status: 'pareado',
          codigo_ativacao_temp: licenca.codigo_ativacao, // Envia o código de ativação temporário para login automático da TV
        })
        .eq('id', tv.id);

      if (updateError) throw updateError;

      setPinInput('');
      setSuccess('Tela vinculada com sucesso!');
      fetchTvs();
    } catch (err: any) {
      console.error('Erro ao parear TV:', err);
      setError(err.message || 'Falha ao vincular tela.');
    } finally {
      setPairing(false);
    }
  };

  const handleAlternarOrientacao = async (id: string, orientacaoAtual: 'horizontal' | 'vertical') => {
    setError('');
    const novaOrientacao = orientacaoAtual === 'horizontal' ? 'vertical' : 'horizontal';
    try {
      const { error: updateError } = await supabase
        .from('tvs')
        .update({ orientacao: novaOrientacao })
        .eq('id', id);

      if (updateError) throw updateError;
      
      // O Supabase Realtime cuidará de atualizar a lista através do canal de assinatura
    } catch (err: any) {
      console.error('Erro ao mudar orientação:', err);
      setError('Falha ao atualizar orientação da tela.');
    }
  };

  const handleDesvincular = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja desvincular esta tela? O player será desconectado imediatamente.')) return;
    setError('');

    // Gera um novo PIN aleatório para a TV que ficará pendente
    const novoPin = Math.floor(1000 + Math.random() * 9000).toString();

    try {
      const { error: updateError } = await supabase
        .from('tvs')
        .update({
          licenca_id: null,
          status: 'pendente',
          codigo_pin: novoPin,
          codigo_ativacao_temp: null,
        })
        .eq('id', id);

      if (updateError) throw updateError;
      
      fetchTvs();
    } catch (err: any) {
      console.error('Erro ao desvincular:', err);
      setError('Falha ao desvincular tela.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Formulário de Pareamento */}
      <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-850">
        <h4 className="text-xs font-bold text-slate-400 mb-3 uppercase tracking-wider">Vincular Nova Tela</h4>
        <form onSubmit={handlePair} className="flex gap-2">
          <input
            type="text"
            maxLength={4}
            value={pinInput}
            onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
            placeholder="PIN de 4 dígitos (ex: 8372)"
            className="flex-1 rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2 text-white text-xs placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-center font-mono tracking-widest font-bold"
          />
          <button
            type="submit"
            disabled={pairing}
            className="bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-lg text-xs transition font-semibold flex items-center gap-1.5 shrink-0"
          >
            {pairing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Vincular'}
          </button>
        </form>

        {error && <p className="text-[11px] text-red-400 mt-2 bg-red-950/20 border border-red-900/30 p-1.5 rounded">{error}</p>}
        {success && <p className="text-[11px] text-emerald-400 mt-2 bg-emerald-950/20 border border-emerald-900/30 p-1.5 rounded flex items-center gap-1"><Check className="h-3 w-3" /> {success}</p>}
      </div>

      {/* Lista de TVs Conectadas */}
      <div>
        <h4 className="text-xs font-bold text-slate-400 mb-3 uppercase tracking-wider">Telas Conectadas</h4>
        
        {loading && tvs.length === 0 ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 text-slate-500 animate-spin" />
          </div>
        ) : tvs.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl">
            Nenhuma TV conectada a esta licença ainda.
          </div>
        ) : (
          <div className="space-y-3.5">
            {tvs.map((tv) => (
              <div
                key={tv.id}
                className="p-3.5 rounded-xl bg-slate-900 border border-slate-850 hover:border-slate-800 transition space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Monitor className="h-4.5 w-4.5 text-indigo-400 shrink-0" />
                    <div>
                      <span className="text-xs font-semibold text-slate-200 block">TV Box ({tv.orientacao})</span>
                      <span className="text-[10px] text-slate-500 font-mono block">ID: {tv.dispositivo_id.substring(0, 8)}...</span>
                    </div>
                  </div>
                  <span className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-2 py-0.5 rounded text-[10px] font-bold uppercase">
                    Pareado
                  </span>
                </div>

                <div className="flex gap-2 pt-2 border-t border-slate-850">
                  <button
                    onClick={() => handleAlternarOrientacao(tv.id, tv.orientacao)}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white transition text-xs font-medium"
                  >
                    <RotateCw className="h-3.5 w-3.5" /> Rotacionar
                  </button>
                  <button
                    onClick={() => handleDesvincular(tv.id)}
                    className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-650/10 hover:bg-red-650/20 text-red-400 border border-red-500/10 hover:border-red-500/20 transition text-xs font-medium shrink-0"
                  >
                    <Unlink className="h-3.5 w-3.5" /> Desvincular
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TvController;
