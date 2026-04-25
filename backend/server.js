require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const { fetchMeetingTranscript, fetchRecentTranscriptIds } = require('./services/fireflies');
const { analyzeTranscript } = require('./services/openai');

const app = express();

const allowedOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Origem não permitida pelo CORS.'));
  }
}));
app.use(express.json({ limit: '128kb' }));

const rateLimitStore = new Map();
const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS || 60_000);
const RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX || 30);

function rateLimit(req, res, next) {
  const secret = req.params.user_secret || req.body?.user_secret || 'global';
  const key = `${req.ip}:${secret}`;
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return next();
  }

  entry.count += 1;
  if (entry.count > RATE_LIMIT_MAX) {
    return res.status(429).json({ error: 'Muitas requisições. Tente novamente em instantes.' });
  }

  return next();
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn("Aviso: SUPABASE_URL ou SUPABASE_ANON_KEY não configurado.");
}

const supabase = createClient(supabaseUrl || 'https://mock.supabase.co', supabaseKey || 'mock_key');

app.get('/health', (req, res) => {
  res.json({ status: 'OK' });
});

app.post('/api/webhooks/fireflies/:user_secret', rateLimit, async (req, res) => {
  const { user_secret } = req.params;
  const { meetingId } = req.body;

  console.log('Webhook recebido:', JSON.stringify(req.body));

  if (!meetingId || typeof meetingId !== 'string') {
    return res.status(400).json({ error: 'meetingId é obrigatório' });
  }

  if (meetingId.length > 200) {
    return res.status(400).json({ error: 'meetingId inválido' });
  }

  try {
    // 1. Validar e buscar perfil pelo `user_secret` usando a RPC (contorna RLS de forma segura)
    const { data: profile, error: profileError } = await supabase
      .rpc('get_profile_by_webhook_secret', { p_secret: user_secret });

    if (profileError || !profile || profile.length === 0) {
      return res.status(401).json({ error: 'Webhook Secret Inválido ou Usuário não encontrado.' });
    }

    const { id: userId, openai_api_key, fireflies_api_key } = profile[0];

    if (!openai_api_key) {
      console.error(`Usuário ${userId} não configurou a OpenAI API Key.`);
      return res.status(400).json({ error: 'OpenAI API Key não configurada para este usuário.' });
    }

    if (!fireflies_api_key) {
      console.error(`Usuário ${userId} não configurou a Fireflies API Key.`);
      return res.status(400).json({ error: 'Fireflies API Key não configurada para este usuário.' });
    }

    res.status(202).json({ message: 'Webhook recebido, processamento iniciado assincronamente.' });

    // 2. Processar a reunião assincronamente
    processMeeting(meetingId, userId, openai_api_key, fireflies_api_key).catch(err => {
      console.error('Erro no processAssync:', err);
    });

  } catch (error) {
    console.error('Erro no Webhook:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Erro interno no webhook' });
    }
  }
});

async function updateMeetingStatus(firefliesId, userId, status, fields = {}) {
  const { error } = await supabase.rpc('process_webhook_meeting', {
    p_user_id: userId,
    p_fireflies_id: firefliesId,
    p_title: fields.title || 'Reunião Importada',
    p_date: fields.date || new Date().toISOString(),
    p_duration: fields.duration || 0,
    p_meeting_type: fields.meeting_type || null,
    p_objective: fields.objective || null,
    p_executive_summary: fields.executive_summary || null,
    p_decisions: fields.decisions || null,
    p_action_items: fields.action_items || null,
    p_transcript: fields.transcript || null,
    p_status: status,
    p_productivity_score: fields.productivity_score || null,
    p_productivity_reason: fields.productivity_reason || null,
    p_topics_discussed: fields.topics_discussed || null,
    p_pendencies: fields.pendencies || null,
    p_productivity_criteria: fields.productivity_criteria || null,
  });
  if (error) console.error(`[DB] Erro ao atualizar status '${status}' para ${firefliesId}:`, error.message);
  return !error;
}

