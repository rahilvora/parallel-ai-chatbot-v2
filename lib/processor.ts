import OpenAI from 'openai';
import pLimit from 'p-limit';
import { chunkFile, type Chunk } from './chunker';
import { saveFileEmbeddings } from './db/queries';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const BATCH_SIZE = 500; // embed API supports big batches
const CONCURRENCY = 5; // stay under rate limits

export interface ProcessFileOptions {
  chatId: string;
  fileName: string;
  fileType: string; // 'text/plain' | 'text/csv'
  fileUrl: string;
  rawBuffer: ArrayBuffer;
}

export async function processFile(opts: ProcessFileOptions) {
  const { chatId, fileName, fileType, fileUrl, rawBuffer } = opts;

  /* 1️. decode & chunk */
  const rawText = new TextDecoder().decode(rawBuffer);
  const chunks = chunkFile(rawText, fileType);

  /* 2️️ batch-embed */
  const limit = pLimit(CONCURRENCY);
  const tasks: Promise<void>[] = [];

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch: Chunk[] = chunks.slice(i, i + BATCH_SIZE);
    tasks.push(
      limit(async () => {
        const { data } = await openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: batch.map((c) => c.text),
        });

        /* 3️️ persist batch */
        const now = new Date();
        const embeddings = batch.map((c, j) => ({
          chatId,
          fileName,
          fileUrl,
          fileType,
          chunkIndex: c.chunkIndex,
          rowIndex: c.rowIndex ?? null,
          colName: c.colName ?? null,
          content: c.text,
          embedding: data[j].embedding,
          metadata: {
            chatId,
            fileName,
            chunkIndex: c.chunkIndex,
            rowIndex: c.rowIndex ?? null,
            colName: c.colName ?? null,
          },
          createdAt: now,
        }));

        await saveFileEmbeddings(embeddings);
      }),
    );
  }

  await Promise.all(tasks);
  return { success: true, chunkCount: chunks.length };
}
