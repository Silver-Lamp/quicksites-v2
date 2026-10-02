// The two-source chooser: what may be published as the owner's voice, and what may not.

import fs from 'node:fs';
import path from 'node:path';
import { stripComments } from '@/test/stripComments';

const repo = path.resolve(__dirname, '../../..');
const read = (rel: string) => stripComments(fs.readFileSync(path.join(repo, rel), 'utf8'));

describe('publish route — the enforcement point', () => {
  const src = read('app/api/admin/demo-narration/publish/route.ts');

  // ⚠️ THE RULE THE WHOLE FEATURE TURNS ON. A synthesised mix may go out as the owner's voice
  // only when HiveJournal reported `self`. `narrator` is the house voice; an absent basis is
  // unknown. Publishing either as his own is the mislabelling the audio-honesty standard
  // exists to prevent.
  it('refuses a synthesised mix unless the basis is exactly self', () => {
    expect(src).toContain("source === 'tts' && voiceBasis !== 'self'");
    expect(src).toContain('voice_basis_not_self');
  });

  // ⚠️ A UI warning is not an enforcement point — the admin page can be bypassed by a direct
  // POST, so the refusal must live on the server.
  it('enforces it server-side, before any write', () => {
    const refuse = src.indexOf("voice_basis_not_self");
    const upload = src.indexOf('.upload(');
    expect(refuse).toBeGreaterThan(-1);
    expect(upload).toBeGreaterThan(refuse);
  });

  it('records which version went live', () => {
    expect(src).toContain('narration_source: source');
  });
});

describe('tts route — reporting, never assuming', () => {
  const src = read('app/api/admin/demo-narration/tts/route.ts');

  // ⚠️ An unreported basis is UNKNOWN. Defaulting it to 'self' would label the house narrator
  // as the owner's own voice, which is precisely the failure mode.
  it('stores null when HJ reports no basis, never self', () => {
    expect(src).toMatch(/voice_basis === 'self' \|\| [^\n]*voice_basis === 'narrator'/);
    expect(src).toContain(': null');
    expect(src).not.toMatch(/voice_basis\s*\?\?\s*'self'/);
  });

  it('surfaces HJ\'s own error code rather than a generic failure', () => {
    // `voice_third_party` is the consent bright line — an operator needs that word.
    expect(src).toContain('gen.code');
  });

  it('claims one basis for the set only when every line agrees', () => {
    expect(src).toContain('bases.size === 1');
  });

  it('caps how many lines it will bill for', () => {
    expect(src).toContain('MAX_LINES');
  });
});

describe('takes API — the two sources stay separate', () => {
  const src = read('app/api/admin/demo-narration/route.ts');

  // ⚠️ Without a source filter, deleting a re-recorded line also deletes its synthesised
  // counterpart — two different artifacts behind one button.
  it('deletes only the chosen source', () => {
    expect(src).toContain(".eq('source', source)");
  });

  it('stores a human reading as recorded, and conflicts per source', () => {
    expect(src).toContain("source: 'recorded'");
    expect(src).toContain("onConflict: 'clip_key,line_index,source'");
  });
});

describe('the studio reports WHY synthesis failed', () => {
  const src = read('app/admin/demo-narration/narration-studio.tsx');

  // ⚠️ The first real attempt said "Synthesised 0 line(s), 1 failed — voice unknown —
  // HiveJournal did not report which voice spoke." The route already knew the answer was
  // `no_grant`; the UI discarded it and led with a VOICE BASIS, which is meaningless when no
  // voice was produced. An operator cannot act on that.
  it('leads with the failure, not a voice basis, when nothing was produced', () => {
    expect(src).toContain('j.generated === 0');
    expect(src).toContain('Nothing was synthesised');
  });

  it('explains each documented HJ error code', () => {
    for (const code of ['no_grant', 'invalid_or_revoked_grant', 'voice_third_party', 'grant_scope']) {
      expect(src).toContain(`${code}:`);
    }
  });

  // An embed id is not a grant — that distinction is the whole reason this failed.
  it('says an embed id is not enough and links to where a grant is pasted', () => {
    expect(src).toMatch(/embed id is not enough/i);
    expect(src).toContain('/merchant/audio');
  });
});
