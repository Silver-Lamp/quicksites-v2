// app/api/admin/templates/fill-park-address/route.ts
//
// One-click "Use an industrial park address" for the templates list / next-step button.
// Thin wrapper over lib/parks/fillOfficeAddress (shared with the readiness pipeline). Fills a
// geo pitch site's missing office address from the industrial-park registry and commits.
//
// POST { templateId }
//   → { ok:true, changed:true, parkName, label }
//   → { ok:true, changed:false, reason:'no_parks'|'not_applicable'|'already'|'disabled' }
//   → { ok:false, reason:'no_city'|'no_template', error? }

import { NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/auth/getAdminUser';
import { rateLimitOr429 } from '@/lib/api/rateLimitGuard';
import { fillOfficeAddress } from '@/lib/parks/fillOfficeAddress';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Places Text Search on first touch for a metro

export async function POST(req: Request) {
  const operator = await getAdminUser();
  if (!operator) return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });

  const limited = await rateLimitOr429(req, 'templates-fill-park-address', 60, 3600);
  if (limited) return limited;

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request body.' }, { status: 400 });
  }
  const templateId = String(body.templateId ?? '').trim();
  if (!templateId) return NextResponse.json({ ok: false, error: 'A templateId is required.' }, { status: 400 });

  const r = await fillOfficeAddress(templateId, operator.id ?? null);
  const status = r.ok ? 200 : r.reason === 'no_template' ? 404 : r.reason === 'commit_failed' || r.reason === 'error' ? 502 : 400;
  return NextResponse.json(r, { status });
}
