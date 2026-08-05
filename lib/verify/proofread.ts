// lib/verify/proofread.ts
//
// A last read of the page before it goes live, by a model, for the class of defect no mechanical
// check can see.
//
// ⚠️ WHY THIS IS NOT PART OF THE RENDER GATE. The gate asserts on mechanics — is the copy present,
// is the disclosure above the control, does anything render at 2:1 contrast. It deliberately does
// not judge whether text is *right*, because that is a language question. Both are needed and they
// fail differently: the gate caught a footer nobody could read; it sailed past a published résumé
// that said "ginancial recovery system" and "workglows", because those are perfectly legible
// strings in perfectly good contrast. A PDF whose font maps the fi/fl ligatures to the letter "g"
// produces real words, corrupted, with nothing structural to flag.
//
// ⚠️ IT FLAGS. IT NEVER FIXES, AND IT NEVER DECIDES. Every finding is a CANDIDATE for a human,
// returned with the exact substring so a person can look at it. Letting a model rewrite the page
// would put invented text into someone's employment history — the precise thing the Verbatim
// parser refuses to do, reintroduced one layer up. Same boundary DeckSketch drew for the claims
// ledger: a claim-surfacer, never a truth-checker.
//
// ⚠️ AND IT IS ADVISORY, SO IT MUST NOT BECOME A GATE THAT BLOCKS. A model asked "is anything wrong
// here" will always find something; wired as a blocking check it would either be ignored or start
// costing real edits to satisfy. It returns findings; the caller decides.

import { meterLLMCall } from '@/lib/ai/meter';
import { getOpenAI, resolveModel } from '@/lib/ai/openaiClient';

export type ProofreadCategory =
  /** "ginancial", "workglows" — a real word corrupted by extraction. The one this was built for. */
  | 'garbled_text'
  /** "Lorem ipsum", "Share who you are…", "TODO" — authoring scaffolding left in. */
  | 'placeholder'
  /** "Point Seven Studio" vs "Point Seven Studios" on the same page. */
  | 'inconsistency'
  /** Instructions aimed at the site owner that a visitor should never read. */
  | 'editor_speak'
  /** An ordinary typo or broken grammar. */
  | 'typo';

export type ProofreadFinding = {
  category: ProofreadCategory;
  /** The exact text on the page, so a human can find it. Never a paraphrase. */
  quote: string;
  /** What it probably should say. A SUGGESTION — nothing applies it automatically. */
  suggestion: string;
  why: string;
  confidence: 'high' | 'medium' | 'low';
};

const SYSTEM = `You proofread web pages before they are published. The page may be a person's
résumé, a small business site, or a client's landing page.

Report only DEFECTS IN THE TEXT ITSELF. For each one give the exact quote from the page.

Look for, in priority order:
1. garbled_text — a real word corrupted by document extraction. PDF fonts often map the "fi" and
   "fl" ligatures to another letter, producing things like "ginancial" (financial), "workglows"
   (workflows), "girmware" (firmware), "Degined" (Defined). These read as nonsense words but sit
   inside otherwise fluent sentences. This is the most important category.
2. placeholder — authoring scaffolding that was never replaced: "Lorem ipsum", "Share who you are",
   "Your business name here", "TODO", "example.com".
3. editor_speak — instructions meant for the site's owner that a visitor should not see:
   "Record your voice", "No services configured", "Add a title here".
4. inconsistency — the same name, company or number written two different ways on one page.
5. typo — ordinary spelling or grammar errors.

Do NOT report: style preferences, tone, length, word choice, marketing effectiveness, whether a
claim is true, or anything you would phrase as "consider". Those are not defects.

If the page is clean, return an empty array. An empty result is a valid and expected answer.

Return JSON: {"findings":[{"category","quote","suggestion","why","confidence"}]}`;

/** Same string once punctuation, hyphens and spacing are normalised away? Then it is style. */
export function isStyleOnly(quote: string, suggestion: string): boolean {
  if (!suggestion) return false;
  const norm = (v: string) =>
    v.toLowerCase().replace(/[\s\-–—,;:.'"“”‘’()]/g, '');
  return norm(quote) === norm(suggestion);
}

const CATEGORIES: ProofreadCategory[] = [
  'garbled_text', 'placeholder', 'inconsistency', 'editor_speak', 'typo',
];

/**
 * Proofread the visible text of a page.
 *
 * `text` should be the RENDERED text — what a visitor actually reads — not the source or the block
 * JSON. Everything this repo has learned about verification points the same way: check the
 * artefact that reaches the person.
 */
export async function proofreadPage(
  text: string,
  opts: { userId?: string | null; templateId?: string | null; route?: string } = {},
): Promise<ProofreadFinding[]> {
  const trimmed = text.replace(/\s+/g, ' ').trim().slice(0, 24_000);
  if (trimmed.length < 40) return [];

  return meterLLMCall<ProofreadFinding[]>(
    {
      provider: 'openai',
      model_code: 'gpt-4o-mini',
      modality: 'chat',
      user_id: opts.userId ?? null,
      template_id: opts.templateId ?? null,
      route: opts.route ?? 'verify/proofread',
    },
    async () => {
      const r = await getOpenAI('chat').chat.completions.create({
        model: resolveModel('gpt-4o-mini', 'chat'),
        // Low temperature: this is a detection task, and a creative proofreader invents defects.
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: trimmed },
        ],
      });

      let parsed: any = {};
      try {
        parsed = JSON.parse(r.choices[0]?.message?.content || '{}');
      } catch {
        /* an unparseable response is no findings, never a crash on a publish path */
      }

      const findings: ProofreadFinding[] = Array.isArray(parsed?.findings)
        ? parsed.findings
            .map((f: any) => ({
              category: CATEGORIES.includes(f?.category) ? f.category : 'typo',
              quote: String(f?.quote ?? '').slice(0, 300),
              suggestion: String(f?.suggestion ?? '').slice(0, 300),
              why: String(f?.why ?? '').slice(0, 300),
              confidence: ['high', 'medium', 'low'].includes(f?.confidence) ? f.confidence : 'low',
            }))
            // ⚠️ A finding whose quote is not on the page is a hallucination, and dropping it here
            // is the cheapest possible guard. Without this the reviewer's own credibility depends
            // on the model never inventing — which is not a property it has.
            .filter((f: ProofreadFinding) => f.quote && trimmed.includes(f.quote))
            // ⚠️ AND STYLE IS NOT A DEFECT, WHATEVER THE PROMPT SAYS. Told plainly not to report
            // word choice, the first real run returned three findings and all three were style:
            // a serial comma, "front end" vs "frontend", "client-side-encrypted" vs "client-side
            // encrypted". An instruction is not a filter. This one is deterministic: if the quote
            // and the suggestion differ ONLY in punctuation, hyphenation or spacing, nothing is
            // wrong with the page. Left in, these teach the reader to skim the output, which is
            // exactly how a check stops being read at all.
            .filter((f: ProofreadFinding) => !isStyleOnly(f.quote, f.suggestion))
        : [];

      return {
        value: findings,
        usage: { input_tokens: r.usage?.prompt_tokens, output_tokens: r.usage?.completion_tokens },
      };
    },
  );
}
