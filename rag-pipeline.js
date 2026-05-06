import { loadCorpus } from "./scripts/create-index.js";
import 'dotenv/config';

async function generateCompletion(query, context) {
    const formattedContext = context
        .map((chunk, index) => {
            return `[Source ${index + 1} - ${chunk.filename}]\n${chunk.text}`;
        })
        .join('\n\n---\n\n');

    const messages = [
        {
            role: 'system',
            content: `Tu es un assistant RAG.

Réponds uniquement à partir du contexte fourni.
Tu dois citer les sources utilisées avec le format [Source N].
Si l'information n'est pas présente dans le contexte, réponds exactement :
"Je ne trouve pas cette information dans les documents fournis"`
        },
        {
            role: 'user',
            content: `Contexte :

${formattedContext}

Question :
${query}`
        }
    ];

    const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${process.env.MISTRAL_API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: 'mistral-medium-latest',
            messages,
            temperature: 0.1
        })
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Erreur Mistral : ${response.status} - ${error}`);
    }

    const data = await response.json();

    return data.choices[0].message.content;
}
