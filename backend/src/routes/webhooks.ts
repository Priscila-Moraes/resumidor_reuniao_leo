import { Router, Request, Response } from 'express';
import { supabase } from '../services/supabaseClient';
import { fetchFirefliesTranscript } from '../services/firefliesService';
import { analyzeMeetingTranscript } from '../services/aiService';

const router = Router();

// POST /api/webhooks/fireflies/:user_secret
// URL única por usuário — gerada automaticamente no cadastro
router.post('/fireflies/:user_secret', async (req: Request, res: Response) => {
  try {
    const { user_secret } = req.params;
    const payload = req.body;

    console.log('Webhook do Fireflies recebido:', JSON.stringify(payload));

    const transcriptId = payload?.meetingId || payload?.transcript?.id || payload?.transcript_id;
    const meetingTitle = payload?.transcript?.title || payload?.title || 'Reunião sem título';
    const rawDate = payload?.transcript?.date || payload?.date;
    const meetingDate = rawDate
      ? (typeof rawDate === 'number' ? new Date(rawDate).toISOString() : rawDate)
      : new Date().toISOString();

    if (!transcriptId) {
      return res.status(400).json({ error: 'Missing transcript_id in payload' });
    }

    // Busca o perfil pelo secret via RPC (SECURITY DEFINER, não precisa de JWT)
    const { data: profiles, error: profileError } = await supabase
      .rpc('get_profile_by_webhook_secret', { p_secret: user_secret });

    if (profileError || !profiles || profiles.length === 0) {
      console.error('Secret inválido:', user_secret);
      return res.status(401).json({ error: 'Invalid webhook secret' });
    }

    const profile = profiles[0];

    if (!profile.openai_api_key) {
      return res.status(400).json({ error: 'User has no OpenAI API Key configured' });
    }

    // Insere reunião com status 'processando' e retorna 202 imediatamente
    const { data: newMeeting, error: insertError } = await supabase
      .from('meetings')
      .insert({
        user_id: profile.id,
        titulo: meetingTitle,
        data: meetingDate,
        status: 'processando',
        fireflies_id: transcriptId,
      })
      .select('id')
      .single();

    if (insertError || !newMeeting) {
      console.error('Erro ao criar reunião:', insertError);
      return res.status(500).json({ error: 'Failed to create meeting' });
    }

    res.status(202).json({ success: true, meeting_id: newMeeting.id });

    // Processamento assíncrono em background
    (async () => {
      try {
        const result = await fetchFirefliesTranscript(transcriptId, profile.fireflies_api_key || undefined);
        const analysis = await analyzeMeetingTranscript(result.text, profile.openai_api_key);

        await supabase
          .from('meetings')
          .update({
            titulo: analysis.titulo || meetingTitle,
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

        console.log(`Reunião ${newMeeting.id} processada com sucesso.`);
      } catch (err: any) {
        console.error(`Erro ao processar reunião ${newMeeting.id}:`, err.message);
        await supabase
          .from('meetings')
          .update({ status: 'erro' })
          .eq('id', newMeeting.id);
      }
    })();

  } catch (error: any) {
    console.error('Erro geral no webhook:', error.message);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
