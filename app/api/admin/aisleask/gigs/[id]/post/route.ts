// app/api/admin/aisleask/gigs/[id]/post/route.ts
//
// Cross-post support for one gig.
//   GET  ?channel=… — the ready-to-post content (title/body/hints) + launcher URLs + QR for a
//                     channel. This PREPARES a post; it never submits anywhere.
//   POST { channel, url?, note? } — record that the gig was cross-posted to a channel (the
//                     operator confirms "I posted it", or an owned-channel automation logs it),
//                     so the coverage view shows posted-where and we don't double-post.
// Admin-gated. See docs/AISLEASK_OPS_PLAN.md Feature B. Assisted posting only — no headless bot
// posts to Marketplace/Craigslist (no API + against their ToS).

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/requireUser';
import { getGig } from '@/lib/walker/gigs';
import { buildGigPost, launcherUrls, gigQrDataUrl, type PostChannel } from '@/lib/walker/gigPost';
import { recordGigPost } from '@/lib/walker/gigPosts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CHANNELS: PostChannel[] = [
  'craigslist',
  'facebook_marketplace',
  'facebook_page',
  'gigs_page',
  'email',
  'sms',
  'other',
];
const asChannel = (v: unknown): PostChannel | null =>
  CHANNELS.includes(v as PostChannel) ? (v as PostChannel) : null;

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;
  const { id } = await params;
  const gig = await getGig(id);
  if (!gig) return NextResponse.json({ error: 'Gig not found.' }, { status: 404 });

  const url = new URL(req.url);
  const channel = asChannel(url.searchParams.get('channel')) ?? 'craigslist';
  const payNote = url.searchParams.get('payNote');

  const content = buildGigPost(gig, channel, { payNote });
  const launchers = launcherUrls(gig);
  const qr = await gigQrDataUrl(gig).catch(() => null);
  return NextResponse.json({ content, launchers, qr });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;
  const { id } = await params;
  const gig = await getGig(id);
  if (!gig) return NextResponse.json({ error: 'Gig not found.' }, { status: 404 });

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  const channel = asChannel(body?.channel);
  if (!channel) return NextResponse.json({ error: 'Unknown channel.' }, { status: 400 });

  const post = await recordGigPost({
    gigId: id,
    channel,
    postedBy: admin.user.id,
    url: typeof body?.url === 'string' ? body.url : undefined,
    note: typeof body?.note === 'string' ? body.note : undefined,
  });
  if (!post) return NextResponse.json({ error: 'Could not record post.' }, { status: 500 });
  return NextResponse.json({ ok: true, post }, { status: 201 });
}
