/**
 * @jest-environment node
 *
 * THE TERMS PAGE MUST NOT CONTAIN A TYPED-IN NUMBER.
 *
 * ⚠️ `lib/commerce/partner-terms.ts` is what `createDraftOrder`, `markOrderPaid` and
 * `runPayouts` actually use. A percentage written by hand into the copy can drift from the money
 * with nothing failing — the page would keep promising 80% after the constant moved, and the
 * first person to notice would be a partner reading a smaller payout than the page they were
 * forwarded.
 *
 * This is the page partners FORWARD, so it is the worst place in the product for a stale figure.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { stripComments } from '@/test/stripComments';
import {
  MAX_PLATFORM_FEE_PERCENT,
  PARTNER_FEE_SHARE,
  QS_FEE_SHARE,
  DEFAULT_UPLINE_FEE_SHARE,
  AFFILIATE_FEE_SHARE,
  AFFILIATE_MAX_FEE_SHARE,
  REFUND_WINDOW_DAYS,
} from '@/lib/commerce/partner-terms';

const SRC = stripComments(
  readFileSync(join(process.cwd(), 'app/partners/terms/page.tsx'), 'utf8'),
);

describe('every figure comes from the source of truth', () => {
  it('has real content to check', () => {
    expect(SRC.length).toBeGreaterThan(2000);
    expect(SRC).toContain('PartnerTermsPage');
  });

  it('imports the constants rather than restating them', () => {
    for (const k of [
      'MAX_PLATFORM_FEE_PERCENT',
      'PARTNER_FEE_SHARE',
      'QS_FEE_SHARE',
      'REFUND_WINDOW_DAYS',
      'DEFAULT_UPLINE_FEE_SHARE',
      'AFFILIATE_FEE_SHARE',
      'AFFILIATE_MAX_FEE_SHARE',
    ]) {
      expect(SRC).toContain(k);
    }
  });

  it('never hardcodes a rate as a literal percentage', () => {
    // The exact strings a well-meaning edit would paste in.
    const literals = [
      `${Math.round(PARTNER_FEE_SHARE * 100)}%`,
      `${Math.round(QS_FEE_SHARE * 100)}%`,
      `${Math.round(MAX_PLATFORM_FEE_PERCENT * 100)}%`,
      `${Math.round(AFFILIATE_FEE_SHARE * 100)}%`,
      `${Math.round(AFFILIATE_MAX_FEE_SHARE * 100)}%`,
    ];
    for (const lit of literals) expect(SRC).not.toContain(lit);
  });

  it('never hardcodes the refund window as a number of days', () => {
    expect(SRC).not.toMatch(new RegExp(`${REFUND_WINDOW_DAYS}\\s*days`, 'i'));
  });

  it('does not restate the upline default as a literal', () => {
    expect(SRC).not.toContain(`${Math.round(DEFAULT_UPLINE_FEE_SHARE * 100)}%`);
  });
});

describe('it states mechanics, not traction', () => {
  it('makes no claim about how many partners exist or what they earn', () => {
    // Nothing has ever been paid out of commission_ledger. A page implying otherwise would be
    // the first false claim in the program's own terms.
    for (const phrase of [
      'our partners earn',
      'partners are earning',
      'average partner',
      'typical partner',
      'join hundreds',
      'join thousands',
    ]) {
      expect(SRC.toLowerCase()).not.toContain(phrase);
    }
  });

  it('does not promise a payout date the system does not keep', () => {
    // PARTNER_PAYOUTS_CRON_ENABLED is not set in production — payout runs are operator-started.
    for (const phrase of ['paid monthly', 'paid weekly', 'every month on', 'net 30', 'net-30']) {
      expect(SRC.toLowerCase()).not.toContain(phrase);
    }
    expect(SRC).toContain('payout run');
  });
});

describe('the constraints are part of the terms', () => {
  it('states the health/income claims boundary', () => {
    // We will build the store; the claims are the merchant's. Relevant the moment a partner
    // brings a supplement or peptide book.
    expect(SRC.toLowerCase()).toContain('health');
    expect(SRC.toLowerCase()).toContain('claims');
  });

  it('warns that some categories the processor prohibits cannot be onboarded', () => {
    expect(SRC.toLowerCase()).toContain('prohibit');
  });

  it("promises a rate change is never retroactive", () => {
    expect(SRC.toLowerCase()).toContain('retroactiv');
  });
});
