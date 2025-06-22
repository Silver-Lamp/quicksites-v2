// app/api/sites/create/route.ts
export const runtime = 'nodejs';

import { createClient } from '@supabase/supabase-js';
import { json } from '@/lib/api/json';
import { generateBaseSlug } from '@/lib/slugHelpers';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function baseSlug(businessName: string, location?: string): string {
  const name = businessName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const loc = location?.toLowerCase().split(',')[0].replace(/[^a-z0-9]+/g, '-') || '';
  const raw = `${name}-${loc}`.replace(/^-+|-+$/g, '');
  return raw.replace(/--+/g, '-');
}

async function generateUniqueSlug(base: string): Promise<string> {
  let slug = base;
  let attempt = 1;
  while (true) {
    const { data } = await supabase
      .from('sites')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();
    if (!data) break;
    attempt += 1;
    slug = `${base}-${attempt}`;
  }
  return slug;
}

export async function POST(req: Request) {
  const body = await req.json();
  const { template_version_id, business_name, location, domain, slug: clientSlug, email } = body;

  const base = generateBaseSlug(business_name, location);
  const slug = clientSlug || (await generateUniqueSlug(base));

  const serverSupabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: () => cookies() } // @ts-ignore
  );

  const {
    data: { user },
  } = await serverSupabase.auth.getUser();

  if (!user) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Throttle site creation: limit 1 every 10 minutes
  const recent = await supabase
    .from('sites')
    .select('created_at')
    .eq('created_by', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (
    recent?.data &&
    Date.now() - new Date(recent.data.created_at).getTime() < 10 * 60 * 1000
  ) {
    return json({ error: 'Too soon — please wait 10 minutes before creating another site.' });
  }

  const { data: versions, error: fetchError } = await supabase
    .from('template_versions')
    .select('*')
    .eq('id', template_version_id)
    .limit(1);

  if (fetchError || !versions?.length) {
    return json({ error: 'Template not found' });
  }

  const full_data = versions[0].full_data;
  if (!full_data) {
    return json({ error: 'Template data missing' });
  }

  try {
    const { data: newSite, error: insertError } = await supabase
      .from('sites')
      .insert([
        {
          slug,
          domain,
          business_name,
          location,
          template_version_id,
          content: full_data,
          created_by: user.id,
          claimed_email: email || null,
        },
      ])
      .select()
      .single();

    if (insertError) {
      throw insertError;
    }

    if (email) {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/resend-welcome-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            name: business_name,
            slug: newSite.slug,
            templateName: versions[0].template_name || 'a QuickSites template',
          }),
        });

        if (!response.ok) {
          console.warn('⚠️ Failed to send welcome email:', await response.text());
        }
      } catch (err) {
        console.warn('⚠️ Error sending welcome email:', err);
      }
    }

    return json(newSite);
  } catch (insertError: any) {
    console.error('Insert failed:', insertError.message);

    await supabase.from('deploy_errors').insert({
      context: 'site_create',
      payload: {
        email,
        domain,
        business_name,
        location,
        template_version_id,
        error: insertError.message,
        user_id: user.id,
      },
    });

    return json({ error: 'Failed to create site' }, { status: 500 });
  }
}

export async function GET() {
  return json({ message: '👋 POST to this endpoint to create a site.' });
}
