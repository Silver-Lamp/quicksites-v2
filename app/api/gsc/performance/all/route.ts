import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireUser } from '@/lib/auth/requireUser';
import { getAdminUser } from '@/lib/auth/getAdminUser';
import { refreshGSC } from '@/lib/gsc/refreshToken';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)!
);

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  // Was unauthenticated + returned EVERY connected domain's stats (data leak).
  // Require auth and scope: admins see all connected domains, others only their own.
  const gate = await requireUser();
  if (gate instanceof NextResponse) return gate;
  const { user } = gate;
  const isAdmin = !!(await getAdminUser());

  const { searchParams } = new URL(req.url);
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const forceRefresh = searchParams.get('forceRefresh') === 'true';

  if (!startDate || !endDate) {
    return NextResponse.json({ error: 'Missing startDate or endDate' }, { status: 400 });
  }

  // Scoped connected-domain list, then refresh a token for each.
  let tq = supabase.from('gsc_tokens').select('domain, user_id');
  if (!isAdmin) tq = tq.eq('user_id', user.id);
  const { data: tokRows } = await tq;
  const scopedDomains = Array.from(
    new Set((tokRows || []).map((r: any) => r?.domain).filter(Boolean)),
  ) as string[];

  const tokenMap: Record<string, string> = {};
  await Promise.all(
    scopedDomains.map(async (domain) => {
      try { tokenMap[domain] = await refreshGSC(domain); } catch { /* skip domain */ }
    }),
  );

  const results: Record<string, any> = {};

  await Promise.all(
    Object.entries(tokenMap).map(async ([domain, token]) => {
      try {
        // Check cache
        if (!forceRefresh) {
          const { data: cached } = await supabase
            .from('gsc_cache')
            .select('data, expires_at')
            .eq('domain', domain)
            .eq('start_date', startDate)
            .eq('end_date', endDate)
            .single();

          if (
            cached?.data &&
            cached.expires_at &&
            new Date(cached.expires_at) > new Date()
          ) {
            results[domain] = cached.data;
            return;
          }
        }

        // Fetch from Google Search Console API
        const gscRes = await fetch(
          `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(domain)}/searchAnalytics/query`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              startDate,
              endDate,
              dimensions: ['page', 'query'], // order matters — keys[0] = page, keys[1] = query
              rowLimit: 1000,
            }),
          }
        );

        const json = await gscRes.json();

        if (json.rows) {
          const parsed = json.rows.map((row: any) => ({
            page: row.keys?.[0],
            query: row.keys?.[1],
            clicks: row.clicks,
            impressions: row.impressions,
            ctr: row.ctr,
            position: row.position,
          }));

          results[domain] = parsed;

          // Store in cache with 24-hour TTL
          await supabase.from('gsc_cache').upsert(
            {
              domain,
              start_date: startDate,
              end_date: endDate,
              data: parsed,
              expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            },
            { onConflict: 'domain,start_date,end_date' }
          );
        } else {
          results[domain] = {
            error: json.error?.message || 'No rows returned',
            meta: json,
          };
        }
      } catch (err: any) {
        results[domain] = { error: err.message };
      }
    })
  );

  return NextResponse.json(results);
}
