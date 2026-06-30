// app/api/templates/rename/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireTemplateOwner } from '@/lib/auth/requireTemplateOwner';

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function trySetSlugViaCommit(templateId: string, base: string) {
  const root = slugify(base) || 'untitled';

  // Try root, then root-2, root-3... up to 50 candidates
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? root : `${root}-${i + 2}`;
    const r = await supabaseAdmin
      .schema('app')
      .rpc('set_template_slug', { p_id: templateId, p_slug: candidate });

    if (!r.error) {
      const row = Array.isArray(r.data) ? r.data[0] : r.data;
      return { ok: true as const, slug: row?.slug ?? candidate };
    }

    const code = String(r.error.code || '').toUpperCase();
    const msg  = r.error.message || '';

    // Published/base locked
    if (code === 'P0001' && /published/i.test(msg)) {
      return { ok: false as const, status: 409, error: 'Unpublish the base template to change the slug.' };
    }

    // Uniqueness conflicts → loop to next candidate
    if (code === '23505' || /slug.*taken|domain.*conflict/i.test(msg)) {
      continue;
    }

    // Unknown error → stop
    return { ok: false as const, status: 500, error: msg || 'Slug update failed.' };
  }

  return { ok: false as const, status: 409, error: 'Could not allocate a unique slug.' };
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (body && typeof body === 'object' && 'pages' in body) delete (body as any).pages;

  const template_id = String(body?.template_id ?? '').trim();
  const newName = String(body?.newName ?? '').trim();

  if (!template_id || newName.length < 3) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  // Authorize: only the template owner (or a platform admin) may rename/re-slug it.
  const gate = await requireTemplateOwner(template_id);
  if (!gate.ok) return gate.response;

  // Ensure template exists
  const { data: currentTemplate, error: fetchError } = await supabaseAdmin
    .from('templates')
    .select('id, template_name, slug')
    .eq('id', template_id)
    .maybeSingle();

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
  if (!currentTemplate) {
    return NextResponse.json(
      { error: 'Template not found (create/save the template before renaming).' },
      { status: 404 }
    );
  }

  // Name uniqueness (case-insensitive), excluding this id
  const { data: nameClash } = await supabaseAdmin
    .from('templates')
    .select('id')
    .ilike('template_name', newName)
    .neq('id', template_id)
    .maybeSingle();

  if (nameClash) {
    return NextResponse.json(
      { error: 'A template with that name already exists.' },
      { status: 400 }
    );
  }

  // 1) Update template_name only (no slug here!)
  const { data: renamed, error: nameErr } = await supabaseAdmin
    .from('templates')
    .update({ template_name: newName })
    .eq('id', template_id)
    .select('id, template_name, slug')
    .single();

  if (nameErr) {
    return NextResponse.json({ error: nameErr.message }, { status: 500 });
  }

  // 2) Update slug via commit pipeline (authoritative)
  const res = await trySetSlugViaCommit(template_id, newName);
  if (!res.ok) {
    // Return name update but surface slug failure (caller can decide what to do)
    return NextResponse.json(
      { error: res.error, template: renamed, status: res.status ?? 500 },
      { status: res.status ?? 500 }
    );
  }

  // Return updated tuple
  return NextResponse.json({
    message: 'Template renamed',
    template: { ...renamed, slug: res.slug },
  });
}
