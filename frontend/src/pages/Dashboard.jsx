import React, { useEffect, useState, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Search, Calendar as CalendarIcon, ChevronDown, Clock, Send, Loader2, Trash2, RefreshCw, X, Check, AlertCircle, Download } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import Toast from '../components/Toast';
import ConfirmModal from '../components/ConfirmModal';

export default function Dashboard() {
    const { user } = useAuth();
    const [meetings, setMeetings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [manualId, setManualId] = useState('');
    const [processing, setProcessing] = useState(false);
    const [processMessage, setProcessMessage] = useState(null);
    const [toast, setToast] = useState(null);
    const [deleteModal, setDeleteModal] = useState(null);
    const [reprocessing, setReprocessing] = useState(null);
    const [editingTitle, setEditingTitle] = useState(null);
    const [editTitleValue, setEditTitleValue] = useState('');
    const navigate = useNavigate();

    // Filtros
    const [searchTerm, setSearchTerm] = useState('');
    const [dateFilter, setDateFilter] = useState('');
    const [typeFilter, setTypeFilter] = useState('');
    const [showTypeDropdown, setShowTypeDropdown] = useState(false);

    const backendUrl = import.meta.env.VITE_API_URL || '';
    const dateInputRef = useRef(null);

    const [syncing, setSyncing] = useState(false);
    const [syncMessage, setSyncMessage] = useState(null);

    useEffect(() => {
        fetchMeetings();
    }, []);

    // Auto-refresh enquanto houver reuniões sendo processadas
    useEffect(() => {
        const hasProcessing = meetings.some(m => m.status === 'processing');
        if (!hasProcessing) return;

        const interval = setInterval(() => {
            fetchMeetings();
        }, 5000);

        return () => clearInterval(interval);
    }, [meetings]);

    // Extrair tipos únicos das reuniões
    const meetingTypes = useMemo(() => {
        const types = meetings
            .map(m => m.meeting_type)
            .filter(Boolean)
            .filter((v, i, a) => a.indexOf(v) === i)
            .sort();
        return types;
    }, [meetings]);

    // Filtrar reuniões
    const filteredMeetings = useMemo(() => {
        return meetings.filter(m => {
            // Filtro de busca por título
            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                const matchTitle = m.title?.toLowerCase().includes(term);
                const matchSummary = m.executive_summary?.toLowerCase().includes(term);
                if (!matchTitle && !matchSummary) return false;
            }

            // Filtro por data
            if (dateFilter && m.date) {
                const meetingDate = format(parseISO(m.date), 'yyyy-MM-dd');
                if (meetingDate !== dateFilter) return false;
            }

            // Filtro por tipo
            if (typeFilter) {
                if (m.meeting_type !== typeFilter) return false;
            }

            return true;
        });
    }, [meetings, searchTerm, dateFilter, typeFilter]);

    const hasActiveFilters = searchTerm || dateFilter || typeFilter;

    function clearFilters() {
        setSearchTerm('');
        setDateFilter('');
        setTypeFilter('');
    }

    async function fetchMeetings() {
        const { data, error } = await supabase
            .from('meetings')
            .select('*')
            .order('date', { ascending: false });

        if (!error && data) {
            setMeetings(data);
        }
        setLoading(false);
    }

    async function handleSync() {
        setSyncing(true);
        setSyncMessage(null);

        try {
            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('fireflies_webhook_secret')
                .eq('id', user.id)
                .single();

            if (profileError || !profile?.fireflies_webhook_secret) {
                setSyncMessage({ type: 'error', text: 'Webhook secret não encontrado. Verifique seu perfil.' });
                setSyncing(false);
                return;
            }

            const response = await fetch(`${backendUrl}/api/sync/fireflies`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_secret: profile.fireflies_webhook_secret }),
            });

            const data = await response.json();

            if (response.ok || response.status === 202) {
                setSyncMessage({ type: 'success', text: data.message });
                if (data.imported > 0) {
                    setTimeout(() => fetchMeetings(), 8000);
                }
            } else {
                setSyncMessage({ type: 'error', text: data.error || 'Erro ao sincronizar.' });
            }
        } catch (err) {
            setSyncMessage({ type: 'error', text: 'Erro de conexão: ' + err.message });
        }

        setSyncing(false);
    }

    async function handleManualProcess(e) {
        e.preventDefault();
        if (!manualId.trim()) return;

        setProcessing(true);
        setProcessMessage(null);

        try {
            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('fireflies_webhook_secret')
                .eq('id', user.id)
                .single();

            if (profileError || !profile?.fireflies_webhook_secret) {
                setProcessMessage({ type: 'error', text: 'Webhook secret não encontrado. Verifique seu perfil.' });
                setProcessing(false);
                return;
            }

            const webhookUrl = `${backendUrl}/api/webhooks/fireflies/${profile.fireflies_webhook_secret}`;

            const response = await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ meetingId: manualId.trim() }),
            });

            const data = await response.json();

            if (response.ok) {
                setProcessMessage({ type: 'success', text: 'Reunião enviada para processamento! Aguarde alguns segundos e atualize a página.' });
                setManualId('');
                setTimeout(() => fetchMeetings(), 8000);
            } else {
                setProcessMessage({ type: 'error', text: data.error || 'Erro ao processar reunião.' });
            }
        } catch (err) {
            setProcessMessage({ type: 'error', text: 'Erro de conexão com o backend: ' + err.message });
        }

        setProcessing(false);
    }

    function handleDeleteClick(e, meetingId, title) {
        e.stopPropagation();
        setDeleteModal({ id: meetingId, title });
    }

    async function confirmDelete() {
        if (!deleteModal) return;
        const { id: meetingId } = deleteModal;
        setDeleteModal(null);

        const { error } = await supabase
            .from('meetings')
            .delete()
            .eq('id', meetingId);

        if (!error) {
            setMeetings(prev => prev.filter(m => m.id !== meetingId));
            setToast({ message: 'Reunião excluída com sucesso!', type: 'success' });
        } else {
            setToast({ message: 'Erro ao excluir: ' + error.message, type: 'error' });
        }
    }

    function handleTitleClick(e, meeting) {
        e.stopPropagation();
        setEditingTitle(meeting.id);
        setEditTitleValue(meeting.title);
    }

    async function handleTitleSave(e, meetingId) {
        e.stopPropagation();
        const newTitle = editTitleValue.trim();
        if (!newTitle) {
            setEditingTitle(null);
            return;
        }

        const { error } = await supabase
            .from('meetings')
            .update({ title: newTitle })
            .eq('id', meetingId);

        if (!error) {
            setMeetings(prev => prev.map(m => m.id === meetingId ? { ...m, title: newTitle } : m));
            setToast({ message: 'Título atualizado!', type: 'success' });
        } else {
            setToast({ message: 'Erro ao salvar título.', type: 'error' });
        }
        setEditingTitle(null);
    }

    async function handleReprocess(e, meeting) {
        e.stopPropagation();
        if (reprocessing) return;

        setReprocessing(meeting.id);
        try {
            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('fireflies_webhook_secret')
                .eq('id', user.id)
                .single();

            if (profileError || !profile?.fireflies_webhook_secret) {
                setToast({ message: 'Webhook secret não encontrado. Verifique seu perfil.', type: 'error' });
                setReprocessing(null);
                return;
            }

            const response = await fetch(`${backendUrl}/api/meetings/${meeting.id}/reprocess`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_secret: profile.fireflies_webhook_secret }),
            });

            if (response.ok) {
                setToast({ message: 'Análise da IA reenviada! Aguarde alguns segundos e atualize.', type: 'success' });
                setTimeout(() => fetchMeetings(), 8000);
            } else {
                const data = await response.json();
                setToast({ message: data.error || 'Erro ao reprocessar.', type: 'error' });
            }
        } catch (err) {
            setToast({ message: 'Erro de conexão: ' + err.message, type: 'error' });
        }
        setReprocessing(null);
    }

    const badgeColors = [
        'bg-blue-500 text-white',
        'bg-teal-500 text-white',
        'bg-purple-500 text-white',
        'bg-orange-500 text-white',
        'bg-pink-500 text-white',
        'bg-indigo-500 text-white',
        'bg-emerald-500 text-white',
        'bg-amber-500 text-white',
        'bg-cyan-500 text-white',
        'bg-rose-500 text-white',
        'bg-violet-500 text-white',
        'bg-lime-600 text-white',
        'bg-sky-500 text-white',
        'bg-fuchsia-500 text-white',
    ];

    const getBadgeColor = (type) => {
        if (!type) return 'bg-gray-400 text-white';
        // Gera um índice consistente baseado no texto do tipo
        let hash = 0;
        for (let i = 0; i < type.length; i++) {
            hash = type.charCodeAt(i) + ((hash << 5) - hash);
        }
        return badgeColors[Math.abs(hash) % badgeColors.length];
    };

    return (
        <div className="p-4 md:p-10 max-w-5xl w-full overflow-hidden">
            {toast && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onClose={() => setToast(null)}
                />
            )}

            {deleteModal && (
                <ConfirmModal
                    title="Excluir reunião"
                    message={`Tem certeza que deseja excluir "${deleteModal.title}"? Esta ação não pode ser desfeita.`}
                    confirmText="Excluir"
                    cancelText="Cancelar"
                    danger
                    onConfirm={confirmDelete}
                    onCancel={() => setDeleteModal(null)}
                />
            )}

            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-6">
                <div className="flex items-center gap-3 mb-4 md:mb-0">
                    <h1 className="text-3xl font-extrabold text-gray-900">Painel de Reuniões</h1>
                    <button
                        onClick={handleSync}
                        disabled={syncing}
                        className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition disabled:opacity-50 shrink-0"
                        title="Sincronizar reuniões recentes do Fireflies"
                    >
                        {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                        {syncing ? 'Sincronizando...' : 'Sincronizar Fireflies'}
                    </button>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="h-5 w-5 text-gray-400" />
                        </div>
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="block w-full pl-10 pr-8 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition duration-150 ease-in-out"
                            placeholder="Pesquisar reuniões..."
                        />
                        {searchTerm && (
                            <button onClick={() => setSearchTerm('')} className="absolute inset-y-0 right-0 pr-2 flex items-center text-gray-400 hover:text-gray-600">
                                <X className="h-4 w-4" />
                            </button>
                        )}
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <input
                                ref={dateInputRef}
                                type="date"
                                value={dateFilter}
                                onChange={(e) => setDateFilter(e.target.value)}
                                className="sr-only"
                            />
                            <button
                                onClick={() => dateInputRef.current?.showPicker()}
                                className={`flex items-center px-4 py-2 border shadow-sm text-sm font-medium rounded-md transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${dateFilter ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50'}`}
                            >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {dateFilter ? format(parseISO(dateFilter), "d MMM yyyy", { locale: ptBR }) : 'Data'}
                                {dateFilter && (
                                    <span
                                        onClick={(e) => { e.stopPropagation(); setDateFilter(''); }}
                                        className="ml-2 hover:text-blue-900 cursor-pointer"
                                    >
                                        <X className="h-3 w-3" />
                                    </span>
                                )}
                            </button>
                        </div>

                        <div className="relative">
                            <button
                                onClick={() => setShowTypeDropdown(!showTypeDropdown)}
                                className={`flex items-center px-4 py-2 border shadow-sm text-sm font-medium rounded-md transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${typeFilter ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50'}`}
                            >
                                {typeFilter || 'Tipo de Reunião'}
                                {typeFilter ? (
                                    <span
                                        onClick={(e) => { e.stopPropagation(); setTypeFilter(''); setShowTypeDropdown(false); }}
                                        className="ml-2 hover:text-blue-900 cursor-pointer"
                                    >
                                        <X className="h-3 w-3" />
                                    </span>
                                ) : (
                                    <ChevronDown className="ml-2 h-4 w-4" />
                                )}
                            </button>

                            {showTypeDropdown && (
                                <>
                                    <div className="fixed inset-0 z-10" onClick={() => setShowTypeDropdown(false)} />
                                    <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-1">
                                        {meetingTypes.length === 0 ? (
                                            <p className="px-4 py-2 text-sm text-gray-400">Nenhum tipo encontrado</p>
                                        ) : (
                                            meetingTypes.map(type => (
                                                <button
                                                    key={type}
                                                    onClick={() => { setTypeFilter(type); setShowTypeDropdown(false); }}
                                                    className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition ${typeFilter === type ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'}`}
                                                >
                                                    {type}
                                                </button>
                                            ))
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Mensagem de sincronização */}
            {syncMessage && (
                <div className={`mb-4 px-4 py-3 rounded-lg text-sm font-medium flex items-center justify-between ${syncMessage.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                    <span>{syncMessage.text}</span>
                    <button onClick={() => setSyncMessage(null)} className="ml-3 opacity-60 hover:opacity-100">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* Filtros ativos */}
            {hasActiveFilters && (
                <div className="flex items-center gap-2 mb-4 flex-wrap">
                    <span className="text-sm text-gray-500">Filtros:</span>
                    {searchTerm && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                            Busca: "{searchTerm}"
                            <button onClick={() => setSearchTerm('')}><X className="h-3 w-3" /></button>
                        </span>
                    )}
                    {dateFilter && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                            Data: {format(parseISO(dateFilter), "d MMM yyyy", { locale: ptBR })}
                            <button onClick={() => setDateFilter('')}><X className="h-3 w-3" /></button>
                        </span>
                    )}
                    {typeFilter && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                            Tipo: {typeFilter}
                            <button onClick={() => setTypeFilter('')}><X className="h-3 w-3" /></button>
                        </span>
                    )}
                    <button onClick={clearFilters} className="text-xs text-gray-500 hover:text-gray-700 underline ml-1">
                        Limpar todos
                    </button>
                </div>
            )}

            {/* Processar reunião manualmente */}
            <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm mb-6">
                <h2 className="text-sm font-semibold text-gray-700 mb-3">Processar reunião por ID do Fireflies</h2>
                <form onSubmit={handleManualProcess} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    <input
                        type="text"
                        value={manualId}
                        onChange={(e) => setManualId(e.target.value)}
                        placeholder="Cole o Meeting ID do Fireflies aqui..."
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-blue-500 focus:border-blue-500"
                        disabled={processing}
                    />
                    <button
                        type="submit"
                        disabled={processing || !manualId.trim()}
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                    >
                        {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        {processing ? 'Processando...' : 'Processar'}
                    </button>
                </form>
                {processMessage && (
                    <p className={`mt-3 text-sm ${processMessage.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                        {processMessage.text}
                    </p>
                )}
            </div>

            {/* Loading state */}
            {loading ? (
                <div className="flex justify-center py-20">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                </div>
            ) : (
                <div className="space-y-4">
                    {filteredMeetings.length === 0 ? (
                        <div className="text-center py-20 text-gray-500 bg-gray-50 rounded-lg border border-gray-200">
                            {hasActiveFilters
                                ? 'Nenhuma reunião encontrada com os filtros aplicados.'
                                : 'Nenhuma reunião encontrada. Configure seu Webhook no app Fireflies.'}
                        </div>
                    ) : (
                        filteredMeetings.map((m) => (
                            <div
                                key={m.id}
                                className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm hover:shadow transition-shadow cursor-pointer"
                                onClick={() => navigate(`/reuniao/${m.id}`)}
                            >
                                <div className="flex justify-between items-start mb-2">
                                    {editingTitle === m.id ? (
                                        <div className="flex items-center gap-2 flex-1 pr-2" onClick={e => e.stopPropagation()}>
                                            <input
                                                type="text"
                                                value={editTitleValue}
                                                onChange={(e) => setEditTitleValue(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') handleTitleSave(e, m.id);
                                                    if (e.key === 'Escape') setEditingTitle(null);
                                                }}
                                                autoFocus
                                                className="flex-1 px-2 py-1 text-lg font-bold text-gray-900 border border-blue-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                            />
                                            <button
                                                onClick={(e) => handleTitleSave(e, m.id)}
                                                className="p-1.5 rounded-lg text-green-600 hover:bg-green-50 transition"
                                                title="Salvar"
                                            >
                                                <Check className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setEditingTitle(null); }}
                                                className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition"
                                                title="Cancelar"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ) : (
                                        <h3
                                            className="text-lg font-bold text-gray-900 pr-2 cursor-pointer hover:text-blue-600 transition"
                                            onClick={(e) => handleTitleClick(e, m)}
                                            title="Clique para editar o título"
                                        >
                                            {m.title}
                                        </h3>
                                    )}
                                    <div className="flex items-center gap-1 shrink-0">
                                        <button
                                            onClick={(e) => handleReprocess(e, m)}
                                            disabled={reprocessing === m.id}
                                            className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition disabled:opacity-50"
                                            title="Refazer análise da IA"
                                        >
                                            <RefreshCw className={`w-4 h-4 ${reprocessing === m.id ? 'animate-spin' : ''}`} />
                                        </button>
                                        <button
                                            onClick={(e) => handleDeleteClick(e, m.id, m.title)}
                                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition"
                                            title="Excluir reunião"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>

                                <div className="flex items-center text-sm text-gray-500 mb-3 space-x-2">
                                    <Clock className="w-4 h-4" />
                                    <span>
                                        {m.date ? format(parseISO(m.date), "d 'de' MMM, yyyy", { locale: ptBR }) : 'Sem data'} • {m.duration ? `${m.duration}m` : '0m'}
                                    </span>
                                </div>

                                <div className="mb-3 flex items-center flex-wrap gap-2">
                                    {m.status === 'processing' ? (
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                                            <Loader2 className="w-3 h-3 animate-spin" />
                                            Processando...
                                        </span>
                                    ) : m.status === 'error' ? (
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                                            <AlertCircle className="w-3 h-3" />
                                            Erro no processamento
                                        </span>
                                    ) : (
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${getBadgeColor(m.meeting_type)}`}>
                                            {m.meeting_type || 'Geral'}
                                        </span>
                                    )}
                                    {m.productivity_score != null && m.status === 'completed' && (
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                                            m.productivity_score >= 7 ? 'bg-green-100 text-green-700' :
                                            m.productivity_score >= 4 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                                        }`}>
                                            {m.productivity_score}/10
                                        </span>
                                    )}
                                </div>

                                <p className="text-gray-700 text-sm truncate">
                                    <span className="font-semibold text-gray-900">Resumo da IA: </span>
                                    {m.status === 'processing'
                                        ? 'A IA está analisando a reunião...'
                                        : m.status === 'error'
                                        ? 'Falha no processamento. Use o botão de reprocessar.'
                                        : m.executive_summary || 'Sem resumo disponível.'}
                                </p>
                            </div>
                        ))
                    )}
                </div>
            )}

        </div>
    );
}
