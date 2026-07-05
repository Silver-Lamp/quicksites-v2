import { NextRequest, NextResponse } from 'next/server';
import { COLLECTION, embedText, qdrant } from '@/lib/useVectorDB';
import { rateLimitOr429 } from '@/lib/api/rateLimitGuard';

export async function POST(req: NextRequest) {
  // Public, unauthenticated endpoint that runs an OpenAI embedding on the caller's
  // query — per-IP throttle so anonymous callers can't run up embedding cost.
  const limited = await rateLimitOr429(req, 'blocks_search', 30, 3600);
  if (limited) return limited;

  const { query, type, industry, tone, topK = 5 } = await req.json();
  if (!query || typeof query !== 'string') {
    return NextResponse.json({ error: 'Missing query' }, { status: 400 });
  }

  const [embedding] = await embedText([query], { route: '/api/blocks/search' });

  const searchResult = await qdrant.search(COLLECTION, {
    vector: embedding,
    limit: Math.min(Math.max(Number(topK) || 5, 1), 25),
    filter: {
      must: [
        ...(type ? [{ key: 'type', match: { value: type } }] : []),
        ...(industry ? [{ key: 'industry', match: { value: industry } }] : []),
        ...(tone ? [{ key: 'tone', match: { value: tone } }] : []),
      ],
    },
  });

  return NextResponse.json({
    matches: searchResult.map((r) => r.payload?.text),
    metadata: searchResult.map((r) => r.payload),
  });
}
