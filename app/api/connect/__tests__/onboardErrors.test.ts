/** @jest-environment node */
//
// Stripe errors are not all the same kind of thing. "You can only create new accounts if you've
// signed up for Connect" is about OUR platform account — a merchant cannot act on it, does not
// own that dashboard, and telling them to go sign up sends them to configure a Stripe account
// that isn't theirs. The route must separate faults that are ours from faults that are theirs.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const route = readFileSync(join(process.cwd(), 'app/api/connect/onboard/route.ts'), 'utf8');
const code = route.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');

describe('onboarding errors are routed to whoever can act on them', () => {
  it('detects the platform-not-signed-up family', () => {
    const m = code.match(/const isPlatformSetup =\s*([\s\S]*?);/);
    expect(m).toBeTruthy();
    const rx = m![1];
    expect(rx).toMatch(/signed up for Connect/);
    expect(rx).toMatch(/only Stripe platforms|platform profile/);
  });

  it('tells the merchant it is not their fault and not their retry', () => {
    expect(code).toMatch(/that’s on us, not you|that's on us, not you/);
    expect(code).toMatch(/nothing to retry/i);
  });

  it('puts the actionable link behind operatorAction, not in the merchant message', () => {
    const merchantMsgBlock = code.slice(code.indexOf('isPlatformSetup'), code.indexOf('operatorAction'));
    expect(merchantMsgBlock).not.toMatch(/dashboard\.stripe\.com/);
    expect(code).toMatch(/operatorAction:\s*\{/);
  });

  it('uses a 503 for our outage, not a 4xx that blames the caller', () => {
    const i = code.indexOf('if (isPlatformSetup)');
    expect(code.slice(i, i + 900)).toMatch(/status:\s*503/);
  });
});

describe('the Express account is pre-filled from what we already know', () => {
  it('passes email and business profile rather than an empty account', () => {
    expect(code).toMatch(/prefill\.email = gate\.user\.email/);
    expect(code).toMatch(/business_profile/);
    expect(code).toMatch(/stripe\.accounts\.create\(prefill\)/);
  });

  it('omits fields it does not have instead of sending blanks', () => {
    expect(code).toMatch(/businessName \? \{ name: businessName \} : \{\}/);
    expect(code).toMatch(/siteUrl \? \{ url: siteUrl \} : \{\}/);
  });
});
