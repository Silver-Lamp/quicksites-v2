import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const API_ENDPOINT = 'http://localhost:3000/api/blocks/index'; // ✅ Use your local or deployed endpoint

type BlockInput = {
  id: string;
  text: string;
  type: string;
  industry: string;
  tone?: string;
};

async function fetchBlocksFromSupabase(): Promise<BlockInput[]> {
  const { data: templates, error } = await supabase.from('templates').select('*');

  if (error) throw new Error(`Supabase error: ${error.message}`);

  const blocks: BlockInput[] = [];

  for (const template of templates) {
    const industry = template.industry || 'default';
    const pages = template.data?.pages || [];

    for (const page of pages) {
      for (let i = 0; i < (page.content_blocks || []).length; i++) {
        const block = page.content_blocks[i];
        const id = `template-${template.id}-page-${page.slug}-block-${i}`;

        blocks.push({
          id,
          text: JSON.stringify(block),
          type: block.type || 'unknown',
          industry,
          tone: 'neutral',
        });
      }
    }
  }

  return blocks;
}

async function postBlocksToApi(blocks: BlockInput[]) {
  const batchSize = 50;

  for (let i = 0; i < blocks.length; i += batchSize) {
    const batch = blocks.slice(i, i + batchSize);

    const res = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blocks: batch }),
    });

    const contentType = res.headers.get('content-type') || '';

    if (!res.ok) {
      const body = contentType.includes('application/json')
        ? await res.json()
        : await res.text();

      console.error(`❌ Failed to index batch ${i}–${i + batch.length - 1}:`, body);
      throw new Error(`Request failed with status ${res.status}`);
    }

    console.log(`✅ Indexed ${batch.length} blocks (batch ${i / batchSize + 1})`);
  }
}

(async () => {
  try {
    const blocks = await fetchBlocksFromSupabase();
    console.log(`Preparing to index ${blocks.length} blocks...`);
    await postBlocksToApi(blocks);
    console.log('🎉 All blocks indexed successfully.');
  } catch (err: any) {
    console.error('💥 Error during indexing:', err.message || err);
  }
})();
