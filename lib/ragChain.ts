import { Pool } from 'pg';
import { ChatOpenAI, OpenAIEmbeddings } from '@langchain/openai';
import { PGVectorStore } from '@langchain/community/vectorstores/pgvector';
import { createRetrievalChain } from 'langchain/chains/retrieval';
import { createStuffDocumentsChain } from 'langchain/chains/combine_documents';
import { PromptTemplate } from '@langchain/core/prompts';
import 'dotenv/config';

// Postgres connection pool (reuse across calls)
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Initialize embedding model
const embeddings = new OpenAIEmbeddings({
  modelName: 'text-embedding-3-small',
  openAIApiKey: process.env.OPENAI_API_KEY,
});

// PGVectorStore configuration
const VECTOR_TABLE = '"FileEmbedding"'; // quoted for Drizzle's camel-case naming
const COLUMN_MAPPING = {
  idColumnName: 'id',
  vectorColumnName: 'embedding',
  contentColumnName: 'content',
  metadataColumnName: 'metadata',
};

/**
 * Builds a LangChain ConversationalRetrievalQAChain for RAG over file embeddings.
 *
 * @param chatId - The chat's unique identifier, used to scope vector retrieval.
 */
export async function buildChatRAGChain(chatId: string) {
  // 1️⃣ set up the vector store (backed by Postgres + pgvector)
  const vectorStore = await PGVectorStore.initialize(embeddings, {
    pool,
    tableName: VECTOR_TABLE,
    ...COLUMN_MAPPING,
  });

  // 2️⃣ create a retriever scoped to this chatId via metadata
  const retriever = vectorStore.asRetriever({
    searchType: 'similarity',
    k: 8,
    filter: { chatId },
  });

  // 3️⃣ configure the LLM
  const llm = new ChatOpenAI({
    modelName: 'gpt-4o-mini',
    streaming: true,
    openAIApiKey: process.env.OPENAI_API_KEY,
    temperature: 0.2,
    maxTokens: 256,
  });

  // 4️⃣ create document chain
  const prompt = PromptTemplate.fromTemplate(
    `You are a helpful assistant. Use ONLY the provided context to answer. If the context doesn't contain relevant information, say so.

Context: {context}

Question: {input}

Answer:`,
  );

  const combineDocsChain = await createStuffDocumentsChain({
    llm,
    prompt,
    documentPrompt: PromptTemplate.fromTemplate('{content}\n\n'),
  });

  // 5️⃣ assemble the chain
  const chain = createRetrievalChain({
    combineDocsChain,
    retriever,
  });

  return chain;
}
