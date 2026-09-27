/**
 * @jest-environment node
 *
 * THE CALCULATOR ASKS FOR AN EMAIL; IT DOES NOT HOLD THE ANSWER HOSTAGE.
 *
 * `/partners/calculator` is the most qualified page on the marketing site — nobody models a
 * residual on a GMV they invented — and until now it produced a number, the visitor left, and we
 * learned nothing. The capture exists so the page can tell an interested reseller from a bounce.
 *
 * ⚠️ The pressure to gate it will come, and it is always reasonable-sounding ("they'll give us
 * the email if they want the number"). It must be refused: a gate measures how badly someone
 * wants back a figure they already earned, not whether the offer is good, and it corrupts the
 * one signal this page produces. Same rule as the `cook_intent` probe — a door that lies
 * measures how many people believe the door.
 *
 * These are source guards. No unit test can see that a result got hidden behind a form.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { stripComments } from '@/test/stripComments';

const root = process.cwd();
const read = (p: string) => stripComments(readFileSync(join(root, p), 'utf8'));

const FORM = read('components/partners/calculator-email-capture.tsx');
const PAGE = read('app/partners/calculator/page.tsx');
const ROUTE = read('app/api/partners/lead/route.ts');

describe('the stripper left real code', () => {
  it('has content to match against', () => {
    expect(FORM).toContain('CalculatorEmailCapture');
    expect(PAGE).toContain('gmvPerMerchant');
    expect(ROUTE).toContain('partner_lead');
  });
});

describe('it asks, it does not gate', () => {
  it('renders the capture AFTER the results, not in place of them', () => {
    // The results block must still be unconditional markup in the page.
    expect(PAGE).toContain('QuickSites — residual on GMV');
    expect(PAGE).toContain('<CalculatorEmailCapture');
    expect(PAGE.indexOf('QuickSites — residual on GMV')).toBeLessThan(
      PAGE.indexOf('<CalculatorEmailCapture'),
    );
  });

  it('never conditions the results on an email having been submitted', () => {
    // A `submitted &&` / `email ?` wrapper around the numbers is exactly the regression.
    expect(PAGE).not.toMatch(/(submitted|hasEmail|unlocked)\s*(&&|\?)/);
  });

  it('does not obscure the results instead of hiding them', () => {
    // ⚠️ Blurring the number and laying a form over it is gating with extra steps — so this
    // looks for that, but ONLY inside the results block.
    //
    // Scoping is the whole point. A page-wide grep for these idioms flagged, in two successive
    // runs, the decorative `blur-3xl` glow and an `aria-hidden … pointer-events-none` backdrop
    // layer at the top of this very page. Both are correct code. A check that fires on correct
    // code is worse than no check: it teaches you to skip the output — the same lesson as the
    // `[^/-]` guards in CLAUDE.md §7. The fix is a narrower target, never a longer allowlist.
    const start = PAGE.indexOf('QuickSites — residual on GMV');
    const end = PAGE.indexOf('<CalculatorEmailCapture');
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const results = PAGE.slice(start, end);
    expect(results).not.toMatch(/pointer-events-none/);
    expect(results).not.toMatch(/select-none/);
    expect(results).not.toMatch(/blur-(sm|md|lg|xl)\b/);
  });
});

describe('the route is a public write, so it behaves like one', () => {
  it('is rate limited per IP', () => {
    expect(ROUTE).toContain('rateLimitOr429');
  });

  it('validates the email before any service-role write', () => {
    expect(ROUTE).toMatch(/EMAIL_RE\.test/);
    const emailCheck = ROUTE.indexOf('EMAIL_RE.test');
    const firstWrite = ROUTE.indexOf(".from('leads')");
    expect(emailCheck).toBeGreaterThan(-1);
    expect(emailCheck).toBeLessThan(firstWrite);
  });

  it('is idempotent per email for this source', () => {
    // A visitor re-running the calculator must not mint a second lead — duplicates would
    // overstate the only demand signal the page has.
    expect(ROUTE).toContain("eq('source', 'partner_calculator')");
  });

  it('does not leak a Postgres message to a public caller', () => {
    expect(ROUTE).not.toMatch(/error:\s*error\.message/);
  });

  it('bounds free text before storing it', () => {
    expect(ROUTE).toContain('cleanText');
    expect(ROUTE).toMatch(/slice\(0,\s*max\)/);
  });
});

describe('the modelled numbers travel with the lead', () => {
  it('sends what the visitor modelled, not just an address', () => {
    expect(FORM).toMatch(/merchants,\s*avgGmv,\s*monthly/);
    expect(ROUTE).toContain('avg monthly GMV each');
  });

  it('shows the visitor what was captured', () => {
    // Collected in the open, never invisibly.
    expect(FORM).toContain('Saved against');
  });
});
