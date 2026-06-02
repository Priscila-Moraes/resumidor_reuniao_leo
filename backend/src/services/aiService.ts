import OpenAI from 'openai';

export interface MeetingAnalysis {
  titulo: string;
  tipo_reuniao: string;
  objetivo: string;
  resumo_executivo: string;
  topicos_discutidos: string[];
  decisoes: string;
  itens_acao: Array<{ tarefa: string; responsavel: string; prazo: string }>;
  pendencias: string[];
  aproveitamento_nota: number;
  aproveitamento_motivo: string;
  aproveitamento_criterios: {
    objetivos_claros: boolean;
    decisoes_tomadas: boolean;
    responsaveis_definidos: boolean;
    prazos_definidos: boolean;
    foco_mantido: boolean;
  };
}

export const analyzeMeetingTranscript = async (
  transcript: string,
  userApiKey: string
): Promise<MeetingAnalysis> => {
  if (!userApiKey) {
    throw new Error('User OpenAI API key is missing.');
  }

  const openai = new OpenAI({ apiKey: userApiKey });

  const prompt = `Você é um assistente especialista em análise de reuniões corporativas.
Analise a transcrição abaixo e extraia as informações em formato JSON estrito, sem blocos markdown.

Retorne EXATAMENTE este JSON:
{
  "tipo_reuniao": "Categoria + nome curto no formato 'Categoria / Nome'. Categoria deve ser uma de: Equipe | Vendas | Projeto | Planejamento | Feedback | Cliente | Outro. Nome é um subtítulo descritivo de 2-4 palavras sobre o assunto. Ex: 'Cliente / Tráfego e Leads', 'Equipe / Weekly Sync', 'Projeto / Lançamento App'",
  "objetivo": "Uma frase objetiva descrevendo o propósito da reunião",
  "resumo_executivo": "2 a 3 parágrafos resumindo o contexto, discussões e resultados da reunião",
  "topicos_discutidos": ["Tópico 1", "Tópico 2", "Tópico 3"],
  "decisoes": "Lista em markdown com • das decisões tomadas. Ex:\\n• Decisão 1\\n• Decisão 2",
  "itens_acao": [
    { "tarefa": "Descrição da tarefa", "responsavel": "Nome do responsável ou 'A definir'", "prazo": "Data ou 'A definir'" }
  ],
  "pendencias": ["Pendência ou questão não resolvida 1", "Pendência 2"],
  "aproveitamento_nota": 7,
  "aproveitamento_motivo": "Justificativa da nota em 1-2 frases explicando o porquê da avaliação",
  "aproveitamento_criterios": {
    "objetivos_claros": true,
    "decisoes_tomadas": true,
    "responsaveis_definidos": false,
    "prazos_definidos": false,
    "foco_mantido": true
  }
}

Critérios para aproveitamento_nota (escala de 0 a 10):
- Cada critério verdadeiro vale 2 pontos. Some os critérios atendidos:
- objetivos_claros: a reunião teve pauta e objetivos definidos? (+2 pts)
- decisoes_tomadas: foram tomadas decisões concretas? (+2 pts)
- responsaveis_definidos: os itens de ação têm responsáveis nomeados? (+2 pts)
- prazos_definidos: os itens de ação têm prazos definidos? (+2 pts)
- foco_mantido: a reunião manteve foco no objetivo sem dispersão? (+2 pts)
- aproveitamento_nota deve ser um número inteiro de 0 a 10 (ex: 0, 2, 4, 6, 8, 10)

Transcrição:
"""
${transcript}
"""`;

  const messages = [
    {
      role: 'system' as const,
      content: 'Você só responde com JSON válido. Não use blocos markdown como ```json.',
    },
    {
      role: 'user' as const,
      content: prompt,
    },
  ];

  let response;
  try {
    response = await openai.chat.completions.create({ model: 'gpt-5-mini', messages, temperature: 0.3 });
  } catch (err: any) {
    const isModelError =
      err?.status === 404 ||
      err?.code === 'model_not_found' ||
      err?.type === 'invalid_request_error' ||
      err?.message?.toLowerCase().includes('model') ||
      err?.message?.toLowerCase().includes('does not exist') ||
      err?.message?.toLowerCase().includes('not found');

    if (isModelError) {
      console.warn('gpt-5-mini indisponível, usando gpt-4o-mini como fallback. Erro original:', err?.message);
      response = await openai.chat.completions.create({ model: 'gpt-4o-mini', messages, temperature: 0.3 });
    } else {
      console.error('Erro inesperado na chamada OpenAI:', err?.status, err?.code, err?.message);
      throw err;
    }
  }

  const content: string = response.choices[0]?.message?.content || '{}';

  try {
    return JSON.parse(content) as MeetingAnalysis;
  } catch (error) {
    console.error('Failed to parse OpenAI response as JSON:', content);
    throw new Error('Invalid JSON format from AI model.');
  }
};
