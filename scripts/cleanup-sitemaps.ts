import { supabase } from '@/lib/supabase';

const BUCKET = 'sitemaps';
const MAX_ENTRIES = 30;

async function cleanupOldSnapshots() {
  const { data, error } = await supabase.storage.from(BUCKET).list('', {
    limit: 1000,
    offset: 0,
    sortBy: { column: 'created_at', order: 'desc' }
  });

  if (error) throw error;

  const files = (data || []).filter(f => f.name.endsWith('.xml') && !f.name.startsWith('latest'));
  const grouped = files.reduce((acc, file) => {
    const base = file.name.split('-')[0]; // sitemap-index, sitemap-hreflang
    acc[base] = acc[base] || [];
    acc[base].push(file);
    return acc;
  }, {});

  for (const [base, items] of Object.entries(grouped)) {
    const toDelete = items.slice(MAX_ENTRIES);
    for (const file of toDelete) {
      console.log(`🗑 Deleting old ${file.name}`);
      await supabase.storage.from(BUCKET).remove([file.name]);
    }

    // also create/overwrite latest.xml
    const latest = items[0];
    const latestName = base + '-latest.xml';
    const { data: downloadUrl } = supabase.storage.from(BUCKET).getPublicUrl(latest.name);

    const res = await fetch(downloadUrl.publicUrl);
    const buffer = await res.arrayBuffer();
    await supabase.storage.from(BUCKET).upload(latestName, buffer, {
      contentType: 'application/xml',
      upsert: true
    });
    console.log(`📌 Updated ${latestName}`);
  }
}

await cleanupOldSnapshots();
