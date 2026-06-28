// scripts/fix_nested_data_data.js
import { createClient } from '@supabase/supabase-js';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(URL, KEY);

async function fixNestedTemplates() {
  const { data: templates, error } = await supabase
    .from('templates')
    .select('id, data');

  if (error) {
    console.error('❌ Error loading templates:', error);
    return;
  }

  const needsFix = templates.filter((t) => t.data?.data?.pages);

  console.log(`Found ${needsFix.length} templates with nested data.data.pages`);

  for (const t of needsFix) {
    const fixedData = {
      ...t.data,
      pages: t.data.data.pages,
      services: t.data.data.services || [],
    };

    delete fixedData.data;

    const { error: updateError } = await supabase
      .from('templates')
      .update({ data: fixedData })
      .eq('id', t.id);

    if (updateError) {
      console.error(`❌ Failed to fix template ${t.id}:`, updateError);
    } else {
      console.log(`✅ Fixed template ${t.id}`);
    }
  }
}

fixNestedTemplates();
