// app/api/agents/blocks/route.ts
// Lists keys from blockContentSchemaMap
// ===============================
import { NextRequest as NextRequestBlocks } from 'next/server';

export const dynamicBlocks = 'force-dynamic';

export async function GET(_req: NextRequestBlocks) {
  try {
    const mod = await import('@/admin/lib/zod/blockSchema');
    const map = (mod as any).blockContentSchemaMap || {};
    const keys = Object.keys(map).sort();
    return new Response(JSON.stringify({ keys }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

