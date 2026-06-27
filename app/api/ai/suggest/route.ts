// app/api/ai/suggest/route.ts
import OpenAI from 'openai';
import { meterLLMCall, LLMBudgetExceededError } from '@/lib/ai/meter';

export const runtime = 'nodejs';

type SiteSummary = {
  businessName?: string;
  phone?: string;
  industry?: string;
  city?: string;
  state?: string;
  cityState?: string; // kept for back-compat
  pages?: Array<{ slug?: string; title?: string }>;
  services?: string[];
};

export async function POST(req: Request) {
  try {
    const { instruction, selection, brief, site, temperature = 0.7 } = (await req.json()) as {
      instruction: string;
      selection?: string;
      brief?: string;
      site?: SiteSummary;
      temperature?: number;
    };

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const messages = [
      {
        role: 'system',
        content:
          "You are QuickSites' copy assistant for local service businesses. Return clean HTML only (no code fences/markdown). " +
          "Prefer <p>, <h2>, <h3>, <ul><li>, <strong>. Keep copy scannable; favor clarity and local specificity."
      },
      {
        role: 'user',
        content: JSON.stringify(
          {
            instruction,
            selection,
            brief,
            site: {
              businessName: site?.businessName,
              phone: site?.phone,
              industry: site?.industry,
              city: site?.city,
              state: site?.state,
              cityState: site?.cityState,
              services: site?.services,
              pages: site?.pages,
            },
          },
          null,
          2
        ),
      },
    ];

    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

    // Metered call: budget guard (pre) + cost logging + PostHog mirror (post).
    // To enable per-user caps, resolve the session here and pass `user_id`.
    const html = await meterLLMCall(
      { provider: 'openai', model_code: model, modality: 'chat', route: '/api/ai/suggest' },
      async () => {
        const resp = await client.chat.completions.create({
          model,
          temperature,
          messages: messages as any,
        });
        return {
          value: resp.choices?.[0]?.message?.content?.trim() || '',
          usage: {
            input_tokens: resp.usage?.prompt_tokens,
            output_tokens: resp.usage?.completion_tokens,
          },
        };
      }
    );

    return Response.json({ html });
  } catch (err: any) {
    if (err instanceof LLMBudgetExceededError) {
      console.warn('[ai/suggest] budget exceeded', err.message);
      return new Response(JSON.stringify({ error: 'AI usage limit reached. Try again later.' }), {
        status: 429,
      });
    }
    console.error('[ai/suggest] error', err);
    return new Response(JSON.stringify({ error: err?.message || 'AI error' }), { status: 500 });
  }
}
