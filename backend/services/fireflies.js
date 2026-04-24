const axios = require('axios');

async function fetchMeetingTranscript(firefliesId, apiKey) {
    if (!apiKey) {
        throw new Error("Fireflies API Key não fornecida.");
    }

    // GraphQL query padrão fornecida pelo Fireflies v2
    const query = `
    query getTranscript($id: String!) {
      transcript(id: $id) {
        id
        title
        duration
        date
        sentences {
          index
          speaker_id
          speaker_name
          text
          start_time
          end_time
        }
      }
    }
  `;

    try {
        const response = await axios.post(
            'https://api.fireflies.ai/graphql',
            {
                query,
                variables: { id: firefliesId }
            },
            {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        const transcriptData = response.data?.data?.transcript;
        if (!transcriptData) {
            throw new Error(`Transcrição não encontrada para ID: ${firefliesId}. Resposta Fireflies: ${JSON.stringify(response.data)}`);
        }

        // Retorna as sentences e também concatena o texto bruto para análise da OpenAI
        const sentences = transcriptData.sentences || [];
        const text = sentences.map(s => `${s.speaker_name}: ${s.text}`).join('\n');

        return {
            sentences,
            text,
            title: transcriptData.title,
            duration: transcriptData.duration,
            date: transcriptData.date,
        };

    } catch (error) {
        console.error(`Erro ao buscar na API do Fireflies:`, error.response?.data || error.message);
        throw error;
    }
}

async function fetchRecentTranscriptIds(apiKey, limit = 20) {
    const query = `
    query GetTranscripts($limit: Int) {
      transcripts(limit: $limit) {
        id
        title
        duration
        date
      }
    }
  `;

    const response = await axios.post(
        'https://api.fireflies.ai/graphql',
        { query, variables: { limit } },
        {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        }
    );

    if (response.data?.errors) {
        const err = response.data.errors[0];
        if (err?.code === 'too_many_requests' || err?.extensions?.status === 429) {
            const retryAfter = err?.extensions?.metadata?.retryAfter;
            const retryDate = retryAfter ? new Date(retryAfter).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : 'meia-noite';
            throw Object.assign(new Error(`Limite diário do Fireflies atingido. Tente novamente após ${retryDate}.`), { code: 'rate_limit' });
        }
        throw new Error(`Fireflies API error: ${JSON.stringify(response.data.errors)}`);
    }

    return response.data?.data?.transcripts || [];
}

module.exports = {
    fetchMeetingTranscript,
    fetchRecentTranscriptIds
};
