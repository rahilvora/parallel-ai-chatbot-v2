import { buildChatRAGChain } from '@/lib/ragChain';

/**
 * Thin wrapper so api/ routes only need a single async call.
 */
export async function answerWithRAG({
  chatId,
  question,
}: {
  chatId: string;
  question: string;
}) {
  const chain = await buildChatRAGChain(chatId);
  const resp = await chain.invoke({ input: question });
  return resp.text as string;
}
