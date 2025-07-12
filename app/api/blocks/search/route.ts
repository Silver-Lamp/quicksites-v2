import { NextRequest, NextResponse } from 'next/server';
import { COLLECTION, embedText, qdrant } from '@/lib/useVectorDB';

export async function POST(req: NextRequest) {
  const { query, type, industry, tone, topK = 5 } = await req.json();
  if (!query) return NextResponse.json({ error: 'Missing query' }, { status: 400 });

  const [embedding] = await embedText([query]);

  const searchResult = await qdrant.search(COLLECTION, {
    vector: embedding,
    limit: topK,
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
