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

// ⚠️ RESOLVING FROM THE STORED GRANT IS NOT ENOUGH, AND ASSUMING IT WAS IS THE SECOND BUG.
// The embed id is typed by hand WHEN THE TOKEN IS PASTED, so our record can disagree with the
// embed HJ actually minted it on. That is what happened: `partner_audio_grants` held one active
// row for `4f90e68e…` carrying a token minted on `27eb5896…`, so reading the embed from our own
// table returned the wrong answer with full confidence and failed identically every run. A
// grant error therefore has to be FIXABLE from the screen that reports it — otherwise the only
// remedy is a page the operator has no reason to think is involved.
describe('a grant failure can be fixed where it is reported', () => {
  const src = fs.readFileSync(STUDIO, 'utf8');

  it('treats every grant-class code as fixable, not just the obvious two', () => {
    for (const code of ['no_grant', 'invalid_or_revoked_grant', 'grant_scope', 'grant_embed_mismatch']) {
      expect(src).toContain(`'${code}'`);
    }
    // The old code hard-coded two codes inline; a Set the panel reads is what makes
    // grant_embed_mismatch — the likeliest one — open the panel rather than a dead end.
    expect(src).toMatch(/GRANT_FIXABLE\.has\(firstErr\)/);
  });

  it('offers re-pasting a token and removing a wrong record', () => {
    expect(src).toMatch(/async function connectGrant\(/);
    expect(src).toMatch(/async function forgetGrant\(/);
    expect(src).toMatch(/method: 'DELETE'/);
  });

  it('asks for the embed id beside the token, not somewhere else', () => {
    // The two values must be entered together or they can disagree from the start.
    expect(src).toMatch(/embed id \(uuid, from the same card\)/);
  });

  it('never claims a stored grant is working', () => {
    // Storing a token proves nothing about whether HJ accepts it for that embed.
    expect(src).toMatch(/Stored a grant for \$\{hjEmbedId\}/);
    expect(src).not.toMatch(/Connected!|Successfully connected/);
  });

  it('says that removing our copy does not revoke it at HiveJournal', () => {
    expect(src).toMatch(/Revoke it in HiveJournal too/);
  });

  it('lets the operator dismiss a stale message', () => {
    expect(src).toMatch(/Dismiss this message/);
  });

  it('does not attach a player to a live site as a side effect of connecting', () => {
    expect(src).toMatch(/attachToSite: false/);
  });
});
