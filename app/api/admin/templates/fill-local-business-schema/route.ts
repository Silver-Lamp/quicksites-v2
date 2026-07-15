// app/api/admin/templates/fill-local-business-schema/route.ts
//
// One-click "Add LocalBusiness schema" for the templates list / next-step button. Thin wrapper
// over lib/seo/fillLocalBusinessSchema (shared with the readiness pipeline).
//
// POST { templateId }
//   → { ok:true, changed:true, type }
//   → { ok:true, changed:false, reason:'already'|'insufficient' }
//   → { ok:false, reason:'no_template', error? }

import { NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/auth/getAdminUser';
import { rateLimitOr429 } from '@/lib/api/rateLimitGuard';
import { fillLocalBusinessSchema } from '@/lib/seo/fillLocalBusinessSchema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const operator = await getAdminUser();
  if (!operator) return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });

  const limited = await rateLimitOr429(req, 'templates-fill-schema', 120, 3600);
  if (limited) return limited;

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request body.' }, { status: 400 });
  }
  const templateId = String(body.templateId ?? '').trim();
  if (!templateId) return NextResponse.json({ ok: false, error: 'A templateId is required.' }, { status: 400 });

  const r = await fillLocalBusinessSchema(templateId, operator.id ?? null);
  const status = r.ok ? 200 : r.reason === 'no_template' ? 404 : r.reason === 'commit_failed' ? 502 : 400;
  return NextResponse.json(r, { status });
}
