/** @jest-environment node */
// Rule 7's own behaviour, pinned. The check must never become the thing that breaks boot,
// and it must never be able to leak a value — both are properties, not opinions.
import { CONFIG_GATES, evaluateGate, configHealth, bootReportLines } from '@/lib/config/health';

describe('config gates', () => {
  it('declares a unique key, a label and a "what breaks" for every gate', () => {
    const keys = CONFIG_GATES.map((g) => g.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const g of CONFIG_GATES) {
      expect(g.label.length).toBeGreaterThan(3);
      // Rule 3: prose readable at 3am. A stub here makes the boot log unactionable.
      expect(g.breaks.trim().length).toBeGreaterThan(40);
    }
  });

  it('reports a flag-gated feature as "off" rather than "incomplete" when disabled', () => {
    const g = CONFIG_GATES.find((x) => x.enabledBy === 'PARTNER_AUDIO_PROVISIONING_ENABLED')!;
    const prev = process.env.PARTNER_AUDIO_PROVISIONING_ENABLED;
    delete process.env.PARTNER_AUDIO_PROVISIONING_ENABLED;
    expect(evaluateGate(g).status).toBe('off');
    if (prev !== undefined) process.env.PARTNER_AUDIO_PROVISIONING_ENABLED = prev;
  });

  it('reports enabled-but-missing-keys as "incomplete" — the failure that keeps happening', () => {
    const g = CONFIG_GATES.find((x) => x.enabledBy === 'PARTNER_AUDIO_PROVISIONING_ENABLED')!;
    const prevFlag = process.env.PARTNER_AUDIO_PROVISIONING_ENABLED;
    const prevKey = process.env.PARTNER_GRANT_ENC_KEY;
    process.env.PARTNER_AUDIO_PROVISIONING_ENABLED = '1';
    delete process.env.PARTNER_GRANT_ENC_KEY;
    const r = evaluateGate(g);
    expect(r.status).toBe('incomplete');
    expect(r.missing).toContain('PARTNER_GRANT_ENC_KEY');
    if (prevFlag === undefined) delete process.env.PARTNER_AUDIO_PROVISIONING_ENABLED; else process.env.PARTNER_AUDIO_PROVISIONING_ENABLED = prevFlag;
    if (prevKey !== undefined) process.env.PARTNER_GRANT_ENC_KEY = prevKey;
  });

  it('never puts an env VALUE in the report — only names', () => {
    const secret = 'super-secret-value-do-not-leak';
    const prev = process.env.PARTNER_QUICKSITES_SECRET;
    process.env.PARTNER_QUICKSITES_SECRET = secret;
    const serialized = JSON.stringify(configHealth()) + bootReportLines().join('\n');
    expect(serialized).not.toContain(secret);
    if (prev === undefined) delete process.env.PARTNER_QUICKSITES_SECRET; else process.env.PARTNER_QUICKSITES_SECRET = prev;
  });

  it('never throws, whatever the environment looks like', () => {
    expect(() => configHealth()).not.toThrow();
    expect(() => bootReportLines()).not.toThrow();
  });
});
