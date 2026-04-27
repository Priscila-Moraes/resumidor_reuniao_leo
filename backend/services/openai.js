const OpenAI = require('openai');

async function analyzeTranscript(transcriptText, openAiKey) {
    const openai = new OpenAI({
        apiKey: openAiKey,
    });

    const systemPrompt = `
Você é um assistente sênior especialista em análise de reuniões executivas e técnicas.
Sua tarefa é ler a transcrição de uma reunião e extrair informações estruturadas de forma clara e acionável.

REGRAS IMPORTANTES:
1. Retorne APENAS JSON válido, sem markdown ou texto em volta.
2. TODO o conteúdo deve estar em português do Brasil, mesmo que a transcrição esteja em outro idioma.
3. NÃO duplique conteúdo entre "decisoes" e "itens_acao":
   - "decisoes" = o QUE foi acordado/definido (conclusão).
   - "itens_acao" = QUEM faz, O QUÊ, e QUANDO (tarefa executável).
4. Em "itens_acao", se o responsável ou prazo não forem claros na transcrição, use "A definir". NÃO invente nomes, datas ou suposições.
5. Extraia nomes próprios reais quando mencionados; evite rótulos genéricos como "Participante 1" ou "(quem falou)".

Retorne este JSON exato:
{
  "tipo_reuniao": "string",
  // SEMPRE em português. Valores permitidos: "Equipe", "Vendas", "Projeto", "Alinhamento", "Feedback", "Entrevista", "Planejamento", "Retrospectiva", "Daily", "Brainstorm", "Treinamento", "1:1", "Apresentação", "Análise"

  "objetivo": "string",
  // Uma frase clara descrevendo o objetivo principal da reunião.

  "resumo_executivo": "string",
  // 2 a 3 parágrafos estruturados: (1) contexto e tema central; (2) principais pontos discutidos; (3) desfecho/próximos passos.

  "topicos_discutidos": ["string"],
  // Lista curta (3 a 8 itens) dos assuntos abordados na reunião, em frases nominais. Ex: "Campanhas de marketing para advogados", "Renovação de clientes mensais".

  "decisoes": "string",
  // Markdown com bullet points ("- ") das decisões DEFINITIVAS tomadas. Uma linha por decisão. Não inclua tarefas aqui — só conclusões/acordos.

  "itens_acao": [
    {
      "tarefa": "string",          // O que precisa ser feito (frase curta e acionável).
      "responsavel": "string",     // Nome da pessoa responsável, ou "A definir".
      "prazo": "string"            // Prazo mencionado (ex: "Hoje até o almoço", "Próxima segunda", "Até sexta-feira"), ou "A definir".
    }
  ],

  "pendencias": ["string"],
  // Itens que ficaram em aberto, bloqueios identificados ou dependências externas não resolvidas. Array vazio [] se não houver.

  "aproveitamento_nota": number,
  // Nota de 0 a 10 avaliando a produtividade da reunião.

  "aproveitamento_motivo": "string",
  // Justificativa objetiva da nota (2 a 3 frases).

  "aproveitamento_criterios": {
    "objetivos_claros": boolean,      // Os objetivos da reunião foram declarados e perseguidos?
    "decisoes_tomadas": boolean,      // Foram tomadas decisões concretas?
    "responsaveis_definidos": boolean,// Os itens de ação têm responsáveis claros?
    "prazos_definidos": boolean,      // Os itens de ação têm prazos claros?
    "foco_mantido": boolean           // A discussão manteve o foco no objetivo?
  }
}
  `;

    const TIMEOUT_MS = 5 * 60 * 1000; // 5 minutos

    try {
        const apiCall = openai.responses.create({
            model: 'gpt-5-mini',
            instructions: systemPrompt,
            input: `Analise a transcrição abaixo e retorne o resultado em formato json.\n\nAqui está a transcrição completa:\n\n${transcriptText}`,
            text: { format: { type: 'json_object' } },
            reasoning: { effort: 'low' },
            store: false
        });

        const timeout = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('OpenAI timeout: análise demorou mais de 5 minutos')), TIMEOUT_MS)
        );

        const response = await Promise.race([apiCall, timeout]);
        console.log(`OpenAI respondeu. Tokens usados: ${response.usage?.total_tokens || 'N/A'}`);

        const parsedData = JSON.parse(response.output_text);
        return parsedData;

    } catch (error) {
        console.error("Erro na integração com OpenAI:", error?.message || error?.status || error);
        throw error;
    }
}

module.exports = {
    analyzeTranscript
};
