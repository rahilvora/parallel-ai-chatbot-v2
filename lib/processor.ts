import OpenAI from 'openai';
import pLimit from 'p-limit';
import { chunkText } from './chunker';
import { saveFileEmbedding } from './db/queries';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const BATCH_SIZE = 500;
const CONCURRENCY = 5;

export interface ProcessFileOptions {
  chatId: string;
  fileName: string;
  fileType: string;
  fileUrl: string;
  rawBuffer: ArrayBuffer;
}

export async function processFile({
  chatId,
  fileName,
  fileType,
  fileUrl,
  rawBuffer,
}: ProcessFileOptions) {
  // Decode buffer into text
  const text = new TextDecoder().decode(rawBuffer);
  // Split text into semantic chunks
  const chunks = chunkText(text);

  // Limit concurrency to avoid rate limits
  const limit = pLimit(CONCURRENCY);
  const tasks: Promise<void>[] = [];

  // Process in batches to reduce API calls
  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    tasks.push(
      limit(async () => {
        try {
          // 1️⃣ Generate embeddings for this batch
          const resp = await openai.embeddings.create({
            model: 'text-embedding-3-small',
            input: batch,
          });

          // 2️⃣ Persist each chunk + embedding
          const now = new Date();
          for (let j = 0; j < batch.length; j++) {
            await saveFileEmbedding({
              chatId,
              fileName,
              fileUrl,
              fileType,
              content: batch[j],
              embedding: resp.data[j].embedding,
              createdAt: now,
            });
          }
        } catch (error) {
          console.error(`Error processing batch at index ${i}:`, error);
          // Optionally, collect failures for retry
        }
      }),
    );
  }
  // Wait for all embedding tasks
  await Promise.all(tasks);

  return { success: true, chunkCount: chunks.length };
}
