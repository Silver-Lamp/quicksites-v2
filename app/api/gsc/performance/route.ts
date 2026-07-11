// app/api/gsc/performance/route.ts
// 📊 Server-side GSC performance data (per page), scoped to domains the caller
// connected (or all, for admins).
import { google } from 'googleapis';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireUser } from '@/lib/auth/requireUser';
import { getAdminUser } from '@/lib/auth/getAdminUser';
import { getValidOAuthClient } from '@/lib/gsc/getValidOAuthClient';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)!,
  { auth: { persistSession: false } },
);

const ymd = (d: Date) => d.toISOString().slice(0, 10);

export async function GET(req: NextRequest) {
  // Was unauthenticated + hardcoded to a 2024 window. Require auth, scope to the
  // caller's connected domains, and use a real (overridable) rolling window.
  const gate = await requireUser();
  if (gate instanceof NextResponse) return gate;
  const { user } = gate;
  const isAdmin = !!(await getAdminUser());

  const domain = req.nextUrl.searchParams.get('site');
  if (!domain) return NextResponse.json({ error: 'Missing site param' }, { status: 400 });

  if (!isAdmin) {
    const { data: tok } = await admin
      .from('gsc_tokens')
      .select('id')
      .eq('domain', domain)
      .eq('user_id', user.id)
      .maybeSingle();
    if (!tok) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  // GSC data lags ~2–3 days; default to a 28-day window ending 3 days ago.
  const end = new Date();
  end.setDate(end.getDate() - 3);
  const start = new Date(end);
  start.setDate(start.getDate() - 28);
  const startDate = req.nextUrl.searchParams.get('startDate') || ymd(start);
  const endDate = req.nextUrl.searchParams.get('endDate') || ymd(end);

  try {
    const oauth2Client = await getValidOAuthClient(domain);
    const searchconsole = google.searchconsole({ version: 'v1', auth: oauth2Client });

    const result = await searchconsole.searchanalytics.query({
      siteUrl: domain,
      requestBody: { startDate, endDate, dimensions: ['page'] },
    });

    return NextResponse.json(result.data.rows || []);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
