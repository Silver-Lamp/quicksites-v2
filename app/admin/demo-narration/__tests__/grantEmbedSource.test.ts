// app/admin/demo-narration/__tests__/grantEmbedSource.test.ts
//
// The embed to synthesise with must come from the grants we hold, never from a free-text box.
//
// ⚠️ WHY THIS IS A SOURCE GUARD AND NOT A UNIT TEST. The failure is not a wrong return value —
// it is a UI that offers a value which is wrong by default. A grant is minted per embed and HJ
// rejects a mismatch (`grant_embed_mismatch`), so asking a person to type an embed id invites
// exactly one answer: the id they have read most recently. On the first real run that is what
// happened — the grant was on "Cornerstone — in Sandon's voice" and the id typed was the
// homepage In Your Voice player, which is a different embed belonging to the same owner. The
// set of correct answers is enumerable (`GET /api/partner/audio/connect`), so there is no
// honest reason to ask for a free one. Only reading the source can catch the prompt coming back.

import fs from 'node:fs';
import path from 'node:path';

const STUDIO = path.join(process.cwd(), 'app/admin/demo-narration/narration-studio.tsx');

describe('demo narration picks its embed from the grants we hold', () => {
  const src = fs.readFileSync(STUDIO, 'utf8');

  it('reads the connected grants before synthesising', () => {
    expect(src).toContain("fetch('/api/partner/audio/connect')");
  });

  it('never prompts for an embed id with nothing to choose from', () => {
    // A prompt is allowed ONLY to disambiguate between ids we already hold grants for, which
    // is why we assert on the wording rather than banning window.prompt outright: the banned
    // shape is one that asks the operator to supply an id, not one that offers a list.
    const prompts = [...src.matchAll(/window\.prompt\(\s*([\s\S]{0,200}?)\)/g)].map((m) => m[1]);
    for (const p of prompts) {
      expect(p).not.toMatch(/embed id to synthesise with/i);
      // Every surviving prompt must be offering a resolved list, i.e. interpolating the ids.
      expect(p).toMatch(/ids\./);
    }
  });

  it('rejects an id we hold no grant for instead of sending it to HiveJournal', () => {
    // A round-trip that can only fail is a slower way of telling the operator what we knew.
    expect(src).toMatch(/if \(!ids\.includes\(chosen\)\)/);
  });

  it('sends the operator to mint one when nothing is connected', () => {
    expect(src).toMatch(/if \(ids\.length === 0\)[\s\S]{0,160}PROVISION_HELP\.no_grant/);
  });

  // The guard is worthless if it is reading a file that moved.
  it('is pointed at a file that exists and is non-trivial', () => {
    expect(src.length).toBeGreaterThan(2000);
  });
});
