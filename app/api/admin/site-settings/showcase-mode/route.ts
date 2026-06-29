// app/api/admin/site-settings/showcase-mode/route.ts
//
// Read (public) / set (admin-only) the homepage showcase display mode.

import { NextRequest, NextResponse } from 'next/server';
import { getSiteSetting, setSiteSetting } from '@/lib/settings/siteSettings';
import { SHOWCASE_MODE_KEY, DEFAULT_SHOWCASE_MODE, isShowcaseMode } from '@/lib/home/showcase-helpers';
import { adminUserId } from '@/lib/auth/adminUser';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const mode = await getSiteSetting<string>(SHOWCASE_MODE_KEY, DEFAULT_SHOWCASE_MODE);
  return NextResponse.json({ mode: isShowcaseMode(mode) ? mode : DEFAULT_SHOWCASE_MODE });
}

export async function PUT(req: NextRequest) {
  const adminId = await adminUserId();
  if (!adminId) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const body = await req.json().catch(() => ({} as any));
  const mode = body?.mode;
  if (!isShowcaseMode(mode)) return NextResponse.json({ error: 'invalid mode' }, { status: 400 });

  try {
    await setSiteSetting(SHOWCASE_MODE_KEY, mode, adminId);
    return NextResponse.json({ ok: true, mode });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'failed to save' }, { status: 500 });
  }
}
