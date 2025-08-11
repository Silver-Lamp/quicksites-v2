// app/api/templates/rename/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function ensureUniqueSlug(base: string, excludeId: string) {
  let candidate = slugify(base) || 'untitled';
  // try candidate, then candidate-2, candidate-3, ...
  for (let i = 0; i < 50; i++) {
    const trySlug = i === 0 ? candidate : `${candidate}-${i + 1}`;
    const { data: clash } = await supabaseAdmin
      .from('templates')
      .select('id, slug')
      .eq('slug', trySlug)
      .neq('id', excludeId)
      .maybeSingle();

    if (!clash) return trySlug;
  }
  // worst case
  return `${candidate}-${Date.now().toString(36)}`;
}

export async function POST(req: NextRequest) {
  console.log('.:. app/api/templates/rename/route.ts: POST request received');

  const body = await req.json().catch(() => ({}));
  if (body && typeof body === 'object' && 'pages' in body) delete (body as any).pages;

  const template_id = String(body?.template_id ?? '').trim();
  const newName = String(body?.newName ?? '').trim();

  console.log('.:. template_id:', template_id);
  console.log('.:. newName:', newName);

  if (!template_id || newName.length < 3) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  // Find the template to rename (404 if it hasn't been created yet)
  const { data: currentTemplate, error: fetchError } = await supabaseAdmin
    .from('templates')
    .select('*')
    .eq('id', template_id)
    .maybeSingle();

  if (fetchError) {
    console.warn('fetchError:', fetchError.message);
  }
  if (!currentTemplate) {
    return NextResponse.json(
      { error: 'Template not found (create/save the template before renaming).' },
      { status: 404 }
    );
  }

  // Case-insensitive duplicate name check (excluding this id)
  const { data: nameClash } = await supabaseAdmin
    .from('templates')
    .select('id, template_name')
    .ilike('template_name', newName) // case-insensitive equality
    .neq('id', template_id)
    .maybeSingle();

  if (nameClash) {
    return NextResponse.json(
      { error: 'A template with that name already exists.' },
      { status: 400 }
    );
  }

  // Generate a unique slug
  const slug = await ensureUniqueSlug(newName, template_id);

  // Update just the fields that matter (keeps DB defaults intact)
  const { data: updated, error: saveError } = await supabaseAdmin
    .from('templates')
    .update({ template_name: newName, slug })
    .eq('id', template_id)
    .select('id, template_name, slug')
    .single();

  if (saveError) {
    console.error('saveError:', saveError.message);
    return NextResponse.json({ error: saveError.message }, { status: 500 });
  }

  return NextResponse.json({
    message: 'Template renamed',
    template: updated,
  });
}
