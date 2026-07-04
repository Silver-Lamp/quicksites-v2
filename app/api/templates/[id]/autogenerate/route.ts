// app/api/templates/[id]/autogenerate/route.ts
//
// Auto-run the equivalent of the hero editor's "Suggest All" + "Generate" for a
// template the caller owns (used by the guest-build first-open flow). Owner-gated
// (anon guests who own their draft are allowed) and subject to the guest AI cap.
import { NextResponse } from 'next/server';
import { requireTemplateOwner } from '@/lib/auth/requireTemplateOwner';
import { autogenerateForTemplate } from '@/lib/builder/autogenerateForTemplate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Copy + hero image generation is slow (~20s); avoid the default serverless timeout.
export const maxDuration = 60;

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const id = params.id;

  const gate = await requireTemplateOwner(id);
  if (!gate.ok) return gate.response;

  // NOTE: intentionally NOT counted against the per-guest manual AI cap. This is a
  // one-time, system-initiated build (bounded by the per-IP guest-draft creation
  // limit + the autogen_pending idempotency guard), so it shouldn't eat the calls a
  // guest has for manually editing (Suggest All / Generate) afterwards.
  const result = await autogenerateForTemplate(id, gate.userId);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 });

  return NextResponse.json({ ok: true, heroUrl: result.heroUrl, logoUrl: result.logoUrl, faviconUrl: result.faviconUrl });
}
