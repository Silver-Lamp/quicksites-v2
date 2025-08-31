import { createClient } from '@supabase/supabase-js';

// IMPORTANT: public/anon client only (reads with RLS). Do NOT use service role here.
const supabasePublic = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } }
);

export type Modality = 'chat'|'embeddings'|'image'|'audio_stt'|'audio_tts';

export type ModelPricing = {
  provider: string;
  model_code: string;
  modality: Modality;
  input_per_1k_usd?: number | null;
  output_per_1k_usd?: number | null;
  image_base_usd?: number | null;
  image_per_mp_usd?: number | null;
  stt_per_min_usd?: number | null;
  tts_per_1k_chars_usd?: number | null;
};

export async function getPricing(provider: string, model_code: string, modality: Modality): Promise<ModelPricing> {
  const { data, error } = await supabasePublic
    .from('ai_model_pricing')
    .select('*')
    .eq('provider', provider)
    .eq('model_code', model_code)
    .eq('modality', modality)
    .eq('is_active', true)
    .maybeSingle();

  if (error || !data) {
    throw new Error(`Pricing missing for ${provider}:${model_code} (${modality})`);
  }
  return data as unknown as ModelPricing;
}
