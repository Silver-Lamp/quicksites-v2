import { supabase } from '@/lib/supabaseClient.js';
import fs from 'fs/promises';

async function uploadToStorage(filePath: string, bucket: string, targetKey: string) {
  const content = await fs.readFile(filePath);

  const { error } = await supabase.storage.from(bucket).upload(targetKey, content, {
    contentType: 'application/xml',
    upsert: true,
  });

  if (error) {
    console.error(`❌ Upload failed: ${error.message}`);
  } else {
    console.log(`✅ Uploaded ${targetKey} to Supabase Storage`);
  }
}

// Example usage
await uploadToStorage('snapshots/sitemap-index.xml', 'sitemaps', 'sitemap-index.xml');
await uploadToStorage('snapshots/sitemap-hreflang.xml', 'sitemaps', 'sitemap-hreflang.xml');
