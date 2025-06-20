import { createClient } from '@supabase/supabase-js';
import { json } from '@/lib/api/json';
import { NextApiRequest, NextApiResponse } from 'next';
import { generateBaseSlug } from '@/lib/slugHelpers';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function generateSlug(businessName: string, location?: string): string {
  const name = businessName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const loc =
    location
      ?.toLowerCase()
      .split(',')[0]
      .replace(/[^a-z0-9]+/g, '-') || '';
  const raw = `${name}-${loc}`.replace(/^-+|-+$/g, '');
  return raw.replace(/--+/g, '-'); // collapse multiple dashes
}

async function generateUniqueSlug(base: string): Promise<string> {
  let slug = base;
  let attempt = 1;

  while (true) {
    const { data, error } = await supabase
      .from('sites')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();

    if (!data) break; // slug is available
    attempt += 1;
    slug = `${base}-${attempt}`;
  }

  return slug;
}

function baseSlug(businessName: string, location?: string): string {
  const name = businessName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const loc =
    location
      ?.toLowerCase()
      .split(',')[0]
      .replace(/[^a-z0-9]+/g, '-') || '';
  const raw = `${name}-${loc}`.replace(/^-+|-+$/g, '');
  return raw.replace(/--+/g, '-');
}
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('Incoming request payload:', req.body);
  const { template_version_id, business_name, location, domain } = req.body;
  const base = generateBaseSlug(business_name, location);
  const slug = await generateUniqueSlug(base);

  // Get template data
  const { data: versions, error } = await supabase
    .from('template_versions')
    .select('*')
    .eq('id', template_version_id)
    .limit(1);

  console.log('Template fetch result:', versions);

  if (error || !versions?.length) {
    console.error('Error fetching template_version:', error, versions);
    return json({ error: error?.message || 'Template not found' });
  }

  const full_data = versions[0].full_data;
  if (!full_data) {
    console.error('Missing full_data from template_version');
    return json({ error: 'Template data missing' });
  }

  // Insert new site (you can adjust table name)
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
      },
    ])
    .select()
    .single();

  if (insertError) {
    console.error('Insert failed:', insertError.message);
    console.log('Insert payload:', {
      domain,
      business_name,
      location,
      template_version_id,
      content: full_data,
    });
    return json({ error: insertError.message });
  }

  json(newSite);
}
