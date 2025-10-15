import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';

export const runtime = 'nodejs';

type Body = {
  slug: string;
  is_paid: boolean;
};

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  }
  const { slug, is_paid } = body || ({} as Body);
  if (!slug || typeof is_paid !== 'boolean') {
    return NextResponse.json({ error: 'slug and is_paid are required' }, { status: 400 });
  }

  const supabase = await getServerSupabase({ serviceRole: true });

  // Decide the gates for each plan
  const paidEnables = {
    enable_donations: true,
    enable_events: true,
    enable_newsletter: true,
    enable_endorsements: true,
    enable_volunteer: true,
    allow_text: true,
    allow_email: true,
  };
  const freeEnables = {
    enable_donations: false,
    enable_events: false,
    enable_newsletter: false,
    enable_endorsements: false,
    enable_volunteer: false,
    allow_text: false,
    allow_email: false,
  };

  const patch = is_paid ? paidEnables : freeEnables;

  const { error } = await supabase
    .from('candidate_pages')
    .update({ is_paid: is_paid, ...patch })
    .eq('slug', slug);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
