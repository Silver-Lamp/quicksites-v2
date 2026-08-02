/**
 * @jest-environment node
 */
// The estimate is shown to someone deciding whether to move production workloads, and the site
// promises "if it is not a fit, I tell you." These tests pin the properties that keep that
// promise — asserted against the source, since the behaviour lives in a prompt and a parser.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const est = readFileSync(join(process.cwd(), 'lib/billing/estimateSavings.ts'), 'utf8');
const route = readFileSync(join(process.cwd(), 'app/api/billing/estimate/route.ts'), 'utf8');
const migration = readFileSync(
  join(process.cwd(), 'supabase/migrations/20260814_bill_estimates.sql'),
  'utf8',
);
const strip = (s: string) =>
  s.split('\n').filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*') && !l.trim().startsWith('--')).join('\n');

describe('the estimate is a range, never a number', () => {
  it('the prompt forbids a single percentage', () => {
    expect(est).toMatch(/NEVER return a single percentage/);
  });

  // ⚠️ A model can obey "always a range" by returning 34–34. That satisfies the letter and
  // breaks the point, and the UI would render it as a promise.
  it('widens a zero-width range rather than trusting it', () => {
    const code = strip(est);
    expect(code).toMatch(/high - low < 5/);
    expect(code).toMatch(/low = Math\.max\(0, low - 5\)/);
  });

  it('orders the bounds even if the model returns them backwards', () => {
    expect(strip(est)).toMatch(/if \(high < low\) \[low, high\] = \[high, low\]/);
  });
});

describe('the honest "no" is reachable and is the default', () => {
  it('instructs the model that "do not switch" is a welcome answer', () => {
    expect(est).toMatch(/recommendSwitch=false/);
    expect(est).toMatch(/expected and welcome/);
  });

  // A garbled or absent field must not read as a green light on someone's migration.
  it('defaults recommendSwitch to false', () => {
    expect(strip(est)).toMatch(/recommendSwitch: parsed\.recommendSwitch === true/);
  });

  it('does not let the model quote a provider or a competitor discount', () => {
    expect(est).toMatch(/Do not name a provider or quote a competitor discount/);
  });
});

describe('only redacted text is ever stored', () => {
  it('the route re-redacts server-side before storing', () => {
    const code = strip(route);
    expect(code).toMatch(/const findings = findIdentifiers\(submitted\)/);
    expect(code).toMatch(/const redacted = redact\(submitted, findings\)/);
    // The stored column gets the redacted value, never the submitted one.
    expect(code).toMatch(/redacted_text: redacted/);
    expect(code).not.toMatch(/redacted_text: submitted/);
  });

  it('stores counts of what was struck, never the values', () => {
    expect(strip(route)).toMatch(/redaction_counts: counts/);
    const countsLine = strip(route).match(/const counts = .*/)?.[0] ?? '';
    expect(countsLine).toContain('summarise(');
  });

  it('the table has no raw-text column, by design', () => {
    expect(migration).toMatch(/redacted_text\s+text not null/);
    expect(migration).not.toMatch(/raw_text|original_text|source_text/);
  });

  it('the table is deny-default RLS', () => {
    expect(migration).toMatch(/enable row level security/i);
    expect(migration).toMatch(/using \(false\)/);
  });
});

describe('the endpoint cannot quietly spend money', () => {
  it('is behind a flag that is off unless explicitly set', () => {
    expect(strip(route)).toMatch(/BILL_ESTIMATE_ENABLED !== '1'/);
  });

  it('rate limits per IP', () => {
    expect(strip(route)).toMatch(/checkRateLimit\(\s*`bill_estimate:\$\{ip\}`/);
  });

  it('meters the model call like every other inference in the codebase', () => {
    expect(strip(est)).toMatch(/meterLLMCall</);
  });
});

describe('a failed write never costs the person their estimate', () => {
  it('swallows the insert error rather than returning one', () => {
    // They did the work of uploading and reviewing; our storage problem is not their problem.
    expect(strip(route)).toMatch(/\(\) => \{\},\s*\/\/ a failed write|\(\) => \{\},\s*\)/);
    expect(route).toMatch(/a failed write must not deny the person their estimate/);
  });
});
