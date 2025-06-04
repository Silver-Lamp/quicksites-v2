// --- File: pages/api/clone-template.ts ---
import { supabase } from '@/admin/lib/supabaseClientClient';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { slug, templateId, brandingProfileId } = req.body;

  if (!slug || !templateId) {
    return res.status(400).json({ error: 'Missing slug or templateId' });
  }

  const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  if (!slugPattern.test(slug)) {
    return res.status(400).json({ error: 'Invalid slug format' });
  }

  const { data: existing, error: checkError } = await supabase
    .from('sites')
    .select('id')
    .eq('slug', slug)
    .single();

  if (existing) {
    return res.status(409).json({ error: 'Slug already exists.' });
  }

  const { data: templateData, error: templateError } = await supabase
    .from('templates')
    .select('*')
    .eq('id', templateId)
    .single();

  if (templateError || !templateData) {
    return res.status(404).json({ error: 'Template not found.' });
  }

  const { error: insertError } = await supabase.from('sites').insert({
    slug,
    branding_profile_id: brandingProfileId,
    content: templateData.content,
    template_id: templateId,
    created_at: new Date().toISOString(),
  });

  if (insertError) {
    return res.status(500).json({ error: insertError.message });
  }

  return res.status(200).json({ success: true });
}


// --- Frontend Submit Logic Example (React component) ---

const handlePublish = async () => {
  try {
    const res = await fetch('/api/clone-template', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug,
        templateId: currentTemplate.id,
        brandingProfileId: selectedBrandingId,
      }),
    });

    const result = await res.json();
    if (!res.ok) throw new Error(result.error);

    toast.success('Site published!');
    router.push(`/sites/${slug}`);
  } catch (err) {
    toast.error(err.message);
  }
};
