// Pins the one string this button exists to hand over.
import fs from 'node:fs';
import path from 'node:path';
import { reRecordCommand } from '@/app/admin/demo-narration/narration-studio';

/** Scenario names the recorder actually accepts, read from its source. */
function recorderScenarios(): string[] {
  const src = fs.readFileSync(path.resolve(__dirname, '../../../scripts/record-demo.mts'), 'utf8');
  return [...src.matchAll(/^\s{4}name: '([a-z0-9-]+)',$/gm)].map((m) => m[1]);
}

describe('reRecordCommand', () => {
  it('records AND publishes', () => {
    // ⚠️ Recording alone writes files to demo-videos/ and changes nothing anyone can see — the
    // studio would still say "no cue manifest" after a command that appeared to succeed.
    const cmd = reRecordCommand('guest-build');
    expect(cmd).toContain('scripts/record-demo.mts guest-build');
    expect(cmd).toContain('scripts/upload-demo-videos.mts --apply');
    expect(cmd).toContain('&&');
    expect(cmd.indexOf('record-demo')).toBeLessThan(cmd.indexOf('upload-demo-videos'));
  });

  // ⚠️ The real failure mode is a command naming a scenario the recorder does not know: it
  // copies cleanly, pastes cleanly, and dies at the shell. Cross-checked against the recorder's
  // own source rather than a hand-kept list that drifts.
  it('every clip we offer is a scenario the recorder knows', () => {
    const scenarios = recorderScenarios();
    expect(scenarios.length).toBeGreaterThan(0); // a regex matching nothing would pass vacuously
    for (const c of scenarios) {
      expect(reRecordCommand(c)).toContain(`record-demo.mts ${c} `);
    }
    // The three clips published today are all real scenarios.
    for (const c of ['guest-build', 'editor-tour', 'finished-site']) {
      expect(scenarios).toContain(c);
    }
  });
});