async function processMeeting(firefliesId, userId, openAiKey, firefliesApiKey) {
  console.log(`[START] Processando ${firefliesId}`);

  try {
    // A. Buscar transcrição do Fireflies
    console.log(`[FIREFLIES] Buscando transcrição de ${firefliesId}...`);
    const transcriptData = await fetchMeetingTranscript(firefliesId, firefliesApiKey);
    if (!transcriptData) throw new Error("Transcrição não encontrada no Fireflies.");
    console.log(`[FIREFLIES] Transcrição obtida. ${transcriptData.sentences?.length || 0} frases.`);

    // B. Analisar com OpenAI
    console.log(`[OPENAI] Iniciando análise de ${firefliesId}...`);
    const analysis = await analyzeTranscript(transcriptData.text, openAiKey);
    console.log(`[OPENAI] Análise concluída para ${firefliesId}.`);

    // C. Salvar resultado completo
    const saved = await updateMeetingStatus(firefliesId, userId, 'completed', {
      title: transcriptData.title || 'Reunião Importada',
      date: transcriptData.date ? new Date(transcriptData.date).toISOString() : new Date().toISOString(),
      duration: transcriptData.duration || 0,
      meeting_type: analysis.tipo_reuniao,
      objective: analysis.objetivo,
      executive_summary: analysis.resumo_executivo,
      decisions: analysis.decisoes,
      action_items: analysis.itens_acao,
      transcript: transcriptData.sentences,
      productivity_score: analysis.aproveitamento_nota,
      productivity_reason: analysis.aproveitamento_motivo,
      topics_discussed: analysis.topicos_discutidos || null,
      pendencies: analysis.pendencias || null,
      productivity_criteria: analysis.aproveitamento_criterios || null,
    });

    if (saved) console.log(`[DONE] Reunião ${firefliesId} processada com sucesso.`);

  } catch (error) {
    const msg = error?.message || String(error);
    console.error(`[ERROR] Falha ao processar ${firefliesId}: ${msg}`);
    await updateMeetingStatus(firefliesId, userId, 'error', {});
  }
}

// Endpoint para reprocessar análise usando transcrição já salva no banco
app.post('/api/meetings/:meetingId/reprocess', rateLimit, async (req, res) => {
  const { meetingId } = req.params;
  const { user_secret } = req.body;

  if (!user_secret || typeof user_secret !== 'string') {
    return res.status(400).json({ error: 'user_secret é obrigatório' });
  }

  try {
    // 1. Validar usuário pelo webhook secret
    const { data: profile, error: profileError } = await supabase
      .rpc('get_profile_by_webhook_secret', { p_secret: user_secret });

    if (profileError || !profile || profile.length === 0) {
      return res.status(401).json({ error: 'Secret inválido ou usuário não encontrado.' });
    }

    const { id: userId, openai_api_key } = profile[0];

    if (!openai_api_key) {
      return res.status(400).json({ error: 'OpenAI API Key não configurada.' });
    }

    // 2. Buscar reunião do banco (com transcrição já salva)
    const { data: meeting, error: meetingError } = await supabase
      .rpc('get_meeting_for_reprocess', { p_meeting_id: meetingId, p_user_id: userId });

    if (meetingError || !meeting || meeting.length === 0) {
      return res.status(404).json({ error: 'Reunião não encontrada ou sem permissão.' });
    }

    const meetingData = meeting[0];

    if (!meetingData.transcript || meetingData.transcript.length === 0) {
      return res.status(400).json({ error: 'Transcrição não encontrada no banco. Tente reprocessar pelo webhook.' });
    }

    res.status(202).json({ message: 'Reprocessamento iniciado.' });

    // 3. Reconstruir texto da transcrição a partir das sentences salvas
    const transcriptText = meetingData.transcript
      .map(s => `${s.speaker_name}: ${s.text}`)
      .join('\n');

    // 4. Atualizar status para processing
    await supabase.rpc('process_webhook_meeting', {
      p_user_id: userId,
      p_fireflies_id: meetingData.fireflies_id,
      p_title: meetingData.title,
      p_date: meetingData.date,
      p_duration: meetingData.duration,
      p_meeting_type: null,
      p_objective: null,
      p_executive_summary: null,
      p_decisions: null,
      p_action_items: null,
      p_transcript: meetingData.transcript,
      p_status: 'processing',
      p_productivity_score: null,
      p_productivity_reason: null
    });

    try {
      // 5. Analisar com OpenAI
      const analysis = await analyzeTranscript(transcriptText, openai_api_key);

      // 6. Atualizar com resultado
      await supabase.rpc('process_webhook_meeting', {
        p_user_id: userId,
        p_fireflies_id: meetingData.fireflies_id,
        p_title: analysis.titulo || meetingData.title,
        p_date: meetingData.date,
        p_duration: meetingData.duration,
        p_meeting_type: analysis.tipo_reuniao,
        p_objective: analysis.objetivo,
        p_executive_summary: analysis.resumo_executivo,
        p_decisions: analysis.decisoes,
        p_action_items: analysis.itens_acao,
        p_transcript: meetingData.transcript,
        p_status: 'completed',
        p_productivity_score: analysis.aproveitamento_nota,
        p_productivity_reason: analysis.aproveitamento_motivo,
        p_topics_discussed: analysis.topicos_discutidos || null,
        p_pendencies: analysis.pendencias || null,
        p_productivity_criteria: analysis.aproveitamento_criterios || null
      });

      console.log(`Reunião ${meetingId} reprocessada com sucesso (do banco)!`);
    } catch (error) {
      console.error(`Falha ao reprocessar reunião ${meetingId}:`, error);
      await supabase.rpc('process_webhook_meeting', {
        p_user_id: userId,
        p_fireflies_id: meetingData.fireflies_id,
        p_title: meetingData.title,
        p_date: meetingData.date,
        p_duration: meetingData.duration,
        p_meeting_type: null,
        p_objective: null,
        p_executive_summary: null,
        p_decisions: null,
        p_action_items: null,
        p_transcript: meetingData.transcript,
        p_status: 'error',
        p_productivity_score: null,
        p_productivity_reason: null
      });
    }
  } catch (error) {
    console.error('Erro no reprocess:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Erro interno ao reprocessar.' });
    }
  }
});

