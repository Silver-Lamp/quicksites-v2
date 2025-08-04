import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAllValidGscTokens } from '@/lib/gsc/getAllTokens';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const forceRefresh = searchParams.get('forceRefresh') === 'true';

  if (!startDate || !endDate) {
    return NextResponse.json({ error: 'Missing startDate or endDate' }, { status: 400 });
  }

  const tokenMap = await getAllValidGscTokens();
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
