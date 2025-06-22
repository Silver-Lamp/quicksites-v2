// --- File: pages/api/clone-template.ts ---
import { NextApiRequest, NextApiResponse } from 'next';
import { json } from '@/lib/api/json';
import { supabase } from '@/admin/lib/supabaseClient';
import router from 'next/router';
import toast from 'react-hot-toast';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const { slug, templateId, brandingProfileId } = req.body;

  if (!slug || !templateId) {
    return json({ error: 'Missing slug or templateId' });
  }

  const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  if (!slugPattern.test(slug)) {
    return json({ error: 'Invalid slug format' });
  }

  const { data: existing, error: checkError } = await supabase
    .from('sites')
    .select('id')
    .eq('slug', slug)
    .single();

  if (existing) {
    return json({ error: 'Slug already exists.' });
  }

  const { data: templateData, error: templateError } = await supabase
    .from('templates')
    .select('*')
    .eq('id', templateId)
    .single();

  if (templateError || !templateData) {
    return json({ error: 'Template not found.' });
  }

  const { error: insertError } = await supabase.from('sites').insert({
    slug,
    branding_profile_id: brandingProfileId,
    content: templateData.content,
    template_id: templateId,
    created_at: new Date().toISOString(),
  });

  if (insertError) {
    return json({ error: insertError.message });
  }

  return json({ success: true });
}

// --- Frontend Submit Logic Example (React component) ---

const handlePublish = async () => {
  try {
    const res = await fetch('/api/clone-template', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug: 'test',
        templateId: 'test',
        brandingProfileId: 'test',
      }),
    });

    const result = await res.json();
    if (!res.ok) throw new Error(result.error);

    toast.success('Site published!');
    router.push(`/sites/test`);
  } catch (err: any) {
    toast.error(err.message);
  }
};
