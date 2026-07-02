import { NextRequest, NextResponse } from 'next/server';
import { COLLECTION, embedText, qdrant, ensureCollection } from '@/lib/useVectorDB';
import { requireUser } from '@/lib/auth/requireUser';

export async function POST(req: NextRequest) {
  // Runs OpenAI embeddings + writes the vector index — require a signed-in user
  // so anonymous callers can't pollute the index or run up embedding cost.
  const gate = await requireUser();
  if (gate instanceof NextResponse) return gate;

  try {
    const { blocks } = await req.json();
    if (!Array.isArray(blocks)) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    await ensureCollection();

    const embeddings = await embedText(blocks.map((b: any) => b.text));

    const points = blocks.map((b: any, i: number) => ({
      id: b.id,
      vector: embeddings[i],
      payload: {
        text: b.text,
        type: b.type,
        industry: b.industry,
        tone: b.tone || 'neutral',
      },
    }));

    await qdrant.upsert(COLLECTION, { points });

    return NextResponse.json({ status: 'success', count: blocks.length });
  } catch (err: any) {
    console.error('Qdrant error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
