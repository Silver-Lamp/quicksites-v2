// app/api/templates/rename.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function POST(req: NextRequest) {
  console.log('.:. app/api/templates/rename/route.ts: POST request received');

  const body = await req.json();
  if ('pages' in body) delete body.pages;

  const { template_id, newName } = body;
  console.log('.:. template_id:', template_id);
  console.log('.:. newName:', newName);

  if (!template_id || !newName || newName.trim().length < 3) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  // Check for duplicate name
  const { data: existing } = await supabaseAdmin
    .from('templates')
    .select('template_name')
    .eq('template_name', newName.trim())
    .neq('id', template_id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: 'A template with that name already exists.' },
      { status: 400 }
    );
  }

  // Generate slug
  const slug = newName
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');

  // Fetch full template
  const { data: currentTemplate, error: fetchError } = await supabaseAdmin
    .from('templates')
    .select('*')
    .eq('id', template_id)
    .single();

  if (fetchError || !currentTemplate) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 });
  }

  // Apply new name + slug
  const updatedTemplate = {
    ...currentTemplate,
    template_name: newName.trim(),
    slug,
  };

  // 🧹 Strip top-level pages if accidentally present
  if ('pages' in updatedTemplate) {
    delete (updatedTemplate as any).pages;
  }

  // Save full updated object
  const { error: saveError } = await supabaseAdmin
    .from('templates')
    .upsert(updatedTemplate, { onConflict: 'id' });

  if (saveError) {
    return NextResponse.json({ error: saveError.message }, { status: 500 });
  }

  return NextResponse.json({ message: 'Template renamed' });
}
