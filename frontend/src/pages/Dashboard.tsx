import { useState, useEffect, useRef } from 'react';
import { Search, Clock, Trash2, Loader2, RefreshCw, Calendar, ChevronDown, Download, Play } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useToast } from '../context/ToastContext';
import ConfirmModal from '../components/ConfirmModal';
import './Dashboard.css';

const BACKEND_URL = 'https://n8n-backend.v6mtnf.easypanel.host';

const TIPOS = ['Todos', 'Equipe', 'Vendas', 'Projeto', 'Planejamento', 'Feedback', 'Cliente', 'Outro'];
const PERIODOS = ['Todos', 'Hoje', 'Ontem', 'Últimos 7 dias', 'Últimos 30 dias', 'Esta semana', 'Este mês', 'Este ano'];

interface Meeting {
  id: string;
  titulo: string;
  data: string;
  tipo_reuniao: string;
  resumo: string;
  resumo_executivo: string;
  duration: number;
  status: string;
}

const StatusBadge = ({ status }: { status: string }) => {
  if (status === 'processando') {
    return (
      <span className="status-badge status-processing">
        <Loader2 size={11} className="status-spinner" />
        Processando...
      </span>
    );
  }
  if (status === 'erro') {
    return <span className="status-badge status-error">Erro</span>;
  }
  return null;
};

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const toast = useToast();

  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterTipo, setFilterTipo] = useState('Todos');
  const [filterPeriodo, setFilterPeriodo] = useState('Todos');
  const [showTipoMenu, setShowTipoMenu] = useState(false);
  const [showPeriodoMenu, setShowPeriodoMenu] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [reprocessingId, setReprocessingId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [transcriptId, setTranscriptId] = useState('');
  const [processing, setProcessing] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const periodoRef = useRef<HTMLDivElement>(null);
  const tipoRef = useRef<HTMLDivElement>(null);

  const fetchMeetings = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error } = await supabase
      .from('meetings')
      .select('id, titulo, data, tipo_reuniao, resumo, resumo_executivo, duration, status')
      .eq('user_id', user.id)
      .order('data', { ascending: false });
    if (!error && data) setMeetings(data);
    setLoading(false);
  };

  useEffect(() => { fetchMeetings(); }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (periodoRef.current && !periodoRef.current.contains(e.target as Node)) {
        setShowPeriodoMenu(false);
      }
      if (tipoRef.current && !tipoRef.current.contains(e.target as Node)) {
        setShowTipoMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const hasProcessing = meetings.some((m) => m.status === 'processando');
    if (hasProcessing && !pollRef.current) {
      pollRef.current = setInterval(fetchMeetings, 5000);
    } else if (!hasProcessing && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [meetings]);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('pt-BR', {
      day: '2-digit', month: 'short', year: 'numeric',
    });

  const handleReprocess = async (e: React.MouseEvent, meetingId: string) => {
    e.stopPropagation();
    setReprocessingId(meetingId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sessão expirada');
      const res = await fetch(`${BACKEND_URL}/api/meetings/${meetingId}/reprocess`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erro ao reprocessar');
      toast.info('Refazendo análise em segundo plano...');
      setMeetings((prev) => prev.map((m) => m.id === meetingId ? { ...m, status: 'processando' } : m));
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setReprocessingId(null);
    }
  };

  const handleSyncFireflies = async () => {
    setSyncing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sessão expirada. Faça login novamente.');
      const res = await fetch(`${BACKEND_URL}/api/meetings/sync-fireflies`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erro ao sincronizar');
      if (json.imported === 0) {
        const dbg = json._debug ? ` (Fireflies: ${json._debug.fireflies}, banco: ${json._debug.existing})` : '';
        toast.info(`Nenhuma reunião nova encontrada no Fireflies.${dbg}`);
      } else {
        toast.success(`${json.imported} reunião(ões) importada(s) e sendo processada(s)!`);
      }
      await fetchMeetings();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao sincronizar com Fireflies');
    } finally {
      setSyncing(false);
    }
  };

  const handleProcessById = async (e: React.FormEvent) => {
    e.preventDefault();
    let raw = transcriptId.trim();
    if (!raw) return;

    // Aceita URL completa do Fireflies: .../view/Titulo::ID ou .../view/ID
    const urlMatch = raw.match(/::([^/?#]+)/);
    if (urlMatch) raw = urlMatch[1];
    else if (raw.includes('fireflies.ai')) {
      const parts = raw.split('/');
      raw = parts[parts.length - 1].split('?')[0];
    }

    setProcessing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sessão expirada. Faça login novamente.');
      const res = await fetch(`${BACKEND_URL}/api/meetings/process`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ transcript_id: raw }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erro ao processar reunião');
      toast.success('Reunião recebida e sendo processada!');
      setTranscriptId('');
      await fetchMeetings();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao processar reunião');
    } finally {
      setProcessing(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from('meetings').delete().eq('id', deleteTarget);
    if (error) {
      toast.error('Erro ao excluir reunião. Tente novamente.');
      setDeleteTarget(null);
      return;
    }
    setMeetings((prev) => prev.filter((m) => m.id !== deleteTarget));
    setDeleteTarget(null);
    toast.success('Reunião excluída.');
  };

  const isInPeriodo = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    if (filterPeriodo === 'Hoje') {
      return d.toDateString() === now.toDateString();
    }
    if (filterPeriodo === 'Ontem') {
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      return d.toDateString() === yesterday.toDateString();
    }
    if (filterPeriodo === 'Últimos 7 dias') {
      const cutoff = new Date(now);
      cutoff.setDate(now.getDate() - 7);
      cutoff.setHours(0, 0, 0, 0);
      return d >= cutoff;
    }
    if (filterPeriodo === 'Últimos 30 dias') {
      const cutoff = new Date(now);
      cutoff.setDate(now.getDate() - 30);
      cutoff.setHours(0, 0, 0, 0);
      return d >= cutoff;
    }
    if (filterPeriodo === 'Esta semana') {
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      return d >= startOfWeek;
    }
    if (filterPeriodo === 'Este mês') {
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }
    if (filterPeriodo === 'Este ano') {
      return d.getFullYear() === now.getFullYear();
    }
    return true;
  };

  const filtered = meetings.filter((m) => {
    const matchSearch = m.titulo.toLowerCase().includes(search.toLowerCase()) ||
      (m.resumo_executivo || m.resumo || '').toLowerCase().includes(search.toLowerCase());
    const matchTipo = filterTipo === 'Todos' || (m.tipo_reuniao || '').split('/')[0].trim() === filterTipo;
    const matchPeriodo = isInPeriodo(m.data);
    return matchSearch && matchTipo && matchPeriodo;
  });

  return (
    <div className="dashboard-container">
      <div className="dashboard-content">

        {/* Header com título + filtros */}
        <div className="dashboard-header">
          <div className="dashboard-title-row">
            <h1 className="page-title">Painel de Reuniões</h1>
            <button className="btn-sync" onClick={handleSyncFireflies} disabled={syncing} title="Importar reuniões recentes do Fireflies">
              {syncing ? <Loader2 size={15} className="status-spinner" /> : <Download size={15} />}
              {syncing ? 'Sincronizando...' : 'Sincronizar Fireflies'}
            </button>
          </div>
          <div className="dashboard-filters">
            <div className="search-bar">
              <Search size={16} className="search-icon" />
              <input
                type="text"
                placeholder="Pesquisar reuniões..."
                className="search-input"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="filter-dropdown-wrap" ref={periodoRef}>
              <button className={`filter-btn${filterPeriodo !== 'Todos' ? ' filter-btn-active' : ''}`} onClick={() => { setShowPeriodoMenu(!showPeriodoMenu); setShowTipoMenu(false); }}>
                <Calendar size={15} />
                {filterPeriodo === 'Todos' ? 'Data' : filterPeriodo}
                <ChevronDown size={14} />
              </button>
              {showPeriodoMenu && (
                <div className="filter-menu">
                  {PERIODOS.map((p) => (
                    <button
                      key={p}
                      className={`filter-menu-item${filterPeriodo === p ? ' active' : ''}`}
                      onClick={() => { setFilterPeriodo(p); setShowPeriodoMenu(false); }}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="filter-dropdown-wrap" ref={tipoRef}>
              <button className="filter-btn" onClick={() => setShowTipoMenu(!showTipoMenu)}>
                Tipo de Reunião
                <ChevronDown size={14} />
              </button>
              {showTipoMenu && (
                <div className="filter-menu">
                  {TIPOS.map((tipo) => (
                    <button
                      key={tipo}
                      className={`filter-menu-item${filterTipo === tipo ? ' active' : ''}`}
                      onClick={() => { setFilterTipo(tipo); setShowTipoMenu(false); }}
                    >
                      {tipo}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Processar reunião por ID */}
        <div className="process-card">
          <p className="process-card-label">Processar reunião pelo ID do Fireflies</p>
          <form className="process-form-row" onSubmit={handleProcessById}>
            <input
              id="transcript-id-input"
              type="text"
              className="input-field"
              placeholder="Cole o Transcript ID do Fireflies aqui..."
              value={transcriptId}
              onChange={(e) => setTranscriptId(e.target.value)}
              required
            />
            <button type="submit" className="btn-process" disabled={processing || !transcriptId.trim()}>
              {processing ? <Loader2 size={15} className="status-spinner" /> : <Play size={15} />}
              {processing ? 'Processando...' : 'Processar'}
            </button>
          </form>
        </div>

        {/* Lista */}
        {loading && <p className="section-text">Carregando...</p>}

        {!loading && filtered.length === 0 && (
          <div className="empty-state">
            <p>Nenhuma reunião encontrada.</p>
            <p className="section-text">As reuniões aparecerão aqui após serem processadas pelo Fireflies.</p>
          </div>
        )}

        <div className="meetings-list">
          {filtered.map((meeting) => {
            const resumoText = meeting.resumo_executivo || meeting.resumo || '';
            return (
              <div
                key={meeting.id}
                className={`meeting-row${meeting.status === 'processando' ? ' meeting-row-processing' : ''}`}
                onClick={() => meeting.status !== 'processando' && navigate(`/meeting/${meeting.id}`)}
              >
                <div className="meeting-row-header">
                  <div className="meeting-row-title-wrap">
                    <span className="meeting-row-title">{meeting.titulo}</span>
                    <StatusBadge status={meeting.status} />
                  </div>
                  <div className="row-actions">
                    {meeting.status !== 'processando' && (
                      <button
                        className="btn-reanalyze"
                        onClick={(e) => handleReprocess(e, meeting.id)}
                        disabled={reprocessingId === meeting.id}
                        title="Refazer análise da IA"
                      >
                        <RefreshCw size={15} className={reprocessingId === meeting.id ? 'status-spinner' : ''} />
                      </button>
                    )}
                    <button
                      className="btn-delete"
                      onClick={(e) => { e.stopPropagation(); setDeleteTarget(meeting.id); }}
                      title="Excluir reunião"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
                <div className="meeting-row-meta">
                  <Clock size={13} className="meta-icon" />
                  <span>{formatDate(meeting.data)}{meeting.duration ? ` • ${meeting.duration}m` : ''}</span>
                  {meeting.tipo_reuniao && (
                    <span className="meeting-tag">{meeting.tipo_reuniao}</span>
                  )}
                </div>
                {resumoText && meeting.status === 'concluido' && (
                  <p className="meeting-row-summary">
                    <span className="summary-label">Resumo da IA:</span> {resumoText}
                  </p>
                )}
                {meeting.status === 'erro' && (
                  <p className="meeting-row-summary meeting-row-error-hint">
                    Falha ao processar. Use o botão de reprocessar para tentar novamente.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <ConfirmModal
        isOpen={!!deleteTarget}
        title="Excluir reunião"
        message="Tem certeza? Esta ação não pode ser desfeita."
        confirmLabel="Excluir"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};

export default Dashboard;
