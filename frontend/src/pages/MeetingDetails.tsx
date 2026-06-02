import { useState, useEffect } from 'react';
import {
  ArrowLeft, CheckCircle2, Share2, RefreshCw,
  FileDown, AlertCircle,
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useToast } from '../context/ToastContext';
import './MeetingDetails.css';

const BACKEND_URL = 'https://n8n-backend.v6mtnf.easypanel.host';

interface ItemAcao {
  tarefa: string;
  responsavel: string;
  prazo: string;
}

interface AproveitamentoCriterios {
  objetivos_claros: boolean;
  decisoes_tomadas: boolean;
  responsaveis_definidos: boolean;
  prazos_definidos: boolean;
  foco_mantido: boolean;
}

interface Meeting {
  id: string;
  titulo: string;
  data: string;
  tipo_reuniao: string;
  objetivo: string;
  resumo_executivo: string;
  topicos_discutidos: string[];
  decisoes: string;
  itens_acao: ItemAcao[];
  pendencias: string[];
  aproveitamento_nota: number;
  aproveitamento_motivo: string;
  aproveitamento_criterios: AproveitamentoCriterios;
  transcricao_bruta: string;
  duration: number;
  status: string;
}

const criteriosLabels: Record<keyof AproveitamentoCriterios, string> = {
  objetivos_claros: 'Objetivos claros',
  decisoes_tomadas: 'Decisões tomadas',
  responsaveis_definidos: 'Responsáveis definidos',
  prazos_definidos: 'Prazos definidos',
  foco_mantido: 'Foco mantido',
};

