// app/api/admin/design-partners/[id]/route.ts
//
// Superadmin: update a design partner's pipeline fields (status / next step / due / notes) or stamp
// a nudge (action:'nudge' → lastNudgedAt = now). Admin-gated; persists to site_settings.

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/requireUser';
import {
  updateDesignPartner,
  PARTNER_STATUSES,
  type PartnerStatus,
} from '@/lib/admin/designPartners';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;
  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'Missing id.' }, { status: 400 });

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  // Quick action: mark that we nudged the partner today.
  if (body?.action === 'nudge') {
    await updateDesignPartner(id, { lastNudgedAt: new Date().toISOString() }, admin.user.id);
    return NextResponse.json({ ok: true });
  }

  const patch: any = {};
  if (typeof body?.status === 'string' && PARTNER_STATUSES.includes(body.status as PartnerStatus))
    patch.status = body.status;
  if (typeof body?.nextStep === 'string') patch.nextStep = body.nextStep.slice(0, 500);
  if (typeof body?.nextStepDue === 'string') patch.nextStepDue = body.nextStepDue.slice(0, 40);
  if (typeof body?.notes === 'string') patch.notes = body.notes.slice(0, 2000);
  if (!Object.keys(patch).length)
    return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 });

  await updateDesignPartner(id, patch, admin.user.id);
  return NextResponse.json({ ok: true });
}
