import { Router, Request, Response } from 'express';
import { supabase, supabaseAs } from '../services/supabaseClient';
import { fetchFirefliesTranscript, listFirefliesTranscripts } from '../services/firefliesService';
import { analyzeMeetingTranscript } from '../services/aiService';
import OpenAI from 'openai';

const router = Router();

function extractToken(authHeader: string | undefined): string | null {
  if (!authHeader?.startsWith('Bearer ')) return null;
  return authHeader.split(' ')[1];
}

async function getUserProfile(token: string) {
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;

  const db = supabaseAs(token);
  const { data: profile } = await db
    .from('profiles')
    .select('id, openai_api_key, fireflies_api_key, fireflies_webhook_secret')
    .eq('id', user.id)
    .single();

  return profile ?? null;
}

// GET /api/meetings/diagnose — testa conectividade com Fireflies e OpenAI
router.get('/diagnose', async (req: Request, res: Response) => {
  const token = extractToken(req.headers.authorization);
  if (!token) return res.status(401).json({ error: 'Token inválido' });

  const profile = await getUserProfile(token);
  if (!profile) return res.status(401).json({ error: 'Usuário não encontrado' });

  const result: Record<string, any> = {
    fireflies_key_configured: !!profile.fireflies_api_key,
    openai_key_configured: !!profile.openai_api_key,
    fireflies: null,
    openai: null,
  };

  // Testa Fireflies
  if (profile.fireflies_api_key) {
    try {
      const transcripts = await listFirefliesTranscripts(profile.fireflies_api_key, 1);
      result.fireflies = { ok: true, transcripts_found: transcripts.length };
    } catch (err: any) {
      result.fireflies = { ok: false, error: err.message };
    }
  }

  // Testa OpenAI
  if (profile.openai_api_key) {
    const openai = new OpenAI({ apiKey: profile.openai_api_key });
    try {
      await openai.chat.completions.create({
        model: 'gpt-5-mini',
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 5,
      });
      result.openai = { ok: true, model: 'gpt-5-mini' };
    } catch (err: any) {
      try {
        await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: 'ping' }],
          max_tokens: 5,
        });
        result.openai = { ok: true, model: 'gpt-4o-mini (fallback)', gpt5_error: err.message };
      } catch (err2: any) {
        result.openai = { ok: false, error: err2.message, gpt5_error: err.message };
      }
    }
  }

  return res.json(result);
});

