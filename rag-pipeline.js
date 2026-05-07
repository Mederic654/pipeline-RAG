//import { loadCorpus } from "./scripts/create-index.js"; _______________________________________retiré plus besoin
import 'dotenv/config';
import {CircuitBreaker} from './CircuitBreaker.js';

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

      const llmBreaker = new CircuitBreaker({ threshold: 5, timeout: 30000 }) 
      const response = await llmBreaker.call(() => withRetry(() => callLLM(messages)));



    return response;
}


export async function ragQuery(question, options = { topK: 5, verbose: false }) {
    const timer = performance.now();

    const context = await retrieveContext(question, options.topK);
    if (options.verbose) {
        console.log(`topK=${options.topK} retournés en ${performance.now() - timer}ms, top score ${Math.max(...context.map(u => u.score))}, avg score${context.reduce((sum, value) => sum + value.score, 0) / context.length}`);
        context.forEach((elm) =>
            console.log(`[${elm.score}] ${elm.source}, "${elm.text}"`));
    }

    const answer = await generateCompletion(question, context);

    const metrics = {
        topScore: Math.max(...context.map(u => u.score)),
        avgScore: context.reduce((sum, value) => sum + value.score, 0) / context.length
    }
    return {
        answer: answer,
        sources: context.map(u => u.source),
        chunks: context,  //.map(u => u.chunk),
        metrics: metrics
    }
}

async function callLLM(prompt, options = {}) {
    const { timeout = 30000, model = 'mistral-large-latest' } = options;



    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
        const timer = performance.now();

        const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.MISTRAL_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({model, messages: prompt}),
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`API error ${response.status}: ${error}`);
        }
        const data = await response.json();
        console.log(`[LLM] Réponse reçue en ${performance.now() - timer}ms`);
        return data;

    } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            throw new Error(`Timeout LLM après ${timeout}ms`)
        }
        throw error;
    }  
}

async function withRetry(fn, maxRetries = 3, baseDelay = 1000) {
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                return await fn();
            } catch (err) {
                const isRetryable = err.message.includes('429') || err.message.includes('503');
                const isLastAttempt = attempt === maxRetries;
                if (!isRetryable || isLastAttempt) throw err;
                const delay = Math.pow(2, attempt) * baseDelay + Math.random() * 500;
                console.log(`[Retry] Tentative ${attempt + 1}/${maxRetries} dans
                                               ${Math.round(delay)}ms`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
