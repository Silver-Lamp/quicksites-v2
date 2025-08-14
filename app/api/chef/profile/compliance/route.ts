import { NextRequest, NextResponse } from "next/server";
import { createClient } from '@supabase/supabase-js';

export const runtime='nodejs'; export const dynamic='force-dynamic';

const svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function POST(req: NextRequest) {
    const { state, county, operation_type } = await req.json();
    if (operation_type === 'MEHKO' && String(state).toUpperCase() === 'CA') {
    try {
    const { data: ok } = await svc.from('mehko_opt_in_counties')
      .select('county').eq('state','CA').eq('county', county).eq('active', true).maybeSingle();
        if (!ok) {
            return NextResponse.json({ error: 'MEHKO is not available in your county yet.' }, { status: 422 });
        }
    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: 'MEHKO is not available in your county yet.' }, { status: 422 });
    }
  }
}