const MeetingDetails: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [reprocessing, setReprocessing] = useState(false);
  const [checkedItems, setCheckedItems] = useState<Record<number, boolean>>({});
  const toast = useToast();

  const handleReprocess = async () => {
    if (!meeting) return;
    setReprocessing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sessão expirada');

      const res = await fetch(`${BACKEND_URL}/api/meetings/${meeting.id}/reprocess`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erro ao reprocessar');

      toast.info('Reprocessando reunião em segundo plano...');
      setMeeting((prev) => prev ? { ...prev, status: 'processando' } : prev);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setReprocessing(false);
    }
  };

  const handleShare = async () => {
    const url = window.location.href;
    const title = meeting?.titulo ?? 'ReuniãoAI';
    const text = meeting?.resumo_executivo
      ? `${meeting.resumo_executivo.slice(0, 120)}…`
      : 'Veja o resumo desta reunião no ReuniãoAI.';

    if (navigator.share) {
      try { await navigator.share({ title, text, url }); } catch { /* cancelado */ }
    } else {
      await navigator.clipboard.writeText(url);
      toast.info('Link copiado para a área de transferência.');
    }
  };

  const handleExportPDF = async () => {
    if (!meeting) return;
    try {
      const { jsPDF } = await import('jspdf');
      const autoTable = (await import('jspdf-autotable')).default;

      const doc = new jsPDF();
      const margin = 15;
      let y = 20;

      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text(meeting.titulo, margin, y);
      y += 8;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100);
      doc.text(`${formatDate(meeting.data)}  •  ${meeting.tipo_reuniao || ''}  •  Aproveitamento: ${meeting.aproveitamento_nota ?? '—'}/100`, margin, y);
      y += 10;

      if (meeting.objetivo) {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0);
        doc.text('Objetivo', margin, y);
        y += 6;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        const objLines = doc.splitTextToSize(meeting.objetivo, 180);
        doc.text(objLines, margin, y);
        y += objLines.length * 5 + 6;
      }

      if (meeting.resumo_executivo) {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0);
        doc.text('Resumo Executivo', margin, y);
        y += 6;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        const resLines = doc.splitTextToSize(meeting.resumo_executivo, 180);
        doc.text(resLines, margin, y);
        y += resLines.length * 5 + 6;
      }

      if (meeting.itens_acao?.length > 0) {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Itens de Ação', margin, y);
        y += 4;
        autoTable(doc, {
          startY: y,
          head: [['Tarefa', 'Responsável', 'Prazo']],
          body: meeting.itens_acao.map((i) => [i.tarefa, i.responsavel, i.prazo]),
          margin: { left: margin, right: margin },
          styles: { fontSize: 9 },
        });
        y = (doc as any).lastAutoTable.finalY + 8;
      }

      if (meeting.pendencias?.length > 0) {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Pendências', margin, y);
        y += 6;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        meeting.pendencias.forEach((p) => {
          const lines = doc.splitTextToSize(`• ${p}`, 180);
          doc.text(lines, margin, y);
          y += lines.length * 5 + 2;
        });
      }

      doc.save(`${meeting.titulo.replace(/\s+/g, '_')}.pdf`);
      toast.success('PDF exportado com sucesso!');
    } catch {
      toast.error('Erro ao exportar PDF. Verifique se jspdf está instalado.');
    }
  };

  useEffect(() => {
    const fetchMeeting = async () => {
      if (!id) return;
      const { data, error } = await supabase
        .from('meetings')
        .select('*')
        .eq('id', id)
        .single();
      if (!error && data) setMeeting(data);
      setLoading(false);
    };
    fetchMeeting();
  }, [id]);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('pt-BR', {
      day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });

  const parseTranscript = (raw: string) =>
    raw.split('\n').filter(Boolean).map((line, i) => {
      const colonIdx = line.indexOf(':');
      if (colonIdx === -1) return { key: i, speaker: '', text: line };
      return { key: i, speaker: line.slice(0, colonIdx).trim(), text: line.slice(colonIdx + 1).trim() };
    });

  const toggleItem = (i: number) =>
    setCheckedItems((prev) => ({ ...prev, [i]: !prev[i] }));

  if (loading) return <div className="details-loading"><p>Carregando reunião...</p></div>;

  if (!meeting) {
    return (
      <div className="details-loading">
        <button className="btn-back" onClick={() => navigate('/dashboard')}>
          <ArrowLeft size={16} /> Voltar
        </button>
        <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>Reunião não encontrada.</p>
      </div>
    );
  }

  const transcriptLines = meeting.transcricao_bruta ? parseTranscript(meeting.transcricao_bruta) : [];
  const nota = meeting.aproveitamento_nota ?? null;
  // normaliza: aceita tanto escala 0-10 quanto 0-100 legado
  const notaNorm = nota === null ? null : nota > 10 ? Math.round(nota / 10) : nota;
  const notaColor = notaNorm === null ? '#94a3b8' : notaNorm >= 8 ? '#16a34a' : notaNorm >= 5 ? '#d97706' : '#dc2626';

  return (
    <div className="details-container">

      {/* Header escuro */}
      <div className="details-header-dark">
        <button className="btn-back-dark" onClick={() => navigate('/dashboard')}>
          <ArrowLeft size={16} /> Voltar
        </button>
        <h2 className="details-header-title">Detalhes da Reunião</h2>
        <div className="details-header-actions">
          {(meeting.status === 'erro' || meeting.status === 'concluido') && (
            <button className="btn-header-action" onClick={handleReprocess} disabled={reprocessing} title="Reprocessar">
              <RefreshCw size={15} className={reprocessing ? 'spin' : ''} />
            </button>
          )}
          <button className="btn-header-action" onClick={handleExportPDF} title="Exportar PDF">
            <FileDown size={15} />
          </button>
          <button className="btn-header-action" onClick={handleShare} title="Compartilhar">
            <Share2 size={15} />
          </button>
        </div>
      </div>

      {/* Conteúdo — coluna única com scroll */}
      <div className="details-body">
        <div className="analysis-col">

          <h2 className="analysis-section-title">Análise da IA</h2>

          {/* Objetivo */}
          {meeting.objetivo && (
            <div className="analysis-card">
              <h3 className="analysis-card-title">Objetivo da Reunião</h3>
              <p className="analysis-card-text">{meeting.objetivo}</p>
            </div>
          )}

          {/* Resumo executivo */}
          {meeting.resumo_executivo && (
            <div className="analysis-card">
              <h3 className="analysis-card-title">Resumo Executivo</h3>
              <p className="analysis-card-text" style={{ whiteSpace: 'pre-line' }}>{meeting.resumo_executivo}</p>
            </div>
          )}

          {/* Decisões */}
          {meeting.decisoes && (
            <div className="analysis-card">
              <h3 className="analysis-card-title">Decisões-Chave</h3>
              <ul className="decision-list">
                {meeting.decisoes.split('\n').filter(Boolean).map((d, i) => (
                  <li key={i} className="decision-item">
                    <CheckCircle2 size={18} className="decision-icon" />
                    <span>{d.replace(/^[•\-]\s*/, '')}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Aproveitamento */}
          {notaNorm !== null && (
            <div className="analysis-card">
              <h3 className="analysis-card-title">Aproveitamento da Reunião</h3>
              <div className="nota-bar-solid-wrap">
                <div className="nota-bar-solid-track">
                  <div
                    className="nota-bar-solid-fill"
                    style={{ width: `${notaNorm * 10}%`, backgroundColor: notaColor }}
                  />
                </div>
                <span className="nota-bar-solid-label" style={{ color: notaColor }}>
                  {notaNorm}/10
                </span>
              </div>
              {meeting.aproveitamento_motivo && (
                <p className="analysis-card-text" style={{ marginTop: '0.75rem' }}>
                  {meeting.aproveitamento_motivo}
                </p>
              )}
              {meeting.aproveitamento_criterios && (
                <div className="criterios-grid" style={{ marginTop: '0.75rem' }}>
                  {(Object.keys(criteriosLabels) as Array<keyof AproveitamentoCriterios>).map((key) => (
                    <div key={key} className={`criterio-item ${meeting.aproveitamento_criterios[key] ? 'criterio-ok' : 'criterio-fail'}`}>
                      <span className="criterio-dot" />
                      {criteriosLabels[key]}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Itens de Ação */}
          {meeting.itens_acao?.length > 0 && (
            <div className="analysis-card">
              <h3 className="analysis-card-title">Itens de Ação</h3>
              <div className="action-items-list">
                {meeting.itens_acao.map((item, i) => (
                  <div key={i} className={`action-item ${checkedItems[i] ? 'action-item-done' : ''}`}
                    onClick={() => toggleItem(i)}>
                    <input
                      type="checkbox"
                      className="action-checkbox-sq"
                      checked={!!checkedItems[i]}
                      onChange={() => toggleItem(i)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <span className="action-tarefa">{item.tarefa}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pendências */}
          {meeting.pendencias?.length > 0 && (
            <div className="analysis-card">
              <h3 className="analysis-card-title">Pendências</h3>
              <ul className="decision-list">
                {meeting.pendencias.map((item, i) => (
                  <li key={i} className="decision-item">
                    <AlertCircle size={16} className="pending-icon" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Tópicos */}
          {meeting.topicos_discutidos?.length > 0 && (
            <div className="analysis-card">
              <h3 className="analysis-card-title">Tópicos Discutidos</h3>
              <div className="word-cloud">
                {meeting.topicos_discutidos.map((t, i) => (
                  <span key={i} className={`word ${i % 3 === 0 ? 'w-large' : i % 3 === 1 ? 'w-medium' : 'w-small'}`}>
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Transcrição completa — abaixo de tudo */}
          {transcriptLines.length > 0 && (
            <div className="analysis-card">
              <h3 className="analysis-card-title">Transcrição Completa</h3>
              <div className="transcript-list">
                {transcriptLines.map((line) => (
                  <div key={line.key} className="transcript-card">
                    <div className="transcript-card-header">
                      <span className="speaker">{line.speaker || 'Participante'}</span>
                    </div>
                    <p className="speech-text">{line.text}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default MeetingDetails;
