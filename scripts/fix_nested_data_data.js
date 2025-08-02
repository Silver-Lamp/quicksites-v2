// scripts/fix_nested_data_data.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://kcwruliugwidsdgsrthy.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtjd3J1bGl1Z3dpZHNkZ3NydGh5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0Nzg5NzQ3MiwiZXhwIjoyMDYzNDczNDcyfQ.FEkCeVDvPay56cVlWCltQcsS7V9Cx5I-Q-yI9QuGSLU'
);

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
