import { supabase } from 'admin/lib/supabaseClient.js';

const BUCKET = 'sitemaps';
const MAX_ENTRIES = 30;

async function cleanupOldSnapshots() {
  const { data, error } = await supabase.storage.from(BUCKET).list('', {
    limit: 1000,
    offset: 0,
    sortBy: { column: 'created_at', order: 'desc' },
  });

  if (error) throw error;

  const files = (data || []).filter(
    (f: any) => f.name.endsWith('.xml') && !f.name.startsWith('latest')
  );
  const grouped = files.reduce<Record<string, typeof files>>((acc: any, file: any) => {
    const base = file.name.split('-')[0]; // sitemap-index, sitemap-hreflang
    if (!acc[base]) {
      acc[base] = [];
    }
    acc[base].push(file);
    return acc;
  }, {});
  for (const [base, items] of Object.entries(grouped)) {
    const toDelete = (items as typeof files).slice(MAX_ENTRIES);
    for (const file of toDelete) {
      console.log(`🗑 Deleting old ${file.name}`);
      await supabase.storage.from(BUCKET).remove([file.name]);
    }
  }

  // also create/overwrite latest.xml
  for (const [base, items] of Object.entries(grouped)) {
    if (items.length > 0) {
      const latest = items[0];
      const latestName = `${base}-latest.xml`;
      const { data: downloadUrl } = supabase.storage.from(BUCKET).getPublicUrl(latest.name);

      if (downloadUrl) {
        const res = await fetch(downloadUrl.publicUrl);
        const buffer = await res.arrayBuffer();
        await supabase.storage.from(BUCKET).upload(latestName, buffer, {
          contentType: 'application/xml',
          upsert: true,
        });
        console.log(`📌 Updated ${latestName}`);
      }
      // The code below is redundant and should be removed as it duplicates the upload logic inside the loop.
      // INSERT_YOUR_REWRITE_HERE
      console.log(`📌 Updated ${latestName}`);
    }
  }
}

await cleanupOldSnapshots();
