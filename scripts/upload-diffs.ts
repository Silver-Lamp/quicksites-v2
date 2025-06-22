import { readFile } from 'fs/promises';
import * as Diff from 'diff';
import { supabase } from '@/admin/lib/supabaseClient';

async function generateAndUploadDiff(fileA: string, fileB: string, uploadKey: string) {
  const [xmlA, xmlB] = await Promise.all([readFile(fileA, 'utf8'), readFile(fileB, 'utf8')]);

  const patch = Diff.createPatch(uploadKey, xmlA, xmlB, 'Previous', 'Current');

  const { error } = await supabase.storage.from('sitemaps').upload(uploadKey, patch, {
    contentType: 'text/plain',
    upsert: true,
  });

  if (error) {
    console.error(`❌ Upload failed: ${error.message}`);
  } else {
    console.log(`✅ Diff uploaded as ${uploadKey}`);
  }
}

// Example usage:
await generateAndUploadDiff(
  'snapshots/sitemap-index-previous.xml',
  'snapshots/sitemap-index-latest.xml',
  'sitemap-index.diff'
);

await generateAndUploadDiff(
  'snapshots/sitemap-hreflang-previous.xml',
  'snapshots/sitemap-hreflang-latest.xml',
  'sitemap-hreflang.diff'
);
