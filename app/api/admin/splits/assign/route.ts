// app/api/admin/splits/assign/route.ts
//
// Credit a geo-domain rental to a closer and, optionally, a manager who earns the override.
// Admin-only: this decides who gets paid.

import { NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/auth/getAdminUser';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_NAME = 120;

/** Trim to a storable name, or null. Names are free text (reps predate having accounts). */
function cleanName(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim().slice(0, MAX_NAME);
  return s || null;
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

  const campaignId = String(body.campaignId ?? '');
  if (!campaignId)
    return NextResponse.json({ error: 'A campaignId is required.' }, { status: 400 });

  const soldBy = cleanName(body.soldBy);
  const manager = cleanName(body.manager);

  // A manager with nobody to manage cannot earn an override, and "recruited" is meaningless
  // without both parties — normalise here so the report never has to guess.
  const effectiveManager = soldBy ? manager : null;
  const managerIsRecruiter = !!(effectiveManager && body.managerIsRecruiter === true);

  const { error } = await supabaseAdmin
    .from('geo_industry_campaigns')
    .update({
      sold_by: soldBy,
      sold_by_manager: effectiveManager,
      manager_is_recruiter: managerIsRecruiter,
      updated_at: new Date().toISOString(),
    })
    .eq('id', campaignId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    assignment: {
      sold_by: soldBy,
      sold_by_manager: effectiveManager,
      manager_is_recruiter: managerIsRecruiter,
    },
  });
}
