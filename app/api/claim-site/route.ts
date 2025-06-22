export const runtime = 'nodejs';

import { createClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const { slug, email, anon } = await req.json();

  const { data: domain } = await supabase
    .from('domains')
    .select('*')
    .eq('domain', slug)
    .maybeSingle();

  if (!domain || domain.is_claimed) {
    return Response.json({ error: 'Already claimed' }, { status: 400 });
  }

  const updates = {
    is_claimed: true,
    ...(anon ? {} : { claimed_email: email }),
  };

  await supabase.from('domains').update(updates).eq('domain', slug);
  await supabase.from('screenshot_queue').insert({ domain: slug });

  if (!anon) {
    await supabase.from('steward_rewards').insert({
      user_id: null, // future link to email/user
      site_domain: slug,
      reason: 'initial_claim',
      points: 5,
    });
  }

  return Response.json({ success: true });
}
