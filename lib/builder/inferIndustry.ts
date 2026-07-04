// lib/builder/inferIndustry.ts
//
// Guess a small business's industry from its name via a cheap metered chat call.
// Used at guest site-creation time (so the editor's "what kind of site" chooser is
// pre-answered) and as a fallback during autogenerate. Prefers a known industry
// label/key when one fits; otherwise returns a concise free-text label with key
// 'other'. Best-effort — returns null on any failure so callers fall back.
import OpenAI from 'openai';
import { meterLLMCall } from '@/lib/ai/meter';
import { KEY_TO_LABEL, LABEL_TO_KEY, type IndustryKey } from '@/lib/industries';

const ROUTE = '/api/templates/create';

export async function inferIndustry(
  businessName: string,
  ownerId: string | null,
): Promise<{ label: string; key: IndustryKey } | null> {
  const name = (businessName || '').trim();
  if (!name || name.toLowerCase() === 'my business') return null;

  const known = Object.values(KEY_TO_LABEL).join(', ');
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  try {
    const label = await meterLLMCall<string>(
      { provider: 'openai', model_code: 'gpt-4o-mini', modality: 'chat', user_id: ownerId, route: ROUTE },
      async () => {
        const r = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          temperature: 0.2,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content:
                `Infer the most likely industry for a small business from its name. ` +
                `Prefer one of these labels when it clearly fits: ${known}. ` +
                `Otherwise return a concise 1-3 word industry label. ` +
                `Return JSON: {"industry":"<label>"}.`,
            },
            { role: 'user', content: `Business name: "${name}"` },
          ],
        });
        let out = '';
        try { out = String(JSON.parse(r.choices[0]?.message?.content || '{}').industry || ''); } catch {}
        return { value: out.trim(), usage: { input_tokens: r.usage?.prompt_tokens, output_tokens: r.usage?.completion_tokens } };
      },
    );
    if (!label || label.toLowerCase() === 'other') return null;
    const key = (LABEL_TO_KEY[label.toLowerCase()] ?? 'other') as IndustryKey;
    return { label, key };
  } catch (e: any) {
    console.error('[inferIndustry] failed:', e?.message || e);
    return null;
  }
}
