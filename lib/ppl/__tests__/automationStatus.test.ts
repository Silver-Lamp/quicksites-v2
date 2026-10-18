// lib/ppl/__tests__/automationStatus.test.ts — every pay-per-call email says which automations are OFF.
import fs from 'node:fs';
import path from 'node:path';
import { automationsOff, automationRemindersHtml, automationRemindersText } from '@/lib/ppl/automationStatus';
import { buildCallAlertEmail } from '@/lib/ppl/callAlert';

const ROOT = path.resolve(__dirname, '../../..');
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');

describe('automation reminders', () => {
  it('lists only what is off, with how to turn it on, and nothing when all is on', () => {
    const off = automationsOff({ PPL_ENABLED: '1' });
    expect(off.map((f) => f.key)).toEqual(['PPL_PITCH_AUTO_ENABLED', 'PPL_OUTCOME_SURVEY_ENABLED']);
    expect(automationRemindersHtml({ PPL_ENABLED: '1', PPL_PITCH_AUTO_ENABLED: 'true', PPL_OUTCOME_SURVEY_ENABLED: '1' })).toBe('');
    const t = automationRemindersText({});
    expect(t).toContain('Pitch cron (PPL_PITCH_AUTO_ENABLED)');
    expect(t).toContain('Set the flag to 1 in Vercel');
  });
  it('the inbound-call alert carries them when a flag is off', () => {
    const saved = { ...process.env };
    delete process.env.PPL_PITCH_AUTO_ENABLED; delete process.env.PPL_OUTCOME_SURVEY_ENABLED; delete process.env.PPL_ENABLED;
    try {
      const e = buildCallAlertEmail([{ id: 'x', from_number: '+12533451344', to_number: '+12535550100', custom_domain: 'vashon-plumbing.com', call_status: 'completed', call_duration: 200, created_at: '2026-10-17T21:53:00Z' } as any], 'https://www.quicksites.ai');
      expect(e.html).toContain('Automation off');
      expect(e.html).toContain('PPL_PITCH_AUTO_ENABLED');
      expect(e.text).toContain('Automation OFF');
    } finally { process.env = saved; }
  });
  it('every pitch-cron email carries them too', () => {
    const src = read('app/api/cron/ppl-pitch/route.ts');
    expect(src).toMatch(/automationRemindersHtml\(\)/);
  });
});
