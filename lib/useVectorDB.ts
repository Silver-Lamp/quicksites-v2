// lib/useVectorDB.ts
import { QdrantClient } from '@qdrant/js-client-rest';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Embedder wrapper
export async function embedText(texts: string[]): Promise<number[][]> {
  const res = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: texts,
  });
  return res.data.map((d) => d.embedding);
}

// Qdrant client setup (local or cloud)
export const qdrant = new QdrantClient({
  url: process.env.QDRANT_URL || 'http://localhost:6333',
  apiKey: process.env.QDRANT_API_KEY || undefined,
});

// Collection name
export const COLLECTION = 'quicksite_blocks';

// Ensure collection exists
export async function ensureCollection() {
  const collections = await qdrant.getCollections();
  if (!collections.collections.find((c) => c.name === COLLECTION)) {
    await qdrant.createCollection(COLLECTION, {
      vectors: {
        size: 1536,
        distance: 'Cosine',
      },
    });
  }
}
