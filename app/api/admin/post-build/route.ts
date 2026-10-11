// app/api/admin/post-build/route.ts
//
// POST: build a claimable draft from a Facebook-style post (lib/outreach/buildDraftFromPost.ts)
// and answer with the preview, the production-minted claim link and a DM draft. Admin-only.
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/requireUser';
import { buildDraftFromPost, postBuildDm, PostBuildError, type PostSpec } from '@/lib/outreach/buildDraftFromPost';
import { getSenderProfile } from '@/lib/outreach/senderProfile';
import { tradeSiteBaseUrl } from '@/lib/tradeSites/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }
  const spec = body?.spec as PostSpec | undefined;
  if (!spec || typeof spec !== 'object') return NextResponse.json({ error: 'spec_required' }, { status: 400 });
  try {
    const built = await buildDraftFromPost(spec, gate.user.id, tradeSiteBaseUrl(), process.env.NEXT_PUBLIC_MENU_BASE_DOMAIN || null);
    const sender = await getSenderProfile().catch(() => null);
    const dm = postBuildDm({ firstName: spec.firstName ?? '', senderName: sender?.name?.split(' ')[0] || 'Sandon', previewUrl: built.previewUrl, claimUrl: built.claimUrl, context: typeof body.context === 'string' ? body.context : undefined });
    return NextResponse.json({ ok: true, ...built, dm });
  } catch (e) {
    if (e instanceof PostBuildError) return NextResponse.json({ error: e.code, detail: e.message }, { status: e.code === 'insert_failed' ? 502 : 400 });
    return NextResponse.json({ error: 'build_failed', detail: e instanceof Error ? e.message : undefined }, { status: 502 });
  }
}
