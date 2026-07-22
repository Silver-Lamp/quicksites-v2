// app/api/admin/hear-this-page/route.ts
//
// Super-admin config for the platform "Hear this page" launcher (Phase 2).
//   GET  -> { settings, enabled, allKinds, allSurfaces }
//   POST -> { surfaces } -> saves + returns the normalized settings
// Admin-gated. The stored config only NARROWS what renders (per-surface enable + a
// data-kinds allowlist); the NEXT_PUBLIC_HEAR_THIS_PAGE_ENABLED flag remains the master
// switch + billing gate on top of it.

import { NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/auth/getAdminUser';
import { getHearThisPageSettings, setHearThisPageSettings } from '@/lib/hearThisPage/settings';
import {
  ALL_KINDS,
  ALL_SURFACES,
  HEAR_THIS_PAGE_ENABLED,
  normalizeSettings,
} from '@/lib/hearThisPage/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const settings = await getHearThisPageSettings();
  return NextResponse.json({
    ok: true,
    settings,
    enabled: HEAR_THIS_PAGE_ENABLED,
    allKinds: ALL_KINDS,
    allSurfaces: ALL_SURFACES,
  });
}

export async function POST(req: Request) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  try {
    // normalizeSettings drops unknown kinds/surfaces + keeps summary as the baseline.
    const saved = await setHearThisPageSettings(normalizeSettings(body), admin.id);
    return NextResponse.json({ ok: true, settings: saved });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Could not save settings.' }, { status: 400 });
  }
}
