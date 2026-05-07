import { ragQuery } from './rag-pipeline.js';

const question = "Comment définir un outil dans Pydantic AI ?";

const result = await ragQuery(question, { topK: 5, verbose: true });
console.log(JSON.stringify(result, null, 2));