// lib/useVectorDB.ts
import { QdrantClient } from '@qdrant/js-client-rest';
import { lazyClient } from '@/lib/lazyClient';
import { meterLLMCall } from '@/lib/ai/meter';
import OpenAI from 'openai';

const openai = lazyClient(() => new OpenAI({ apiKey: process.env.OPENAI_API_KEY }));

const EMBED_MODEL = 'text-embedding-3-small';

/**
 * Embedder wrapper. Routes the OpenAI embeddings call through `meterLLMCall` so
 * the budget guard + cost logging apply — pass `meta` (route / user) for
 * per-caller attribution. Metered even when called with no meta (global guard).
 */
export async function embedText(
  texts: string[],
  meta?: { user_id?: string | null; route?: string },
): Promise<number[][]> {
  return meterLLMCall(
    {
      provider: 'openai',
      model_code: EMBED_MODEL,
      modality: 'embeddings',
      user_id: meta?.user_id ?? null,
      route: meta?.route,
    },
    async () => {
      const res = await openai.embeddings.create({ model: EMBED_MODEL, input: texts });
      return {
        value: res.data.map((d) => d.embedding),
        usage: { input_tokens: res.usage?.prompt_tokens ?? res.usage?.total_tokens },
      };
    },
  );
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
