import fs from 'fs';
import path from 'path';

export const CONFIG = { chunkSize: 400, overlap: 50, batchSize: 50, embedConcurrency: 5 };

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

async function loadCorpus(dir) {
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