// Endpoint para sincronizar todas as reuniões recentes do Fireflies
app.post('/api/sync/fireflies', async (req, res) => {
  const { user_secret } = req.body;

  if (!user_secret) {
    return res.status(400).json({ error: 'user_secret é obrigatório' });
  }

  try {
    const { data: profile, error: profileError } = await supabase
      .rpc('get_profile_by_webhook_secret', { p_secret: user_secret });

    if (profileError || !profile || profile.length === 0) {
      return res.status(401).json({ error: 'Secret inválido ou usuário não encontrado.' });
    }

    const { id: userId, openai_api_key, fireflies_api_key } = profile[0];

    if (!fireflies_api_key) {
      return res.status(400).json({ error: 'Fireflies API Key não configurada.' });
    }
    if (!openai_api_key) {
      return res.status(400).json({ error: 'OpenAI API Key não configurada.' });
    }

    // Buscar lista de transcrições recentes no Fireflies
    const transcripts = await fetchRecentTranscriptIds(fireflies_api_key, 20);

    if (!transcripts.length) {
      return res.json({ message: 'Nenhuma reunião encontrada no Fireflies.', imported: 0 });
    }

    const allIds = transcripts.map(t => t.id);

    // Filtrar apenas os que ainda não foram processados com sucesso
    const { data: unprocessed, error: checkError } = await supabase
      .rpc('get_unprocessed_fireflies_ids', { p_user_id: userId, p_fireflies_ids: allIds });

    if (checkError) {
      console.error('Erro ao verificar IDs:', checkError);
      return res.status(500).json({ error: 'Erro ao verificar reuniões existentes.' });
    }

    const unprocessedIds = (unprocessed || []).map(r => r.fireflies_id);

    if (!unprocessedIds.length) {
      return res.json({ message: 'Todas as reuniões já estão sincronizadas.', imported: 0 });
    }

    // Salvar registros como 'processing' imediatamente usando metadados já disponíveis
    // Assim aparecem no dashboard na hora, mesmo antes da transcrição ser buscada
    const metaMap = {};
    transcripts.forEach(t => { metaMap[t.id] = t; });

    for (const firefliesId of unprocessedIds) {
      const meta = metaMap[firefliesId] || {};
      await supabase.rpc('process_webhook_meeting', {
        p_user_id: userId,
        p_fireflies_id: firefliesId,
        p_title: meta.title || 'Reunião Importada',
        p_date: meta.date ? new Date(meta.date).toISOString() : new Date().toISOString(),
        p_duration: meta.duration || 0,
        p_status: 'processing',
        p_meeting_type: null, p_objective: null, p_executive_summary: null,
        p_decisions: null, p_action_items: null, p_transcript: null,
        p_productivity_score: null, p_productivity_reason: null
      });
    }

    res.status(202).json({
      message: `Sincronizando ${unprocessedIds.length} reunião(ões). Atualize a página para ver.`,
      imported: unprocessedIds.length
    });

    // Processar cada reunião em background (sequencial para evitar rate limit)
    (async () => {
      for (const firefliesId of unprocessedIds) {
        try {
          await processMeeting(firefliesId, userId, openai_api_key, fireflies_api_key);
        } catch (err) {
          console.error(`Erro ao processar ${firefliesId} na sincronização:`, err);
        }
      }
    })();

  } catch (error) {
    console.error('Erro no sync:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Erro ao sincronizar: ' + error.message });
    }
  }
});

// Endpoint para validar as chaves de API do usuário
app.post('/api/validate-keys', async (req, res) => {
  const { openai_key, fireflies_key } = req.body;
  const result = { openai: null, fireflies: null };

  if (openai_key) {
    try {
      const OpenAI = require('openai');
      const openai = new OpenAI({ apiKey: openai_key });
      await openai.models.list();
      result.openai = { valid: true, message: 'Chave válida' };
    } catch (err) {
      result.openai = { valid: false, message: 'Chave inválida ou sem permissão' };
    }
  }

  if (fireflies_key) {
    try {
      const axios = require('axios');
      const response = await axios.post(
        'https://api.fireflies.ai/graphql',
        { query: '{ user { email } }' },
        { headers: { 'Authorization': `Bearer ${fireflies_key}`, 'Content-Type': 'application/json' } }
      );
      if (response.data?.errors) {
        result.fireflies = { valid: false, message: 'Chave inválida ou sem permissão' };
      } else {
        result.fireflies = { valid: true, message: 'Chave válida' };
      }
    } catch (err) {
      result.fireflies = { valid: false, message: 'Chave inválida ou erro de conexão' };
    }
  }

  res.json(result);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Backend rodando na porta ${PORT}`);
});