// POST /api/meetings/sync-fireflies — importa reuniões recentes da conta Fireflies
router.post('/sync-fireflies', async (req: Request, res: Response) => {
  const token = extractToken(req.headers.authorization);
  if (!token) return res.status(401).json({ error: 'Token inválido ou expirado' });

  const profile = await getUserProfile(token);
  if (!profile) return res.status(401).json({ error: 'Token inválido ou expirado' });
  if (!profile.fireflies_api_key) return res.status(400).json({ error: 'Configure sua chave do Fireflies nas configurações' });
  if (!profile.openai_api_key) return res.status(400).json({ error: 'Configure sua chave da OpenAI nas configurações' });

  const db = supabaseAs(token);

  try {
    const transcripts = await listFirefliesTranscripts(profile.fireflies_api_key);

    const { data: existing } = await db
      .from('meetings')
      .select('fireflies_id')
      .eq('user_id', profile.id)
      .not('fireflies_id', 'is', null);

    const existingIds = new Set((existing || []).map((m: any) => m.fireflies_id));
    const newTranscripts = transcripts.filter((t) => !existingIds.has(t.id));

    console.log(`Sync debug — Fireflies: ${transcripts.length} | DB existentes: ${existingIds.size} | Novos: ${newTranscripts.length}`);
    console.log('IDs Fireflies:', transcripts.map((t) => t.id));
    console.log('IDs no banco:', [...existingIds]);

    if (newTranscripts.length === 0) {
      return res.json({ success: true, imported: 0, _debug: { fireflies: transcripts.length, existing: existingIds.size } });
    }

    const inserts = newTranscripts.map((t) => ({
      user_id: profile.id,
      titulo: t.title || 'Reunião sem título',
      data: t.date ? new Date(t.date).toISOString() : new Date().toISOString(),
      status: 'processando',
      fireflies_id: t.id,
      duration: t.duration ? Math.round(t.duration) : null,
    }));

    const { data: newMeetings, error: insertError } = await db
      .from('meetings')
      .insert(inserts)
      .select('id, fireflies_id, titulo');

    if (insertError || !newMeetings) {
      console.error('Erro ao importar reuniões:', insertError);
      return res.status(500).json({ error: insertError?.message || 'Erro ao importar reuniões' });
    }

    res.json({ success: true, imported: newMeetings.length });

    // Processa cada reunião nova em background
    for (const meeting of newMeetings) {
      (async () => {
        try {
          const result = await fetchFirefliesTranscript(meeting.fireflies_id, profile.fireflies_api_key || undefined);
          const analysis = await analyzeMeetingTranscript(result.text, profile.openai_api_key);

          await db
            .from('meetings')
            .update({
              tipo_reuniao: analysis.tipo_reuniao,
              objetivo: analysis.objetivo,
              resumo_executivo: analysis.resumo_executivo,
              topicos_discutidos: analysis.topicos_discutidos,
              decisoes: analysis.decisoes,
              itens_acao: analysis.itens_acao,
              pendencias: analysis.pendencias,
              aproveitamento_nota: analysis.aproveitamento_nota,
              aproveitamento_motivo: analysis.aproveitamento_motivo,
              aproveitamento_criterios: analysis.aproveitamento_criterios,
              transcript: result.transcript,
              transcricao_bruta: result.text,
              duration: result.duration,
              status: 'concluido',
            })
            .eq('id', meeting.id);

          console.log(`Sync: reunião ${meeting.id} processada.`);
        } catch (err: any) {
          console.error(`Sync: erro ao processar ${meeting.id}:`, err.message);
          await db.from('meetings').update({ status: 'erro' }).eq('id', meeting.id);
        }
      })();
    }

  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Erro ao sincronizar com Fireflies' });
  }
});

// POST /api/meetings/process — processa manualmente pelo Transcript ID
router.post('/process', async (req: Request, res: Response) => {
  try {
    const { transcript_id } = req.body;
    if (!transcript_id) return res.status(400).json({ error: 'transcript_id é obrigatório' });

    const token = extractToken(req.headers.authorization);
    if (!token) return res.status(401).json({ error: 'Token inválido ou expirado' });

    const profile = await getUserProfile(token);
    if (!profile) return res.status(401).json({ error: 'Token inválido ou expirado' });
    if (!profile.fireflies_api_key) return res.status(400).json({ error: 'Configure sua chave do Fireflies nas configurações' });
    if (!profile.openai_api_key) return res.status(400).json({ error: 'Configure sua chave da OpenAI nas configurações' });

    const db = supabaseAs(token);

    const { data: newMeeting, error: insertError } = await db
      .from('meetings')
      .insert({
        user_id: profile.id,
        titulo: 'Processando...',
        data: new Date().toISOString(),
        status: 'processando',
        fireflies_id: transcript_id,
      })
      .select('id')
      .single();

    if (insertError || !newMeeting) {
      return res.status(500).json({ error: 'Erro ao criar reunião' });
    }

    res.status(202).json({ success: true, meeting_id: newMeeting.id });

    (async () => {
      try {
        const result = await fetchFirefliesTranscript(transcript_id, profile.fireflies_api_key || undefined);
        const analysis = await analyzeMeetingTranscript(result.text, profile.openai_api_key);

        await db
          .from('meetings')
          .update({
            titulo: result.transcript.title || 'Reunião processada',
            tipo_reuniao: analysis.tipo_reuniao,
            objetivo: analysis.objetivo,
            resumo_executivo: analysis.resumo_executivo,
            topicos_discutidos: analysis.topicos_discutidos,
            decisoes: analysis.decisoes,
            itens_acao: analysis.itens_acao,
            pendencias: analysis.pendencias,
            aproveitamento_nota: analysis.aproveitamento_nota,
            aproveitamento_motivo: analysis.aproveitamento_motivo,
            aproveitamento_criterios: analysis.aproveitamento_criterios,
            transcript: result.transcript,
            transcricao_bruta: result.text,
            duration: result.duration,
            status: 'concluido',
          })
          .eq('id', newMeeting.id);
      } catch (err: any) {
        const msg = err?.message || String(err);
        console.error(`[process] ERRO ao processar transcript "${transcript_id}": ${msg}`);
        await db.from('meetings').update({ status: 'erro' }).eq('id', newMeeting.id);
      }
    })();

  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Erro interno' });
  }
});

