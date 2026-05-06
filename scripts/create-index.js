import fs from 'fs';
import path from 'path';

// ______________________________________________________AJOUT PHASE 3
import 'dotenv/config';
import { Pinecone } from '@pinecone-database/pinecone';

// ______________________________________________________AJOUT PHASE 3

export const CONFIG = { chunkSize: 400, overlap: 50, batchSize: 50, embedConcurrency: 10 };//modif embedConcurrency de 5 à 10

function chunkWithOverlap(text, chunkSize, overlap) {

    if (overlap >= chunkSize) {
        throw new Error('overlap doit être strictement inférieur à chunkSize');
    }

    const words = text.trim().split(/\s+/);
    const chunks = [];
    let i = 0;
    while (i < words.length) {
        const chunk = words.slice(i, i + chunkSize).join(' ');
        chunks.push(chunk);
        i += chunkSize - overlap; // on recule de `overlap` à chaque itération
    }
    return chunks;
}

export async function loadCorpus(dir) {
    const files = await fs.promises.readdir(dir);

    const txtFiles = files.filter(file =>
        path.extname(file).toLowerCase() === '.md'
    );

    const results = await Promise.all(
        txtFiles.map(async file => {

            const fullPath = path.join(dir, file);

            const text = await fs.promises.readFile(fullPath, 'utf-8');

            return {
                filename: file,
                text
            };
        })
    );

    return results;
}

// ______________________________________________________AJOUT PHASE 3

const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY
});

const index = pinecone.index(process.env.PINECONE_INDEX_NAME);

async function embedBatch(texts) {
    if (!Array.isArray(texts) || texts.length === 0) {
        return [];
    }

    const response = await fetch('https://api.mistral.ai/v1/embeddings', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${process.env.MISTRAL_API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: 'mistral-embed',
            input: texts
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erreur embedding Mistral: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    if (!data.data || !Array.isArray(data.data)) {
        throw new Error('Réponse embeddings invalide');
    }

    return data.data.map(item => item.embedding);
}

function prepareChunksFromCorpus(corpus) {
    const preparedChunks = [];

    for (const file of corpus) {
        const rawChunks = chunkWithOverlap(file.text, CONFIG.chunkSize, CONFIG.overlap);

        console.log(`→ ${file.filename}: ${rawChunks.length} chunks créés`);

        rawChunks.forEach((chunkText, chunkIndex) => {
            preparedChunks.push({
                filename: file.filename,
                chunkIndex,
                text: chunkText
            });
        });
    }

    return preparedChunks;
}

function buildVector(chunk, embedding) {
    return {
        id: `${chunk.filename}-chunk-${chunk.chunkIndex}`,
        values: embedding,
        metadata: {
            text: chunk.text,
            source: chunk.filename,
            chunkIndex: chunk.chunkIndex
        }
    };
}

async function embedAndIndex(preparedChunks) {
    if (!preparedChunks.length) {
        console.log('Aucun chunk à indexer.');
        return 0;
    }

    const vectors = [];

    // Embedding par groupes de embedConcurrency
    for (let i = 0; i < preparedChunks.length; i += CONFIG.embedConcurrency) {
        const batch = preparedChunks.slice(i, i + CONFIG.embedConcurrency);
        const texts = batch.map(chunk => chunk.text);

        const embeddings = await embedBatch(texts);

        embeddings.forEach((embedding, idx) => {
            const chunk = batch[idx];
            vectors.push(buildVector(chunk, embedding));
        });

        console.log(`Embeddings générés: ${Math.min(i + batch.length, preparedChunks.length)}/${preparedChunks.length}`);
    }

    // Upsert dans Pinecone par groupes de batchSize
    for (let i = 0; i < vectors.length; i += CONFIG.batchSize) {
        const batch = vectors.slice(i, i + CONFIG.batchSize);

        await index.upsert(batch);

        console.log(`Upsert ${Math.min(i + batch.length, vectors.length)}/${vectors.length} vecteurs...`);
    }

    console.log(`✓ ${vectors.length} vecteurs indexés`);
    return vectors.length;
}

async function main() {
    const corpusDir = path.join(process.cwd(), 'corpus');

    console.log('Chargement du corpus...');
    const corpus = await loadCorpus(corpusDir);
    console.log(`${corpus.length} fichiers trouvés`);

    const preparedChunks = prepareChunksFromCorpus(corpus);
    console.log(`${preparedChunks.length} chunks prêts à être indexés`);

    const total = await embedAndIndex(preparedChunks);

    console.log(`Indexation terminée : ${total} vecteurs dans l'index "${process.env.PINECONE_INDEX_NAME}"`);
}

main().catch(err => {
    console.error('Erreur pendant l’indexation :', err.message);
});

 