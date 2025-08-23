import OpenAI from 'openai';

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

    const resp = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature,
      messages: messages as any,
    });

    const html = resp.choices?.[0]?.message?.content?.trim() || '';
    return Response.json({ html });
  } catch (err: any) {
    console.error('[ai/suggest] error', err);
    return new Response(JSON.stringify({ error: err?.message || 'AI error' }), { status: 500 });
  }
}
