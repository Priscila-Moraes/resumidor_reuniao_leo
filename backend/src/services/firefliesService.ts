import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

export interface FirefliesTranscriptSummary {
  id: string;
  title: string;
  date: number;
  duration: number;
}

export const listFirefliesTranscripts = async (
  apiKey: string,
  limit = 200,
): Promise<FirefliesTranscriptSummary[]> => {
  const query = `
    query {
      transcripts(limit: ${limit}) {
        id
        title
        date
        duration
      }
    }
  `;

  try {
    const response = await axios.post(
      'https://api.fireflies.ai/graphql',
      { query },
      { headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' } },
    );
    const transcripts = response.data?.data?.transcripts;
    const errors = response.data?.errors;
    console.log('Fireflies list response — transcripts:', transcripts?.length ?? 'null', '| errors:', JSON.stringify(errors));

    if (errors?.length) {
      const err = errors[0];
      if (err.code === 'too_many_requests') {
        const retryAfter = err.extensions?.metadata?.retryAfter;
        const retryDate = retryAfter ? new Date(retryAfter).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : 'amanhã';
        throw new Error(`Limite de requisições do Fireflies atingido. Tente novamente após ${retryDate}.`);
      }
      throw new Error(err.message || 'Erro na API do Fireflies');
    }

    return transcripts || [];
  } catch (error: any) {
    if (error?.message?.includes('Limite de requisições') || error?.message?.includes('Erro na API')) {
      throw error;
    }
    console.error('Error listing Fireflies transcripts', error?.response?.data || error.message);
    throw new Error('Falha ao conectar com o Fireflies. Verifique sua chave de API.');
  }
};

export interface FirefliesTranscriptData {
  id: string;
  title: string;
  date: number;
  duration: number;
  sentences: Array<{ speaker_name: string; text: string }>;
}

export interface TranscriptResult {
  text: string;
  transcript: FirefliesTranscriptData;
  fireflies_id: string;
  duration: number;
}

export const fetchFirefliesTranscript = async (
  transcriptId: string,
  apiKey?: string
): Promise<TranscriptResult> => {
  const key = apiKey || process.env.FIREFLIES_API_KEY;

  if (!key) {
    console.warn('Fireflies API key not found. Returning mock transcript.');
    const mockTranscript: FirefliesTranscriptData = {
      id: transcriptId,
      title: 'Mock Meeting',
      date: Date.now(),
      duration: 30,
      sentences: [
        { speaker_name: 'Sarah', text: "Let's kick off the Q3 planning. I've shared the proposed roadmap." },
        { speaker_name: 'Mike', text: 'Thanks, Sarah. The focus on scalability makes sense.' },
      ],
    };
    return {
      text: mockTranscript.sentences.map((s) => `${s.speaker_name}: ${s.text}`).join('\n'),
      transcript: mockTranscript,
      fireflies_id: transcriptId,
      duration: 30,
    };
  }

  const query = `
    query transcript($transcriptId: String!) {
      transcript(id: $transcriptId) {
        id
        title
        date
        duration
        sentences {
          text
          speaker_name
        }
      }
    }
  `;

  try {
    const response = await axios.post(
      'https://api.fireflies.ai/graphql',
      { query, variables: { transcriptId } },
      { headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' } }
    );

    const data = response.data?.data?.transcript;
    if (!data) throw new Error('Transcript not found in Fireflies response');

    const sentences: Array<{ speaker_name: string; text: string }> = data.sentences || [];
    const text = sentences.map((s) => `${s.speaker_name}: ${s.text}`).join('\n');

    return {
      text,
      transcript: data as FirefliesTranscriptData,
      fireflies_id: data.id || transcriptId,
      duration: data.duration ? Math.round(data.duration) : 0,
    };
  } catch (error) {
    console.error('Error fetching transcript from Fireflies', error);
    throw new Error('Failed to fetch transcript from Fireflies.');
  }
};
