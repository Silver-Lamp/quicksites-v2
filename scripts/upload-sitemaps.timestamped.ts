import { supabase } from '@/lib/supabaseClient.js';
import fs from 'fs/promises';

function timestampSuffix() {
  const now = new Date();
  return now.toISOString().replace(/[:.]/g, '-');
}

async function uploadToStorage(filePath: string, bucket: string, targetKey: string) {
  const content = await fs.readFile(filePath);
  const suffix = timestampSuffix();
  const pathWithTimestamp = targetKey.replace('.xml', `-${suffix}.xml`);

  const { error } = await supabase.storage.from(bucket).upload(pathWithTimestamp, content, {
    contentType: 'application/xml',
    upsert: false,
  });

  if (error) {
    console.error(`❌ Upload failed: ${error.message}`);
  } else {
    console.log(`✅ Uploaded ${pathWithTimestamp} to Supabase Storage`);
  }
}

// Example usage
await uploadToStorage('snapshots/sitemap-index.xml', 'sitemaps', 'sitemap-index.xml');
await uploadToStorage('snapshots/sitemap-hreflang.xml', 'sitemaps', 'sitemap-hreflang.xml');
