/**
 * @jest-environment node
 */
// Lob refuses `to.name` over 40 characters. A business name is data we do not control.
import { readFileSync } from 'node:fs';
import { clampLobField, LOB_LIMITS } from '../mail/lob';

describe('clampLobField', () => {
  it('the name that failed the night before the first real send', () => {
    const name = 'Ferry Street Towing & Roadside Assistance';
    expect(name.length).toBe(41);
    const out = clampLobField(name, LOB_LIMITS.name);
    expect(out.length).toBeLessThanOrEqual(40);
    expect(out).toBe('Ferry Street Towing & Roadside'); // word boundary, and the mailpiece still lands
  });
  it('leaves a short name untouched and collapses stray whitespace', () => {
    expect(clampLobField("Osborne's Towing", 40)).toBe("Osborne's Towing");
    expect(clampLobField('  Two   Spaces  ', 40)).toBe('Two Spaces');
  });
  it('never ends on a dangling connector and never returns empty', () => {
    expect(clampLobField('Alpha Beta Gamma Delta Epsilon Zeta & Eta', 38)).not.toMatch(/[&,\-\s]$/);
    expect(clampLobField('Supercalifragilisticexpialidociously-Long-Single-Token', 20).length).toBe(20);
    expect(clampLobField('', 40)).toBe('');
  });
  it('fits every clamped value within its limit', () => {
    const long = 'x'.repeat(300) + ' tail';
    expect(clampLobField(long, LOB_LIMITS.name).length).toBeLessThanOrEqual(LOB_LIMITS.name);
    expect(clampLobField(long, LOB_LIMITS.addressLine).length).toBeLessThanOrEqual(LOB_LIMITS.addressLine);
    expect(clampLobField(long, LOB_LIMITS.description).length).toBeLessThanOrEqual(LOB_LIMITS.description);
  });
});

describe('a test key never counts as a real send', () => {
  const saved = process.env.LOB_API_KEY;
  afterEach(() => { if (saved === undefined) delete process.env.LOB_API_KEY; else process.env.LOB_API_KEY = saved; });
  it('recognises Lob key prefixes', async () => {
    const { lobKeyIsTest } = await import('../mail/lob');
    process.env.LOB_API_KEY = 'test_abc';
    expect(lobKeyIsTest()).toBe(true);
    process.env.LOB_API_KEY = 'live_abc';
    expect(lobKeyIsTest()).toBe(false);
    delete process.env.LOB_API_KEY;
    expect(lobKeyIsTest()).toBe(false);
  });
  it('the send loop refuses a real send on a test key, before any Lob call, and lets a test card through', () => {
    const src = readFileSync('lib/outreach/claimPostcardSend.ts', 'utf8');
    const guard = src.indexOf("if (!opts.test && lobKeyIsTest()) return { ...report, reason: 'lob_test_key' }");
    const loop = src.indexOf('for (const d of opts.drafts)');
    expect(guard).toBeGreaterThan(0);
    expect(guard).toBeLessThan(loop);
  });
});

describe('sendPostcard clamps at the request builder, not upstream', () => {
  const src = readFileSync('lib/outreach/mail/lob.ts', 'utf8');
  it('to[name], from[name], both address_line1 and description go through clampLobField', () => {
    expect(src).toMatch(/form\.set\('to\[name\]', clampLobField\(opts\.to\.name, LOB_LIMITS\.name\)\)/);
    expect(src).toMatch(/form\.set\('from\[name\]', clampLobField\(from\.name, LOB_LIMITS\.name\)\)/);
    expect(src).toMatch(/form\.set\('to\[address_line1\]', clampLobField\(opts\.to\.line1, LOB_LIMITS\.addressLine\)\)/);
    expect(src).toMatch(/form\.set\('description', clampLobField\(/);
  });
});
