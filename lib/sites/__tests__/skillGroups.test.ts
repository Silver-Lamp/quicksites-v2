import { CATCH_ALL_LABEL, groupSkills, shouldGroupSkills } from '../skillGroups';

const REAL_LIST = [
  'TypeScript', 'JavaScript', 'React', 'Next.js', 'Node.js', 'NestJS', 'Express', 'Python',
  'Ruby on Rails', 'Go', '.NET', 'Tailwind CSS', 'Storybook', 'Radix', 'Konva', 'three.js',
  'Zustand', 'TanStack Query', 'React Hook Form', 'AWS Lambda', 'API Gateway', 'CloudFront',
  'S3', 'CDK', 'Serverless Framework', 'DynamoDB', 'Docker', 'GitHub Actions', 'Azure', 'GCP',
  'PostgreSQL', 'Prisma', 'Supabase', 'MongoDB', 'Redis', 'Qdrant', 'OpenAI', 'Anthropic',
  'LangChain', 'Stripe', 'Jest', 'Playwright', 'Cypress', 'Underwater basket weaving',
];

describe('groupSkills — the invariant', () => {
  // ⚠️ The load-bearing test. A dropped skill edits someone's claim about themselves and does it
  // invisibly: the page still looks tidy and the owner has no way to notice.
  it('never loses a skill', () => {
    const groups = groupSkills(REAL_LIST);
    const out = groups.flatMap((g) => g.skills);
    expect(out).toHaveLength(REAL_LIST.length);
    expect([...out].sort()).toEqual([...REAL_LIST].sort());
  });

  it('puts an unrecognised skill in the catch-all rather than discarding it', () => {
    const groups = groupSkills(REAL_LIST);
    const also = groups.find((g) => g.label === CATCH_ALL_LABEL);
    expect(also?.skills).toContain('Underwater basket weaving');
  });

  it('keeps every input even when nothing matches any rule', () => {
    const groups = groupSkills(['Glassblowing', 'Falconry', 'Dowsing']);
    expect(groups.flatMap((g) => g.skills)).toHaveLength(3);
  });

  it('drops blanks and nullish entries, which are not claims', () => {
    expect(groupSkills(['React', '', '   ', null, undefined]).flatMap((g) => g.skills)).toEqual([
      'React',
    ]);
  });
});

describe('groupSkills — the grouping', () => {
  it('produces a scannable number of clusters, not forty', () => {
    const groups = groupSkills(REAL_LIST);
    expect(groups.length).toBeGreaterThanOrEqual(4);
    expect(groups.length).toBeLessThanOrEqual(9);
  });

  it('classifies by first match, so specific rules beat general ones', () => {
    const byLabel = Object.fromEntries(groupSkills(REAL_LIST).map((g) => [g.label, g.skills]));
    expect(byLabel['Frontend']).toEqual(expect.arrayContaining(['React', 'Tailwind CSS']));
    expect(byLabel['Cloud & Infra']).toEqual(expect.arrayContaining(['AWS Lambda', 'Docker']));
    expect(byLabel['Data']).toEqual(expect.arrayContaining(['PostgreSQL', 'Supabase']));
    expect(byLabel['AI & LLM']).toEqual(expect.arrayContaining(['OpenAI', 'Anthropic']));
  });

  it('preserves the owner ordering inside a group rather than alphabetising it', () => {
    const g = groupSkills(['Redis', 'PostgreSQL', 'MongoDB']).find((x) => x.label === 'Data');
    expect(g?.skills).toEqual(['Redis', 'PostgreSQL', 'MongoDB']);
  });

  it('folds a lone group into the catch-all instead of heading a group of one', () => {
    const groups = groupSkills(['Stripe', 'React', 'Next.js', 'Tailwind CSS']);
    expect(groups.find((g) => g.label === 'Payments & Commerce')).toBeUndefined();
    expect(groups.find((g) => g.label === CATCH_ALL_LABEL)?.skills).toContain('Stripe');
  });

  it('returns nothing for an empty list rather than an empty heading', () => {
    expect(groupSkills([])).toEqual([]);
  });
});

describe('shouldGroupSkills', () => {
  // A short list is already scannable; splitting it across headings makes it worse.
  it('leaves a short list alone', () => {
    expect(shouldGroupSkills(0)).toBe(false);
    expect(shouldGroupSkills(8)).toBe(false);
  });

  it('groups a wall', () => {
    expect(shouldGroupSkills(12)).toBe(true);
    expect(shouldGroupSkills(40)).toBe(true);
  });
});
