import { isStyleOnly } from '../proofread';

/**
 * The style filter is the deterministic half of the proofreader, and it exists because an
 * instruction is not a filter: told plainly not to report word choice, the model's first real run
 * returned three findings and every one was style.
 */
describe('isStyleOnly', () => {
  it('drops a serial-comma suggestion', () => {
    expect(isStyleOnly('caching and cost guardrails', 'caching, and cost guardrails')).toBe(true);
  });

  it('drops a hyphenation suggestion', () => {
    expect(isStyleOnly('client-side-encrypted vault', 'client-side encrypted vault')).toBe(true);
    expect(isStyleOnly('React front end', 'React frontend')).toBe(true);
  });

  it('KEEPS a real correction — this is the half that must not over-filter', () => {
    // If normalising ever made these equal, the proofreader would silently discard the exact
    // defect it was built for.
    expect(isStyleOnly('ginancial', 'financial')).toBe(false);
    expect(isStyleOnly('workglows', 'workflows')).toBe(false);
    expect(isStyleOnly('girmware upload', 'firmware upload')).toBe(false);
    expect(isStyleOnly('Point Seven Studios', 'Point Seven Studio')).toBe(false);
  });

  it('keeps a finding with no suggestion rather than treating it as style', () => {
    expect(isStyleOnly('Record your voice', '')).toBe(false);
  });
});
