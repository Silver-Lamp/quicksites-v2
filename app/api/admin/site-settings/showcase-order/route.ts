// app/api/admin/site-settings/showcase-order/route.ts
//
// Read (public) / set (admin-only) the admin-defined showcase ordering.

import { NextRequest, NextResponse } from 'next/server';
import { getSiteSetting, setSiteSetting } from '@/lib/settings/siteSettings';
import { SHOWCASE_ORDER_KEY } from '@/lib/home/showcase-helpers';
import { adminUserId } from '@/lib/auth/adminUser';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const order = await getSiteSetting<string[]>(SHOWCASE_ORDER_KEY, []);
  return NextResponse.json({ order: Array.isArray(order) ? order : [] });
}

export async function PUT(req: NextRequest) {
  const adminId = await adminUserId();
  if (!adminId) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const body = await req.json().catch(() => ({} as any));
  const order = Array.isArray(body?.order) ? body.order.filter((s: unknown) => typeof s === 'string') : null;
  if (!order) return NextResponse.json({ error: 'order must be an array of slugs' }, { status: 400 });

  try {
    await setSiteSetting(SHOWCASE_ORDER_KEY, order, adminId);
    return NextResponse.json({ ok: true, order });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'failed to save' }, { status: 500 });
  }
}
