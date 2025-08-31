import { createClient } from '@supabase/supabase-js';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

// ⚠️ Populate with your real prices before relying on estimates.
const rows = [
  // Example chat model
  { provider: 'openai', model_code: 'gpt-4o-mini', modality: 'chat', input_per_1k_usd: null, output_per_1k_usd: null },
  // Example embeddings
  { provider: 'openai', model_code: 'text-embedding-3-small', modality: 'embeddings', input_per_1k_usd: null },
];

async function run() {
  const { error } = await admin.from('ai_model_pricing').upsert(rows, { onConflict: 'provider,model_code,modality' });
  if (error) throw error;
  console.log('Seeded ai_model_pricing (placeholders). Fill values in DB UI.');
}

run();
