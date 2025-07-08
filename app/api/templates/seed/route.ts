// app/api/templates/seed/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createTemplateFromPresetWithBlocks, templatePresets } from '@/lib/createTemplateFromPreset';
//  import type { Database } from '@/types/supabase';

export async function POST() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
      
  // Optional: check for auth
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Seed all available presets
  const industryList = Object.keys(templatePresets) as (keyof typeof templatePresets)[];
  const templates = industryList.map((industry) => createTemplateFromPresetWithBlocks(industry));

  const { data, error } = await supabase
    .from('templates')
    .insert(templates)
    .select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, count: data.length, templates: data });
}
