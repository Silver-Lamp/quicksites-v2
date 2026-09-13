// app/api/admin/guests/leads/route.ts
//
// The guest-lead list for the ops panel. Admin-gated. Free by default; `?fetch=1` also reads each
// source website; `?lookup=1` also asks Places by name (paid, ~$0.03 a name, candidates only).
import { NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/auth/getAdminUser';
import { loadGuestLeads } from '@/lib/admin/guestLeads';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function GET(req: Request) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const url = new URL(req.url);
  const fetchSources = url.searchParams.get('fetch') === '1';
  const lookup = url.searchParams.get('lookup') === '1';
  try {
    const leads = await loadGuestLeads({ fetchSources, lookup });
    return NextResponse.json({ ok: true, leads, fetched: fetchSources, lookedUp: lookup });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Could not load guest leads.' }, { status: 500 });
  }
}