// POST /api/meetings/:id/reprocess — reanalisa com IA; busca no Fireflies se não houver transcrição salva
router.post('/:id/reprocess', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const token = extractToken(req.headers.authorization);
    if (!token) return res.status(401).json({ error: 'Token inválido ou expirado' });

    const profile = await getUserProfile(token);
    if (!profile) return res.status(401).json({ error: 'Token inválido ou expirado' });
    if (!profile.openai_api_key) return res.status(400).json({ error: 'Configure sua chave da OpenAI nas configurações' });

    const db = supabaseAs(token);

    const { data: meeting, error: fetchError } = await db
      .from('meetings')
      .select('id, transcricao_bruta, transcript, fireflies_id, status')
      .eq('id', id)
      .eq('user_id', profile.id)
      .single();

    if (fetchError || !meeting) return res.status(404).json({ error: 'Reunião não encontrada' });

    const hasTranscript = meeting.transcricao_bruta || (meeting.transcript && Object.keys(meeting.transcript).length > 0);
    const canRefetch = meeting.fireflies_id && profile.fireflies_api_key;

    if (!hasTranscript && !canRefetch) {
      return res.status(400).json({ error: 'Sem transcrição disponível. Configure sua chave do Fireflies nas configurações.' });
    }

    if (meeting.status === 'processando') {
      return res.status(409).json({ error: 'Reunião já está sendo processada' });
    }

    await db.from('meetings').update({ status: 'processando' }).eq('id', id);
    res.status(202).json({ success: true });

    (async () => {
      try {
        let transcriptText = meeting.transcricao_bruta || '';
        if (!transcriptText && meeting.transcript?.sentences) {
          transcriptText = meeting.transcript.sentences
            .map((s: any) => `${s.speaker_name}: ${s.text}`)
            .join('\n');
        }

        // Sem transcrição salva: busca novamente no Fireflies
        if (!transcriptText && meeting.fireflies_id) {
          console.log(`Reprocess: buscando transcrição no Fireflies para ${meeting.fireflies_id}`);
          const result = await fetchFirefliesTranscript(meeting.fireflies_id, profile.fireflies_api_key || undefined);
          transcriptText = result.text;
          await db.from('meetings').update({
            transcript: result.transcript,
            transcricao_bruta: result.text,
            duration: result.duration,
          }).eq('id', id);
        }

        const analysis = await analyzeMeetingTranscript(transcriptText, profile.openai_api_key);

        await db
          .from('meetings')
          .update({
            tipo_reuniao: analysis.tipo_reuniao,
            objetivo: analysis.objetivo,
            resumo_executivo: analysis.resumo_executivo,
            topicos_discutidos: analysis.topicos_discutidos,
            decisoes: analysis.decisoes,
            itens_acao: analysis.itens_acao,
            pendencias: analysis.pendencias,
            aproveitamento_nota: analysis.aproveitamento_nota,
            aproveitamento_motivo: analysis.aproveitamento_motivo,
            aproveitamento_criterios: analysis.aproveitamento_criterios,
            status: 'concluido',
          })
          .eq('id', id);

        console.log(`Reunião ${id} reprocessada com sucesso.`);
      } catch (err: any) {
        console.error(`Erro ao reprocessar reunião ${id}:`, err.message);
        await db.from('meetings').update({ status: 'erro' }).eq('id', id);
      }
    })();

  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Erro interno' });
  }
});

export default router;
