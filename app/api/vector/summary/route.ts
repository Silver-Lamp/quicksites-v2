import { NextRequest, NextResponse } from 'next/server';
import { qdrant, COLLECTION } from '@/lib/useVectorDB';

export async function GET(req: NextRequest) {
  try {
    const info = await qdrant.getCollection(COLLECTION);

    const scroll = await qdrant.scroll(COLLECTION, {
      limit: 500, // adjust if you want to scan more
      with_payload: true,
      with_vector: false,
    });

    const tally = {
      total: scroll.points.length,
      typeCounts: {} as Record<string, number>,
      industryCounts: {} as Record<string, number>,
      toneCounts: {} as Record<string, number>,
    };

    scroll.points.forEach((p) => {
      const payload = p.payload as any;
      if (payload?.type) tally.typeCounts[payload.type] = (tally.typeCounts[payload.type] || 0) + 1;
      if (payload?.industry) tally.industryCounts[payload.industry] = (tally.industryCounts[payload.industry] || 0) + 1;
      if (payload?.tone) tally.toneCounts[payload.tone] = (tally.toneCounts[payload.tone] || 0) + 1;
    });

    return NextResponse.json({
      name: COLLECTION,
      vectorsCount: info.vectors_count,
      vectorSize: info.config?.params?.vectors?.size,
      status: info.status,
      sampleSize: scroll.points.length,
      ...tally,
    });
  } catch (err: any) {
    console.error('❌ Vector summary error:', err);
    return NextResponse.json({ error: err.message || 'Unexpected error' }, { status: 500 });
  }
}
