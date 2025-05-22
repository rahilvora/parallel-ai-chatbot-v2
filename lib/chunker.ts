import { encode, decode } from 'gpt-tokenizer';
import { parse } from 'csv-parse/sync';

/** Returned by chunkers and fed into the embedder */
export interface Chunk {
  text: string;
  chunkIndex: number; // 0-based within the file
  /** CSV-specific metadata (undefined for .txt) */
  rowIndex?: number;
  colName?: string;
}

/* ----- TEXT / MARKDOWN ----- */
const MAX_TOKENS = 300;
const OVERLAP = 30;

function chunkMarkdown(raw: string): Chunk[] {
  const paragraphs = raw.split(/\n\s*\n/);
  const out: Chunk[] = [];
  let chunkIdx = 0;

  for (const para of paragraphs) {
    const toks = encode(para);
    if (toks.length <= MAX_TOKENS) {
      out.push({ text: para, chunkIndex: chunkIdx++ });
    } else {
      for (let i = 0; i < toks.length; i += MAX_TOKENS - OVERLAP) {
        const slice = toks.slice(i, i + MAX_TOKENS);
        out.push({ text: decode(slice), chunkIndex: chunkIdx++ });
        if (i + MAX_TOKENS >= toks.length) break;
      }
    }
  }
  return out;
}

/* ----- CSV  (row-level for v1) ----- */
/**
 * Note: for V1
 * Row-level: simpler, fewer vectors, good for broad record queries.
 * Cell-level: precise, ideal for column-specific queries, higher vector/index cost.
 * For V2, we will use cell-level granularity.
 */
function chunkCsv(raw: string): Chunk[] {
  const records = parse(raw, { columns: true, skip_empty_lines: true });
  const headers = Object.keys(records[0] ?? {});
  return records.map((row: any, idx: number) => ({
    text: headers.map((h) => `${h}: ${row[h]}`).join('  '),
    chunkIndex: 0, // single “chunk” per row
    rowIndex: idx,
  }));
}

/* Public API */
export function chunkFile(raw: string, mimeType: string): Chunk[] {
  return mimeType === 'text/csv' ? chunkCsv(raw) : chunkMarkdown(raw);
}
