import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/requireUser';

export async function GET(req: NextRequest) {
  // Require auth — don't let anyone probe which domains have GSC connected.
  const gate = await requireUser();
  if (gate instanceof NextResponse) return gate;

  const domain = req.nextUrl.searchParams.get('domain');
  if (!domain) return NextResponse.json({ error: 'Missing domain' }, { status: 400 });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)!
  );

  const { data } = await supabase
    .from('gsc_tokens')
    .select('id')
    .eq('domain', domain)
    .maybeSingle();

  return NextResponse.json({ connected: !!data });
}
