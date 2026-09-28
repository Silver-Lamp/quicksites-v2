/**
 * @jest-environment node
 *
 * A RETURNED POSTCARD IS TWO DIFFERENT FACTS AND ONLY ONE IS ABOUT THE POSTCARD.
 *
 * ⚠️ "wrong address" is a mailing problem — fix it and send again. "out of business" is a
 * PROSPECT problem: every future sweep, build, postcard and forward-to should stop considering
 * them. Recording only the mailing means the nightly pipeline rebuilds a site for a closed
 * business next week and the operator marks the next returned card the same way, forever.
 *
 * `postcard_mailings.returned_at` existed from the start and nothing could write it — the Lob
 * webhook was never registered, and a physical return is not something a webhook reports.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { stripComments } from '@/test/stripComments';
import {
  RETURN_REASONS,
  isReturnReason,
  isTerminal,
  isResendable,
} from '@/lib/outreach/mail/returns';
import { computeCardResponse } from '@/lib/outreach/cardResponse';

const read = (p: string) => stripComments(readFileSync(join(process.cwd(), p), 'utf8'));

describe('reasons', () => {
  it('rejects anything not on the allowlist', () => {
    // The reason drives a branch (terminal → closes a prospect); free text would let a typo
    // silently skip that.
    expect(isReturnReason('out_of_business')).toBe(true);
    expect(isReturnReason('gone')).toBe(false);
    expect(isReturnReason('')).toBe(false);
  });

  it('treats refused as terminal, not merely undeliverable', () => {
    // They exist and said no. Resending is mail someone actively declined.
    expect(isTerminal('refused')).toBe(true);
    expect(isResendable('refused')).toBe(false);
  });

  it('treats a bad or stale address as fixable', () => {
    expect(isResendable('bad_address')).toBe(true);
    expect(isResendable('moved')).toBe(true);
    expect(isTerminal('bad_address')).toBe(false);
  });

  it('does NOT treat "vacant" as resendable or terminal', () => {
    // Address exists, nobody there. Probably gone — but the operator has not confirmed it, and
    // guessing either way spends money or discards a lead on an assumption.
    expect(isTerminal('vacant')).toBe(false);
    expect(isResendable('vacant')).toBe(false);
  });

  it('every reason is decidable', () => {
    for (const r of RETURN_REASONS) {
      expect(typeof isTerminal(r)).toBe('boolean');
      expect(typeof isResendable(r)).toBe('boolean');
    }
  });
});

describe('a returned card did not arrive', () => {
  const prospects = [{ id: 'p1', city: 'Renton', region: 'WA', claim_link_visits: 0, claim_link_visited_at: null, claimed_at: null }] as any;
  const base = {
    prospect_id: 'p1',
    status: 'created',
    created_at: '2026-09-01T00:00:00Z',
    expected_delivery_date: '2026-09-05',
    delivered_at: null,
    returned_at: null,
  };

  it('counts as arrived when the date has passed and it did not come back', () => {
    const r = computeCardResponse([base] as any, prospects, '2026-09-10');
    expect(r.arrived).toBe(1);
  });

  it('does NOT count as arrived once it is marked returned', () => {
    // ⚠️ The regression this fixes: `arrived` was purely "expected delivery date has passed", so
    // a card sitting in the operator's hands marked Return To Sender still inflated the
    // denominator the scan rate is measured against.
    const r = computeCardResponse(
      [{ ...base, returned_at: '2026-09-08T00:00:00Z' }] as any,
      prospects,
      '2026-09-10',
    );
    expect(r.arrived).toBe(0);
    expect(r.returned).toBe(1);
    expect(r.mailed).toBe(1); // still mailed — the postage was spent
  });
});

describe('closing a prospect actually stops the spend', () => {
  it('the mailer skips closed prospects', () => {
    // Without this the operator marks a card returned, the record is perfect, and the next run
    // posts another one to the same dead address.
    expect(read('lib/outreach/claimPostcardSend.ts')).toMatch(/\.is\('closed_at',\s*null\)/);
  });

  it('the nightly build pipeline skips closed prospects', () => {
    const src = read('lib/tradeSites/pipeline.ts');
    expect(src).toMatch(/if \(p\.closed_at\) return false/);
  });

  it('closing does not overload `status`', () => {
    // status records how far they got; a business can close at any point in it, and reusing it
    // would silently change every existing .eq('status', …) filter.
    const src = read('lib/outreach/mail/returns.ts');
    const fn = src.slice(src.indexOf('export async function closeProspect'));
    expect(fn).not.toMatch(/status:/);
    expect(fn).toMatch(/closed_at/);
  });

  it('a re-send clears postcard_sent_at, not just the address', () => {
    // selectMailableDrafts filters on .is('postcard_sent_at', null) — updating the address
    // alone changes the record and mails nothing.
    const src = read('lib/outreach/mail/returns.ts');
    const fn = src.slice(src.indexOf('export async function requeueWithAddress'));
    expect(fn).toMatch(/postcard_sent_at:\s*null/);
    expect(fn).toMatch(/address,/);
  });
});
