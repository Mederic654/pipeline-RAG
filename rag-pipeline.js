//import { loadCorpus } from "./scripts/create-index.js"; _______________________________________retiré plus besoin
import 'dotenv/config';

//_______________________________________Phase 4
import { Pinecone } from '@pinecone-database/pinecone';


const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY
});

const index = pinecone.index(process.env.PINECONE_INDEX_NAME);


async function embedText(text) {
    if (!text || !text.trim()) {
        return null;
    }

    const response = await fetch('https://api.mistral.ai/v1/embeddings', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${process.env.MISTRAL_API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: 'mistral-embed',
            input: [text]
        })
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Erreur embedding Mistral : ${response.status} - ${error}`);
    }

    const data = await response.json();

    if (!data.data || !Array.isArray(data.data) || !data.data[0]?.embedding) {
        throw new Error('Réponse embeddings invalide');
    }

    return data.data[0].embedding;
}


export async function retrieveContext(query, topK = 5) {
    if (!query || !query.trim()) {
        return [];
    }

    const queryVector = await embedText(query);

    const results = await index.query({
        vector: queryVector,
        topK,
        includeMetadata: true
    });

    const matches = results.matches ?? [];

    return matches
        .map(match => ({
            text: match.metadata?.text,
            source: match.metadata?.source,
            score: match.score,
            chunkIndex: match.metadata?.chunkIndex
        }))
        .filter(chunk => chunk.text && chunk.source && chunk.score >= 0.5);
}

//_______________________________________Phase 4

export async function generateCompletion(query, context) {  // ____________________________________________________export de la fonction pour la suite
    const formattedContext = context
        .map((chunk, index) => {
            return `[Source ${index + 1} - ${chunk.source}]\n${chunk.text}`; //______________________________chunck.filename remplacé par chunck.source
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

