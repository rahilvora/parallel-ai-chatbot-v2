// lib/chunker.ts
import { encode, decode } from 'gpt-tokenizer';

const MAX_TOKENS = 500;
const OVERLAP = 50;

export function chunkText(raw: string) {
  // 1) split on double-newline paragraphs
  const paragraphs = raw.split(/\n\s*\n/);

  const allChunks: string[] = [];

  for (const paragraph of paragraphs) {
    const tokens = encode(paragraph);
    if (tokens.length <= MAX_TOKENS) {
      allChunks.push(paragraph);
    } else {
      // 2) sliding window on tokens
      for (let i = 0; i < tokens.length; i += MAX_TOKENS - OVERLAP) {
        const slice = tokens.slice(i, i + MAX_TOKENS);
        allChunks.push(decode(slice));
        if (i + MAX_TOKENS >= tokens.length) break;
      }
    }
  }

  return allChunks;
}
