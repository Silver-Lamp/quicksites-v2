// app/api/admin/templates/run-readiness-pipeline/route.ts
//
// Run the readiness pipeline (every applicable one-click fix, in order) for a site — or a
// small batch of sites, one after another. Admin-gated + rate-limited. Idempotent.
//
// POST { templateId }              → { ok, result }
// POST { templateIds: [id, …] }    → { ok, results: [...] }   (capped; run sequentially)
//
// For a large batch, the client loops this endpoint per site so each site stays inside one
// serverless request and progress can stream row-by-row.

import { NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/auth/getAdminUser';
import { rateLimitOr429 } from '@/lib/api/rateLimitGuard';
import { runReadinessPipeline } from '@/lib/seo/runReadinessPipeline';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Cap a single request's batch so it stays within the serverless budget (Places calls are slow). */
const MAX_BATCH = 5;

export async function POST(req: Request) {
  const operator = await getAdminUser();
  if (!operator) return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });

  const limited = await rateLimitOr429(req, 'run-readiness-pipeline', 120, 3600);
  if (limited) return limited;

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request body.' }, { status: 400 });
  }

  const actorId = operator.id ?? null;

  if (Array.isArray(body.templateIds)) {
    const ids = body.templateIds.map((x: any) => String(x || '').trim()).filter(Boolean).slice(0, MAX_BATCH);
    if (!ids.length) return NextResponse.json({ ok: false, error: 'No templateIds.' }, { status: 400 });
    const results = [];
    for (const id of ids) results.push(await runReadinessPipeline(id, actorId)); // sequential — one site at a time
    return NextResponse.json({ ok: true, results, capped: Array.isArray(body.templateIds) && body.templateIds.length > MAX_BATCH, maxBatch: MAX_BATCH });
  }

  const templateId = String(body.templateId ?? '').trim();
  if (!templateId) return NextResponse.json({ ok: false, error: 'A templateId is required.' }, { status: 400 });
  const result = await runReadinessPipeline(templateId, actorId);
  return NextResponse.json({ ok: result.ok, result }, { status: result.ok ? 200 : 404 });
}
