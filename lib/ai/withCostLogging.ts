import { createClient } from '@supabase/supabase-js';
import { getPricing } from '@/lib/ai/cost/pricing';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

type LogArgs = {
  provider: string;
  model_code: string;
  modality: 'chat'|'embeddings'|'image'|'audio_stt'|'audio_tts';
  template_id?: string;
  site_id?: string;
  user_id?: string;
  // raw usage from provider response
  input_tokens?: number; output_tokens?: number; images?: number; minutes_audio?: number;
  metadata?: Record<string, any>;
};

export async function logActualCost(args: LogArgs) {
  const pricing = await getPricing(args.provider, args.model_code, args.modality);
  let cost = 0;
  if (args.modality === 'chat') {
    const inUSD = pricing.input_per_1k_usd! * ((args.input_tokens || 0) / 1000);
    const outUSD = pricing.output_per_1k_usd! * ((args.output_tokens || 0) / 1000);
    cost = inUSD + outUSD;
  } else if (args.modality === 'embeddings') {
    const inUSD = pricing.input_per_1k_usd! * ((args.input_tokens || 0) / 1000);
    cost = inUSD;
  } else if (args.modality === 'image') {
    const base = pricing.image_base_usd || 0;
    const perMp = pricing.image_per_mp_usd || 0;
    // If you track pixels, add them in metadata and compute megapixels externally
    const images = args.images || 0;
    const mp = (args.metadata?.megapixels_per_image ?? 1);
    cost = images * (base + perMp * mp);
  } else if (args.modality === 'audio_stt') {
    const minutes = args.minutes_audio || 0;
    cost = (pricing.stt_per_min_usd || 0) * minutes;
  } else if (args.modality === 'audio_tts') {
    const chars = args.metadata?.chars || 0;
    cost = (pricing.tts_per_1k_chars_usd || 0) * (chars / 1000);
  }

  const { error } = await supabaseAdmin.from('ai_usage_events').insert({
    user_id: args.user_id || null,
    site_id: args.site_id || null,
    template_id: args.template_id || null,
    provider: args.provider,
    model_code: args.model_code,
    modality: args.modality,
    input_tokens: args.input_tokens || 0,
    output_tokens: args.output_tokens || 0,
    images: args.images || 0,
    minutes_audio: args.minutes_audio || 0,
    cost_usd: +cost.toFixed(6),
    metadata: args.metadata || null,
  });
  if (error) throw error;
  return cost;
}

// Example: wrapping a chat call
// const resp = await openai.chat.completions.create({ model: 'gpt-4o-mini', ... });
// await logActualCost({
//   provider: 'openai', model_code: 'gpt-4o-mini', modality: 'chat', template_id,
//   input_tokens: resp.usage?.prompt_tokens, output_tokens: resp.usage?.completion_tokens,
//   metadata: { route: '/api/generate/home' }
// });
