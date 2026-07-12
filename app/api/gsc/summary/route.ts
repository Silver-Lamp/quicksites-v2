// app/api/gsc/summary/route.ts
//
// Scoped GSC totals for the templates-list cards. Returns 28-day clicks +
// impressions per connected domain, keyed by normalized domain. SCOPED:
// platform admins see every connected property; everyone else sees only the
// domains they connected (gsc_tokens.user_id). Cached in gsc_cache under a
// `sum:` key so it never collides with the by-page cache used by performance/all.
import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';
import { requireUser } from '@/lib/auth/requireUser';
import { getAdminUser } from '@/lib/auth/getAdminUser';
import { getValidOAuthClient } from '@/lib/gsc/getValidOAuthClient';
import { normalizeGscDomain } from '@/lib/gsc/normalizeDomain';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)!,
  { auth: { persistSession: false } },
);

const ymd = (d: Date) => d.toISOString().slice(0, 10);
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6h

export async function GET() {
  const gate = await requireUser();
  if (gate instanceof NextResponse) return gate;
  const { user } = gate;
  const isAdmin = !!(await getAdminUser());

  // Scope: admins → all connected domains; others → only what they connected.
  let q = admin.from('gsc_tokens').select('domain, user_id');
  if (!isAdmin) q = q.eq('user_id', user.id);
  const { data: tokenRows, error: tokErr } = await q;
  if (tokErr) return NextResponse.json({ ok: false, error: 'tokens' }, { status: 500 });

  const domains = Array.from(
    new Set((tokenRows || []).map((r: any) => r?.domain).filter(Boolean)),
  ) as string[];

  // GSC data lags ~2–3 days; use a 28-day window ending 3 days ago.
  const end = new Date();
  end.setDate(end.getDate() - 3);
  const start = new Date(end);
  start.setDate(start.getDate() - 28);
  const startDate = ymd(start);
  const endDate = ymd(end);

  const byDomain: Record<string, { clicks: number; impressions: number; position: number }> = {};

  await Promise.all(
    domains.map(async (domain) => {
      const cacheKey = `sum:${domain}`;
      try {
        const { data: cached } = await admin
          .from('gsc_cache')
          .select('data, expires_at')
          .eq('domain', cacheKey)
          .eq('start_date', startDate)
          .eq('end_date', endDate)
          .maybeSingle();

        let totals =
          cached?.data && cached.expires_at && new Date(cached.expires_at) > new Date()
            ? (cached.data as { clicks: number; impressions: number; position?: number })
            : null;
        // Older cache rows predate `position`; refetch so the rank column has data.
        if (totals && typeof totals.position !== 'number') totals = null;

        if (!totals) {
          const oauth2Client = await getValidOAuthClient(domain);
          const searchconsole = google.searchconsole({ version: 'v1', auth: oauth2Client });
          const res = await searchconsole.searchanalytics.query({
            siteUrl: domain,
            requestBody: { startDate, endDate }, // no dimensions → single totals row
          });
          const row = res.data.rows?.[0];
          totals = {
            clicks: Math.round(row?.clicks ?? 0),
            impressions: Math.round(row?.impressions ?? 0),
            position: Math.round((row?.position ?? 0) * 10) / 10, // avg position, 1 decimal
          };

          // Best-effort cache write (isolated under the sum: key).
          try {
            await admin.from('gsc_cache').upsert(
              {
                domain: cacheKey,
                start_date: startDate,
                end_date: endDate,
                data: totals,
                expires_at: new Date(Date.now() + CACHE_TTL_MS).toISOString(),
              },
              { onConflict: 'domain,start_date,end_date' },
            );
          } catch { /* caching is optional */ }
        }

        const key = normalizeGscDomain(domain);
        if (key) byDomain[key] = { clicks: totals.clicks, impressions: totals.impressions, position: totals.position ?? 0 };
      } catch {
        // Skip a domain whose token/refresh/query fails — no badge, no page break.
      }
    }),
  );

  return NextResponse.json({ ok: true, period: { startDate, endDate }, byDomain });
}
