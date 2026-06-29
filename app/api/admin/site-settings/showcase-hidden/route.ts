// app/api/admin/site-settings/showcase-hidden/route.ts
//
// Read (public) / toggle (admin-only) which showcase sites are hidden.

import { NextRequest, NextResponse } from 'next/server';
import { getSiteSetting, setSiteSetting } from '@/lib/settings/siteSettings';
import { SHOWCASE_HIDDEN_KEY } from '@/lib/home/showcase-helpers';
import { adminUserId } from '@/lib/auth/adminUser';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function readHidden(): Promise<string[]> {
  const list = await getSiteSetting<string[]>(SHOWCASE_HIDDEN_KEY, []);
  return Array.isArray(list) ? list : [];
}

export async function GET() {
  return NextResponse.json({ hidden: await readHidden() });
}

export async function PUT(req: NextRequest) {
  const adminId = await adminUserId();
  if (!adminId) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const body = await req.json().catch(() => ({} as any));
  const slug = typeof body?.slug === 'string' ? body.slug.trim() : '';
  const hidden = Boolean(body?.hidden);
  if (!slug) return NextResponse.json({ error: 'missing slug' }, { status: 400 });

  const current = new Set(await readHidden());
  if (hidden) current.add(slug);
  else current.delete(slug);

  try {
    await setSiteSetting(SHOWCASE_HIDDEN_KEY, Array.from(current), adminId);
    return NextResponse.json({ ok: true, hidden: Array.from(current) });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'failed to save' }, { status: 500 });
  }
}
