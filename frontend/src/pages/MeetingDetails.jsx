import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ArrowLeft, CheckCircle2, Share2, FileDown } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import Toast from '../components/Toast';

export default function MeetingDetails() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [meeting, setMeeting] = useState(null);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState(null);
    const [savingCheck, setSavingCheck] = useState(null);

    useEffect(() => {
        async function fetchMeeting() {
            const { data, error } = await supabase
                .from('meetings')
                .select('*')
                .eq('id', id)
                .single();

            if (!error && data) {
                setMeeting(data);
            }
            setLoading(false);
        }
        fetchMeeting();
    }, [id]);

    async function handleCheckItem(idx) {
        if (!meeting?.action_items) return;
        setSavingCheck(idx);

        const updatedItems = meeting.action_items.map((item, i) =>
            i === idx ? { ...item, checked: !item.checked } : item
        );

        const { error } = await supabase
            .from('meetings')
            .update({ action_items: updatedItems })
            .eq('id', meeting.id);

        if (!error) {
            setMeeting(prev => ({ ...prev, action_items: updatedItems }));
        } else {
            setToast({ message: 'Erro ao salvar item.', type: 'error' });
        }
        setSavingCheck(null);
    }

    function formatActionItem(item) {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object') {
            const tarefa = item.tarefa || '';
            const resp = item.responsavel && item.responsavel !== 'A definir' ? item.responsavel : null;
            const prazo = item.prazo && item.prazo !== 'A definir' ? item.prazo : null;
            const extras = [resp, prazo].filter(Boolean).join(' • ');
            return extras ? `${tarefa} _(${extras})_` : tarefa;
        }
        return '';
    }

    function buildShareText() {
        if (!meeting) return '';
        const dateStr = meeting.date ? format(parseISO(meeting.date), "d 'de' MMMM 'de' yyyy", { locale: ptBR }) : '';
        const lines = [];

        lines.push(`📋 *${meeting.title}*`);
        if (dateStr) lines.push(`📅 ${dateStr} • ${meeting.duration || 0}min`);
        if (meeting.meeting_type) lines.push(`🏷️ Tipo: ${meeting.meeting_type}`);
        lines.push('');

        if (meeting.objective) {
            lines.push('🎯 *Objetivo*');
            lines.push(meeting.objective);
            lines.push('');
        }

        if (meeting.executive_summary) {
            lines.push('📝 *Resumo Executivo*');
            lines.push(meeting.executive_summary);
            lines.push('');
        }

        if (Array.isArray(meeting.topics_discussed) && meeting.topics_discussed.length > 0) {
            lines.push('💬 *Tópicos Discutidos*');
            meeting.topics_discussed.forEach(t => lines.push(`• ${t}`));
            lines.push('');
        }

        if (meeting.decisions) {
            lines.push('✅ *Decisões-Chave*');
            lines.push(meeting.decisions);
            lines.push('');
        }

        if (meeting.action_items && Array.isArray(meeting.action_items) && meeting.action_items.length > 0) {
            lines.push('📌 *Itens de Ação*');
            meeting.action_items.forEach((item, i) => {
                lines.push(`${i + 1}. ${formatActionItem(item)}`);
            });
            lines.push('');
        }

        if (Array.isArray(meeting.pendencies) && meeting.pendencies.length > 0) {
            lines.push('⏳ *Pendências / Bloqueios*');
            meeting.pendencies.forEach(p => lines.push(`• ${p}`));
            lines.push('');
        }

        if (meeting.productivity_score != null) {
            lines.push(`📊 *Aproveitamento: ${meeting.productivity_score}/10*`);
            if (meeting.productivity_reason) lines.push(meeting.productivity_reason);
            lines.push('');
        }

        lines.push('_Gerado por AI Meet_');
        return lines.join('\n');
    }

    function handleShare() {
        const text = buildShareText();

        if (navigator.share) {
            navigator.share({ text }).catch(() => {});
        } else {
            const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
            window.open(whatsappUrl, '_blank');
        }
    }

    function handleGeneratePDF() {
        if (!meeting) return;

        const doc = new jsPDF('p', 'mm', 'a4');
        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = 20;
        const contentWidth = pageWidth - margin * 2;
        let y = 20;

        // Cores
        const darkBlue = [30, 41, 59];
        const blue = [37, 99, 235];
        const green = [34, 197, 94];
        const yellow = [234, 179, 8];
        const red = [239, 68, 68];
        const gray = [107, 114, 128];
        const lightGray = [243, 244, 246];

        // Header com fundo escuro
        doc.setFillColor(...darkBlue);
        doc.rect(0, 0, pageWidth, 35, 'F');

        doc.setTextColor(255, 255, 255);
        doc.setFontSize(20);
        doc.setFont('helvetica', 'bold');
        doc.text(meeting.title || 'Reunião', margin, 15);

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        const dateStr = meeting.date ? format(parseISO(meeting.date), "d 'de' MMMM 'de' yyyy", { locale: ptBR }) : '';
        const headerInfo = [dateStr, meeting.duration ? `${meeting.duration} min` : '', meeting.meeting_type || ''].filter(Boolean).join('  •  ');
        doc.text(headerInfo, margin, 25);

        if (meeting.productivity_score != null) {
            const scoreText = `Aproveitamento: ${meeting.productivity_score}/10`;
            const scoreWidth = doc.getTextWidth(scoreText) + 8;
            const scoreColor = meeting.productivity_score >= 7 ? green : meeting.productivity_score >= 4 ? yellow : red;
            doc.setFillColor(...scoreColor);
            doc.roundedRect(pageWidth - margin - scoreWidth, 18, scoreWidth, 8, 2, 2, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(8);
            doc.setFont('helvetica', 'bold');
            doc.text(scoreText, pageWidth - margin - scoreWidth + 4, 23.5);
        }

        y = 45;

        function checkPageBreak(needed) {
            if (y + needed > doc.internal.pageSize.getHeight() - 20) {
                doc.addPage();
                y = 20;
            }
        }

        function addSection(title, content) {
            if (!content) return;
            checkPageBreak(30);

            // Linha azul lateral + título
            doc.setFillColor(...blue);
            doc.rect(margin, y, 3, 8, 'F');
            doc.setTextColor(...darkBlue);
            doc.setFontSize(13);
            doc.setFont('helvetica', 'bold');
            doc.text(title, margin + 6, y + 6);
            y += 12;

            // Conteúdo
            doc.setTextColor(55, 65, 81);
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            const lines = doc.splitTextToSize(content, contentWidth - 6);
            lines.forEach(line => {
                checkPageBreak(6);
                doc.text(line, margin + 6, y);
                y += 5;
            });
            y += 6;
        }

        // Objetivo
        addSection('Objetivo da Reunião', meeting.objective);

        // Resumo Executivo
        addSection('Resumo Executivo', meeting.executive_summary);

        // Tópicos Discutidos
        if (Array.isArray(meeting.topics_discussed) && meeting.topics_discussed.length > 0) {
            checkPageBreak(30);
            doc.setFillColor(...blue);
            doc.rect(margin, y, 3, 8, 'F');
            doc.setTextColor(...darkBlue);
            doc.setFontSize(13);
            doc.setFont('helvetica', 'bold');
            doc.text('Topicos Discutidos', margin + 6, y + 6);
            y += 14;

            meeting.topics_discussed.forEach(topic => {
                checkPageBreak(8);
                doc.setFillColor(...blue);
                doc.circle(margin + 8, y - 1, 1.5, 'F');
                doc.setTextColor(55, 65, 81);
                doc.setFontSize(10);
                doc.setFont('helvetica', 'normal');
                const lines = doc.splitTextToSize(topic, contentWidth - 16);
                lines.forEach(line => {
                    checkPageBreak(6);
                    doc.text(line, margin + 12, y);
                    y += 5;
                });
                y += 2;
            });
            y += 4;
        }

        // Decisões-Chave
        if (meeting.decisions) {
            checkPageBreak(30);
            doc.setFillColor(...blue);
            doc.rect(margin, y, 3, 8, 'F');
            doc.setTextColor(...darkBlue);
            doc.setFontSize(13);
            doc.setFont('helvetica', 'bold');
            doc.text('Decisoes-Chave', margin + 6, y + 6);
            y += 14;

            const decisions = meeting.decisions.split('\n').filter(Boolean);
            decisions.forEach(decision => {
                checkPageBreak(8);
                doc.setFillColor(...green);
                doc.circle(margin + 8, y - 1, 1.5, 'F');
                doc.setTextColor(55, 65, 81);
                doc.setFontSize(10);
                doc.setFont('helvetica', 'normal');
                const text = decision.replace(/^- /, '');
                const lines = doc.splitTextToSize(text, contentWidth - 16);
                lines.forEach((line) => {
                    checkPageBreak(6);
                    doc.text(line, margin + 12, y);
                    y += 5;
                });
                y += 2;
            });
            y += 4;
        }

        // Aproveitamento
        if (meeting.productivity_score != null) {
            checkPageBreak(30);
            doc.setFillColor(...blue);
            doc.rect(margin, y, 3, 8, 'F');
            doc.setTextColor(...darkBlue);
            doc.setFontSize(13);
            doc.setFont('helvetica', 'bold');
            doc.text('Aproveitamento da Reuniao', margin + 6, y + 6);
            y += 14;

            // Barra de progresso
            const barWidth = 80;
            const barHeight = 6;
            doc.setFillColor(...lightGray);
            doc.roundedRect(margin + 6, y, barWidth, barHeight, 2, 2, 'F');
            const fillWidth = (meeting.productivity_score / 10) * barWidth;
            const barColor = meeting.productivity_score >= 7 ? green : meeting.productivity_score >= 4 ? yellow : red;
            doc.setFillColor(...barColor);
            doc.roundedRect(margin + 6, y, fillWidth, barHeight, 2, 2, 'F');

            doc.setTextColor(...barColor);
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.text(`${meeting.productivity_score}/10`, margin + barWidth + 12, y + 5);
            y += 12;

            if (meeting.productivity_reason) {
                doc.setTextColor(55, 65, 81);
                doc.setFontSize(10);
                doc.setFont('helvetica', 'normal');
                const lines = doc.splitTextToSize(meeting.productivity_reason, contentWidth - 6);
                lines.forEach(line => {
                    checkPageBreak(6);
                    doc.text(line, margin + 6, y);
                    y += 5;
                });
            }
            y += 6;
        }

        // Itens de Ação
        if (meeting.action_items && Array.isArray(meeting.action_items) && meeting.action_items.length > 0) {
            checkPageBreak(30);
            doc.setFillColor(...blue);
            doc.rect(margin, y, 3, 8, 'F');
            doc.setTextColor(...darkBlue);
            doc.setFontSize(13);
            doc.setFont('helvetica', 'bold');
            doc.text('Itens de Acao', margin + 6, y + 6);
            y += 14;

            meeting.action_items.forEach((item) => {
                checkPageBreak(10);

                // Checkbox
                doc.setDrawColor(...gray);
                doc.setLineWidth(0.3);
                doc.rect(margin + 6, y - 3, 4, 4);

                const isObj = item && typeof item === 'object';
                const tarefaText = isObj ? (item.tarefa || '') : String(item);

                // Texto da tarefa
                doc.setTextColor(55, 65, 81);
                doc.setFontSize(10);
                doc.setFont('helvetica', 'normal');
                const lines = doc.splitTextToSize(tarefaText, contentWidth - 18);
                lines.forEach(line => {
                    checkPageBreak(6);
                    doc.text(line, margin + 13, y);
                    y += 5;
                });

                // Responsável + prazo em cinza menor
                if (isObj) {
                    const resp = item.responsavel || 'A definir';
                    const prazo = item.prazo || 'A definir';
                    const metaText = `Responsavel: ${resp}  •  Prazo: ${prazo}`;
                    doc.setTextColor(...gray);
                    doc.setFontSize(8);
                    doc.setFont('helvetica', 'italic');
                    checkPageBreak(5);
                    doc.text(metaText, margin + 13, y);
                    y += 4;
                }
                y += 3;
            });
            y += 4;
        }

        // Pendências
        if (Array.isArray(meeting.pendencies) && meeting.pendencies.length > 0) {
            checkPageBreak(30);
            doc.setFillColor(...blue);
            doc.rect(margin, y, 3, 8, 'F');
            doc.setTextColor(...darkBlue);
            doc.setFontSize(13);
            doc.setFont('helvetica', 'bold');
            doc.text('Pendencias / Bloqueios', margin + 6, y + 6);
            y += 14;

            meeting.pendencies.forEach(pend => {
                checkPageBreak(8);
                doc.setFillColor(...yellow);
                doc.circle(margin + 8, y - 1, 1.5, 'F');
                doc.setTextColor(55, 65, 81);
                doc.setFontSize(10);
                doc.setFont('helvetica', 'normal');
                const lines = doc.splitTextToSize(pend, contentWidth - 16);
                lines.forEach(line => {
                    checkPageBreak(6);
                    doc.text(line, margin + 12, y);
                    y += 5;
                });
                y += 2;
            });
            y += 4;
        }

        // Footer
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            const pageH = doc.internal.pageSize.getHeight();
            doc.setFillColor(...lightGray);
            doc.rect(0, pageH - 12, pageWidth, 12, 'F');
            doc.setTextColor(...gray);
            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            doc.text('Gerado por AI Meet', margin, pageH - 5);
            doc.text(`Página ${i} de ${pageCount}`, pageWidth - margin - 20, pageH - 5);
        }

        // Salvar
        const fileName = (meeting.title || 'reuniao').replace(/[^a-zA-Z0-9À-ÿ\s-]/g, '').replace(/\s+/g, '_');
        doc.save(`${fileName}.pdf`);
        setToast({ message: 'PDF gerado com sucesso!', type: 'success' });
    }

    if (loading) return <div className="p-10 text-center text-gray-500">Carregando...</div>;
    if (!meeting) return <div className="p-10 text-center text-red-500">Reunião não encontrada.</div>;

    return (
        <div className="flex flex-col min-h-screen lg:h-screen bg-gray-50">
            {toast && (
                <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
            )}

            {/* Header */}
            <header className="bg-[#1e293b] text-white px-4 lg:px-6 py-4 flex flex-wrap items-center justify-between shrink-0 gap-2">
                <button
                    onClick={() => navigate('/dashboard')}
                    className="flex items-center space-x-2 text-sm font-medium text-gray-300 hover:text-white bg-[#0f172a] px-3 py-1.5 rounded border border-gray-700 transition"
                >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Voltar</span>
                </button>

                <h1 className="text-lg lg:text-xl font-semibold order-last w-full text-center lg:order-none lg:w-auto lg:absolute lg:left-1/2 lg:-translate-x-1/2">
                    {meeting.title || 'Detalhes da Reunião'}
                </h1>

                <div className="flex items-center gap-2">
                    <button
                        onClick={handleShare}
                        className="flex items-center gap-1.5 text-sm font-medium text-gray-300 hover:text-white bg-[#0f172a] px-3 py-1.5 rounded border border-gray-700 transition"
                        title="Compartilhar no WhatsApp"
                    >
                        <Share2 className="w-4 h-4" />
                        <span className="hidden sm:inline">Compartilhar</span>
                    </button>
                    <button
                        onClick={handleGeneratePDF}
                        className="flex items-center gap-1.5 text-sm font-medium text-gray-300 hover:text-white bg-[#0f172a] px-3 py-1.5 rounded border border-gray-700 transition"
                        title="Gerar PDF"
                    >
                        <FileDown className="w-4 h-4" />
                        <span className="hidden sm:inline">PDF</span>
                    </button>

                    <div className="hidden lg:flex items-center space-x-4 text-sm font-medium ml-2">
                        <span className="text-gray-300">
                            {meeting.date ? format(parseISO(meeting.date), "d 'de' MMMM, yyyy", { locale: ptBR }) : ''}
                        </span>
                        {meeting.meeting_type && (
                            <span className="bg-white text-gray-800 px-3 py-1 rounded-full text-xs font-bold">
                                {meeting.meeting_type}
                            </span>
                        )}
                    </div>
                </div>
            </header>

            {/* Main Content: Duas Colunas */}
            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden p-4 lg:p-6 gap-6">

                {/* Left Column: AI Analysis */}
                <div className="w-full lg:w-1/2 flex flex-col overflow-y-auto pr-0 lg:pr-2 space-y-4 pb-20">
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Análise da IA</h2>

                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                        <h3 className="text-sm font-bold text-gray-900 mb-2">Objetivo da Reunião</h3>
                        <p className="text-gray-700 text-sm leading-relaxed">{meeting.objective || 'Não disponível'}</p>
                    </div>

                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                        <h3 className="text-sm font-bold text-gray-900 mb-2">Resumo Executivo</h3>
                        <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-line">{meeting.executive_summary || 'Não disponível'}</p>
                    </div>

                    {Array.isArray(meeting.topics_discussed) && meeting.topics_discussed.length > 0 && (
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                            <h3 className="text-sm font-bold text-gray-900 mb-3">Tópicos Discutidos</h3>
                            <ul className="space-y-2">
                                {meeting.topics_discussed.map((t, idx) => (
                                    <li key={idx} className="flex items-start space-x-2">
                                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 shrink-0" />
                                        <span className="text-gray-700 text-sm leading-relaxed">{t}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                        <h3 className="text-sm font-bold text-gray-900 mb-3">Decisões-Chave</h3>
                        <ul className="space-y-2">
                            {meeting.decisions ? meeting.decisions.split('\n').filter(Boolean).map((decision, idx) => (
                                <li key={idx} className="flex items-start space-x-2">
                                    <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                                    <span className="text-gray-700 text-sm leading-relaxed">{decision.replace(/^- /, '')}</span>
                                </li>
                            )) : <li className="text-gray-500 text-sm">Não disponível</li>}
                        </ul>
                    </div>

                    {meeting.productivity_score != null && (
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                            <h3 className="text-sm font-bold text-gray-900 mb-3">Aproveitamento da Reunião</h3>
                            <div className="flex items-center gap-4 mb-3">
                                <div className="flex-1 bg-gray-200 rounded-full h-3 overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all duration-500 ${
                                            meeting.productivity_score >= 7 ? 'bg-green-500' :
                                            meeting.productivity_score >= 4 ? 'bg-yellow-500' : 'bg-red-500'
                                        }`}
                                        style={{ width: `${(meeting.productivity_score / 10) * 100}%` }}
                                    />
                                </div>
                                <span className={`text-lg font-bold ${
                                    meeting.productivity_score >= 7 ? 'text-green-600' :
                                    meeting.productivity_score >= 4 ? 'text-yellow-600' : 'text-red-600'
                                }`}>
                                    {meeting.productivity_score}/10
                                </span>
                            </div>
                            {meeting.productivity_reason && (
                                <p className="text-gray-600 text-sm leading-relaxed">{meeting.productivity_reason}</p>
                            )}
                            {meeting.productivity_criteria && typeof meeting.productivity_criteria === 'object' && (
                                <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {Object.entries({
                                        objetivos_claros: 'Objetivos claros',
                                        decisoes_tomadas: 'Decisões tomadas',
                                        responsaveis_definidos: 'Responsáveis definidos',
                                        prazos_definidos: 'Prazos definidos',
                                        foco_mantido: 'Foco mantido'
                                    }).map(([key, label]) => {
                                        const val = meeting.productivity_criteria[key];
                                        if (val === undefined) return null;
                                        return (
                                            <div key={key} className="flex items-center gap-2 text-xs">
                                                <span className={val ? 'text-green-600' : 'text-gray-400'}>
                                                    {val ? '✅' : '⬜'}
                                                </span>
                                                <span className={val ? 'text-gray-700' : 'text-gray-400'}>{label}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                        <h3 className="text-sm font-bold text-gray-900 mb-3">Itens de Ação</h3>
                        <ul className="space-y-3">
                            {meeting.action_items && Array.isArray(meeting.action_items) && meeting.action_items.length > 0 ?
                                meeting.action_items.map((item, idx) => {
                                    const isObj = item && typeof item === 'object';
                                    const tarefa = isObj ? (item.tarefa || '') : String(item);
                                    const resp = isObj ? item.responsavel : null;
                                    const prazo = isObj ? item.prazo : null;
                                    return (
                                        <li key={idx} className="flex items-start space-x-3">
                                            <input
                                                type="checkbox"
                                                checked={!!item.checked}
                                                disabled={savingCheck === idx}
                                                onChange={() => handleCheckItem(idx)}
                                                className="mt-1 w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer disabled:opacity-50"
                                            />
                                            <div className="flex-1">
                                                <span className={`text-sm leading-snug block transition-colors ${item.checked ? 'line-through text-gray-400' : 'text-gray-700'}`}>{tarefa}</span>
                                                {(resp || prazo) && (
                                                    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-xs text-gray-500">
                                                        {resp && (
                                                            <span>
                                                                <span className="font-medium">Responsável:</span>{' '}
                                                                <span className={resp === 'A definir' ? 'italic text-gray-400' : ''}>{resp}</span>
                                                            </span>
                                                        )}
                                                        {prazo && (
                                                            <span>
                                                                <span className="font-medium">Prazo:</span>{' '}
                                                                <span className={prazo === 'A definir' ? 'italic text-gray-400' : ''}>{prazo}</span>
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </li>
                                    );
                                }) : <p className="text-gray-500 text-sm">Não disponível</p>}
                        </ul>
                    </div>

                    {Array.isArray(meeting.pendencies) && meeting.pendencies.length > 0 && (
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                            <h3 className="text-sm font-bold text-gray-900 mb-3">Pendências / Bloqueios</h3>
                            <ul className="space-y-2">
                                {meeting.pendencies.map((p, idx) => (
                                    <li key={idx} className="flex items-start space-x-2">
                                        <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 mt-2 shrink-0" />
                                        <span className="text-gray-700 text-sm leading-relaxed">{p}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>

                {/* Right Column: Full Transcript */}
                <div className="w-full lg:w-1/2 flex flex-col h-[500px] lg:h-full bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-200 bg-gray-50/50">
                        <h2 className="text-xl font-bold text-gray-900">Transcrição Completa</h2>
                    </div>
                    <div className="flex-1 overflow-y-auto p-6 space-y-4">
                        {meeting.transcript && Array.isArray(meeting.transcript) ? (
                            meeting.transcript.map((msg, index) => (
                                <div key={index} className="bg-gray-100/70 p-4 rounded-xl">
                                    <div className="flex justify-between items-baseline mb-1">
                                        <span className="font-semibold text-gray-900 text-sm">{msg.speaker_name || `Participante ${msg.speaker_id}`}</span>
                                        <span className="text-xs text-gray-500">
                                            {msg.start_time ? new Date(msg.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                        </span>
                                    </div>
                                    <p className="text-gray-700 text-sm leading-relaxed">{msg.text}</p>
                                </div>
                            ))
                        ) : (
                            <div className="text-center text-gray-500 text-sm py-10">Transcrição não disponível.</div>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
}
