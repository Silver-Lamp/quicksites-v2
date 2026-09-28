/**
 * A BOUGHT NUMBER THE SITE DOES NOT SHOW PRODUCES NO CALLS.
 *
 * ⚠️ The failure this guards is silent and self-congratulating. Provisioning wires Twilio, saves
 * `forward_to` and texts the business — all returning success — while the page a caller sees
 * keeps advertising the old phone. `southhilltowing.com` (2026-09-28, the first real purchase)
 * went on showing (360) 458-2555 after +1 253 655 2016 was bought for it. The calls would have
 * gone somewhere untracked, the campaign would have read "0 calls", the market would have looked
 * dead — and Too Cool Towing, already texted that calls were coming, would have got none.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { stripComments } from '@/test/stripComments';
import { rewritePhoneFields, displayUs } from '../pushTrackingNumberToSite';

const read = (p: string) => stripComments(readFileSync(join(process.cwd(), p), 'utf8'));

describe('rewritePhoneFields', () => {
  it('rewrites every copy in the tree, not just the first', () => {
    // The same contact lives in meta, identity, and under both blocks[] and content_blocks[] in
    // both props and content (CLAUDE.md §8).
    const tree = {
      meta: { contact: { phone: '3604582555' }, identity: { contact: { phone: '3604582555' } } },
      identity: { contact: { phone: '3604582555' } },
      pages: [
        {
          blocks: [{ props: { cta_phone: '(360) 458-2555' }, content: { cta_phone: '(360) 458-2555' } }],
          content_blocks: [{ props: { cta_phone: '(360) 458-2555' }, content: { cta_phone: '(360) 458-2555' } }],
        },
      ],
    };
    const n = rewritePhoneFields(tree, '+12536552016', '(253) 655-2016');
    expect(n).toBe(7);
    expect(JSON.stringify(tree)).not.toContain('4582555');
  });

  it('keeps each field in the format it was already using', () => {
    const tree = { a: { phone: '3604582555' }, b: { cta_phone: '(360) 458-2555' } };
    rewritePhoneFields(tree, '+12536552016', '(253) 655-2016');
    expect((tree.a as any).phone).toBe('+12536552016');
    expect((tree.b as any).cta_phone).toBe('(253) 655-2016');
  });

  it('NEVER touches a phone-shaped string that is not a contact field', () => {
    // "serving 253 homes" is copy. Rewriting prose would quietly change what a site says.
    const tree = { headline: '253 555 0100 homes served', body: 'Call (360) 458-2555 today' };
    expect(rewritePhoneFields(tree, '+12536552016', '(253) 655-2016')).toBe(0);
    expect(tree.headline).toContain('253 555 0100');
    expect(tree.body).toContain('(360) 458-2555');
  });

  it('leaves a field that already holds the number alone', () => {
    const tree = { x: { phone: '+12536552016' } };
    expect(rewritePhoneFields(tree, '+12536552016', '(253) 655-2016')).toBe(0);
  });
});

describe('displayUs', () => {
  it('formats a US number and passes anything else through', () => {
    expect(displayUs('+12536552016')).toBe('(253) 655-2016');
    expect(displayUs('+442071234567')).toBe('+442071234567');
  });
});

describe('both routes that give a campaign a number push it to the site', () => {
  const PROVISION = read('app/api/admin/prospects/geo-campaign/provision-number/route.ts');
  const ATTACH = read('app/api/admin/prospects/geo-campaign/attach-number/route.ts');
  const LIB = read('lib/ppl/pushTrackingNumberToSite.ts');

  it.each([
    ['provision-number', PROVISION],
    ['attach-number', ATTACH],
  ])('%s calls pushTrackingNumberToSite', (_name, src) => {
    expect(src).toContain('pushTrackingNumberToSite');
  });

  it('pushes AFTER the number is saved on the campaign', () => {
    const i = PROVISION.indexOf('setCampaignTracking');
    const j = PROVISION.indexOf('pushTrackingNumberToSite({');
    expect(i).toBeGreaterThan(-1);
    expect(j).toBeGreaterThan(i);
  });

  it('never lets a site-push failure fail a completed purchase', () => {
    // The number is already bought by this point; a 500 here would report a spend as an error.
    expect(PROVISION).toMatch(/pushTrackingNumberToSite\(\{[\s\S]{0,400}?\}\)\s*\.catch\(/);
    expect(ATTACH).toMatch(/pushTrackingNumberToSite\(\{[\s\S]{0,400}?\}\)\s*\.catch\(/);
  });

  it('reports the outcome to the operator rather than swallowing it', () => {
    expect(PROVISION).toContain('site: sitePush');
  });

  it('sets the templates.phone column in the same patch as data', () => {
    // The hero falls back to the column when cta_phone is empty, so a data-only fix passes its
    // own audit and changes nothing on the page.
    expect(LIB).toMatch(/\{\s*data:\s*next,\s*phone:\s*digits\s*\}/);
  });

  it('only republishes what is already live', () => {
    // publish_template_demo would happily take an unpublished draft live as a side effect.
    expect(LIB).toContain('republishIfPublished');
  });
});
