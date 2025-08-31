import { createClient } from '@supabase/supabase-js';
import { estimateTemplateCost } from '@/lib/ai/cost/estimate';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

type SeededTemplate = { id: string; data?: any; pages?: any[] }; // adapt

type Options = {
  provider?: string;      // default from env
  model_code?: string;    // default from env
  profileCode?: 'BASIC'|'RICH'|'MAX';
};

const DEF_PROVIDER = process.env.AI_DEFAULT_PROVIDER || 'openai';
const DEF_MODEL = process.env.AI_DEFAULT_MODEL || 'gpt-4o-mini';

export async function attachTemplateAiEstimate(t: SeededTemplate, opts: Options = {}) {
  const provider = opts.provider ?? DEF_PROVIDER;
  const model_code = opts.model_code ?? DEF_MODEL;

  const est = await estimateTemplateCost({
    entityType: 'template',
    entityId: t.id,
    provider,
    model_code,
    template: { id: t.id, pages: (t as any).pages || (t as any).data?.pages || [] },
    profileCode: opts.profileCode ?? 'RICH',
  });

  const { error } = await supabaseAdmin.from('ai_estimates').insert({
    entity_type: 'template',
    entity_id: t.id,
    provider,
    model_code,
    assumptions: { profile: opts.profileCode ?? 'RICH' },
    input_tokens: est.input_tokens,
    output_tokens: est.output_tokens,
    images: est.images,
    minutes_audio: est.minutes_audio,
    estimated_cost_usd: est.estimated_cost_usd,
    breakdown: est.breakdown,
  });
  if (error) throw error;

  return est;
}

// Example usage in your existing seeder right after you insert the template:
// const template = await insertTemplate(...);
// await attachTemplateAiEstimate(template, { profileCode: 'RICH' });
