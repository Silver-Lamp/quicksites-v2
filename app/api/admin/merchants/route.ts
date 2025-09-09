// app/api/admin/merchants/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function env(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}
const db = createClient(env('NEXT_PUBLIC_SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { persistSession: false, autoRefreshToken: false },
});

// check if a column exists before selecting it (avoids 500s on missing columns)
async function hasColumn(schema: string, table: string, column: string) {
  const { data, error } = await db
    .from('information_schema.columns' as any)
    .select('column_name')
    .eq('table_schema', schema)
    .eq('table_name', table)
    .eq('column_name', column)
    .maybeSingle();
  if (error) return false;
  return !!data?.column_name;
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const q = (url.searchParams.get('q') || '').trim();
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const pageSize = Math.min(Math.max(1, parseInt(url.searchParams.get('pageSize') || '50', 10)), 200);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    // Build a safe select list based on what columns actually exist
    const base = ['id', 'email', 'display_name', 'name'];
    const optionalCandidates = ['industry', 'industry_key', 'category', 'metadata'];

    const exists = await Promise.all(optionalCandidates.map(c => hasColumn('public', 'merchants', c)));
    const present: string[] = optionalCandidates.filter((_, i) => exists[i]);

    const selectCols = [...base, ...present].join(',');

    let query = db
      .from('merchants')
      .select(selectCols)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (q) {
      // simple ilike search across common text fields
      query = query.or(`email.ilike.%${q}%,display_name.ilike.%${q}%,name.ilike.%${q}%`);
    }

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const merchants = (data ?? []).map((m: any) => {
      // Normalize industry from whichever field exists
      const metaIndustry =
        typeof m?.metadata === 'object' && m?.metadata
          ? (m.metadata.industry ?? m.metadata.Industry ?? null)
          : null;

      const industry = m.industry ?? m.industry_key ?? m.category ?? metaIndustry ?? null;

      return {
        id: m.id,
        email: m.email ?? null,
        display_name: m.display_name ?? null,
        name: m.name ?? null,
        industry,
      };
    });

    return NextResponse.json({ merchants }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'server error' }, { status: 500 });
  }
}
