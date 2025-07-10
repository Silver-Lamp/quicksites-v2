// app/api/templates/rename.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function POST(req: NextRequest) {
  console.log('.:. app/api/templates/rename/route.ts: POST request received');
  console.log('.:. app/api/templates/rename/route.ts: req:', req);
  const { template_id, newName } = await req.json();
  console.log('.:. app/api/templates/rename/route.ts: template_id:', template_id);
  console.log('.:. app/api/templates/rename/route.ts: newName:', newName);

  if (!template_id || !newName || newName.trim().length < 3) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  // Check for duplicate name (optional, still useful)
  const { data: existing } = await supabaseAdmin
    .from('templates')
    .select('template_name')
    .eq('template_name', newName.trim())
    .neq('id', template_id) // exclude current template
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

  // Update template
  const { error } = await supabaseAdmin
    .from('templates')
    .update({
      template_name: newName.trim(),
      slug,
    })
    .eq('id', template_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ message: 'Template renamed' });
}
