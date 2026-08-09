// lib/sites/skillGroups.ts
//
// Group a flat list of skills into a handful of labelled clusters, so a résumé's ~40-item wall
// becomes something a hiring manager can scan in three seconds.
//
// ⚠️ NOTHING IS EVER DROPPED. This is the one rule that makes the feature safe. A skill list is a
// person's claim about what they can do; silently omitting an unrecognised entry edits that claim,
// and it fails invisibly — the page still looks tidy, the owner has no way to notice, and the
// missing item is the unusual one that made them interesting. Anything the classifier does not
// recognise lands in a final "Also" group. `groupSkills` asserts its own output length against its
// input for exactly this reason, and the test suite checks it.
//
// ⚠️ AND GROUPING IS OURS, NOT THEIRS. Deciding that "Go" belongs under Backend is our inference.
// That is acceptable because it is presentation — the words are still theirs, unaltered, and the
// grouping asserts nothing about them that the list did not already say. The line we do not cross
// is inventing a skill, rewording one, or losing one. (Same boundary as lib/rebuild/importResume.ts:
// rearranging what someone wrote is fine, adding to it is not.)

export type SkillGroup = { label: string; skills: string[] };

/**
 * Ordered rules. First match wins, so more specific patterns must come first — `react-three-fiber`
 * has to be tested before a bare `react`.
 */
const RULES: { label: string; test: RegExp }[] = [
  {
    label: 'Frontend',
    test: /^(react|next\.?js|tailwind|storybook|radix|shadcn|konva|three\.?js|react-three|vue|svelte|css|html|responsive|design systems?|ui|zustand|tanstack|react hook form|framer)/i,
  },
  {
    label: 'Backend',
    test: /^(node|nest|express|python|ruby|rails|go\b|golang|\.net|c#|java|php|rust|graphql|rest|api|django|flask|fastapi)/i,
  },
  {
    label: 'Cloud & Infra',
    test: /^(aws|lambda|api gateway|cloudfront|s3|cdk|serverless|ecs|fargate|kinesis|sqs|azure|gcp|google cloud|vercel|railway|docker|kubernetes|k8s|terraform|github actions|ci\/cd|nginx)/i,
  },
  {
    label: 'Data',
    test: /^(postgres|postgresql|mysql|sql|prisma|supabase|dynamodb|mongo|redis|qdrant|vector|row-level security|rls|bigquery|snowflake|elasticsearch)/i,
  },
  {
    label: 'AI & LLM',
    test: /^(openai|anthropic|claude|gpt|llm|langchain|replicate|embedding|retrieval|rag|vision|prompt|cost metering)/i,
  },
  {
    label: 'Testing & Quality',
    test: /^(jest|playwright|cypress|vitest|testing|visual regression|contrast|accessibility|a11y|lighthouse|storybook tests)/i,
  },
  {
    label: 'Payments & Commerce',
    test: /^(stripe|paypal|braintree|checkout|connect|billing|subscriptions?|marketplace)/i,
  },
  {
    label: 'Languages',
    test: /^(typescript|javascript|kotlin|swift|scala|elixir|perl|bash|shell)/i,
  },
];

/** Where anything unrecognised goes. Never a discard. */
export const CATCH_ALL_LABEL = 'Also';

/** Smallest cluster worth its own heading; below this, fold into the catch-all. */
const MIN_GROUP = 2;

function labelFor(skill: string): string {
  const s = skill.trim();
  for (const r of RULES) if (r.test.test(s)) return r.label;
  return CATCH_ALL_LABEL;
}

/**
 * Group skills, preserving every input.
 *
 * Order within a group is the owner's order — the list they wrote is a priority statement, and
 * alphabetising it would quietly overrule them.
 */
export function groupSkills(skills: (string | null | undefined)[]): SkillGroup[] {
  const clean = skills
    .map((s) => (typeof s === 'string' ? s.trim() : ''))
    .filter((s): s is string => !!s);

  const buckets = new Map<string, string[]>();
  for (const s of clean) {
    const label = labelFor(s);
    const list = buckets.get(label) ?? [];
    list.push(s);
    buckets.set(label, list);
  }

  // Groups in RULES order, catch-all last — a stable reading order regardless of input order.
  const ordered: SkillGroup[] = [];
  const overflow: string[] = [];
  for (const r of RULES) {
    const list = buckets.get(r.label);
    if (!list?.length) continue;
    // A group of one is a heading with nothing under it; the skill still ships, in the catch-all.
    if (list.length < MIN_GROUP) overflow.push(...list);
    else ordered.push({ label: r.label, skills: list });
  }
  const rest = [...(buckets.get(CATCH_ALL_LABEL) ?? []), ...overflow];
  if (rest.length) ordered.push({ label: CATCH_ALL_LABEL, skills: rest });

  // ⚠️ The invariant, asserted rather than assumed. If a future rule change starts losing skills,
  // this fails loudly here instead of quietly on someone's résumé.
  const out = ordered.reduce((n, g) => n + g.skills.length, 0);
  if (out !== clean.length) {
    throw new Error(`groupSkills dropped skills: ${clean.length} in, ${out} out`);
  }

  return ordered;
}

/**
 * Is grouping worth doing at all?
 *
 * ⚠️ A SHORT LIST IS ALREADY SCANNABLE, and splitting eight skills across five headings makes it
 * harder to read, not easier. The feature exists for the 40-item wall; below that it is noise.
 */
export function shouldGroupSkills(count: number): boolean {
  return count >= 12;
}
