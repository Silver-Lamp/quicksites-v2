// app/api/admin/templates/paint-backdrop/route.ts
//
// Generate a painterly backdrop for ONE site. This is the only backdrop path that spends
// money (~$0.04/call, gpt-image-1), so it is deliberately narrow:
//
//   • admin-gated, one templateId per call — no `all: true`, no batch mode. The
//     painterly-backdrop standard's cost posture is "owner-triggered, paint-one-first,
//     no sweep without fresh sign-off"; a batch flag here is how that gets violated later.
//   • rate-limited harder than the free CSS route.
//   • the CSS styles live at /api/admin/templates/apply-backdrop and cost nothing.
//
// POST { templateId, subject?, intensity? }
//   → { ok:true, changed:true, url }
//   → { ok:true, changed:false, reason:'generate_failed'|'upload_failed'|'not_found'|… }

import { NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/auth/getAdminUser';
import { rateLimitOr429 } from '@/lib/api/rateLimitGuard';
import { paintSiteBackdrop } from '@/lib/images/paintBackdrop';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// gpt-image-1 at 'medium' measures ~20s; the default serverless timeout would kill it.
export const maxDuration = 60;

export async function POST(req: Request) {
  const operator = await getAdminUser();
  if (!operator) return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });

  // Tighter than the free route on purpose — every call here bills.
  const limited = await rateLimitOr429(req, 'templates-paint-backdrop', 20, 3600);
  if (limited) return limited;

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid body' }, { status: 400 });
  }

  const templateId = String(body?.templateId ?? '').trim();
  if (!templateId) return NextResponse.json({ ok: false, error: 'templateId required' }, { status: 400 });

  const subject = typeof body?.subject === 'string' ? body.subject.slice(0, 300) : null;
  const intensity = typeof body?.intensity === 'number' ? body.intensity : undefined;

  const out = await paintSiteBackdrop(templateId, operator.id, { subject, intensity });
  return NextResponse.json({ ok: true, ...out });
}
