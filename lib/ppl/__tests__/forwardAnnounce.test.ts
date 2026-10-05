// lib/ppl/__tests__/forwardAnnounce.test.ts
//
// The caller-facing announcement on a geo tracking number. Pinned because the copy IS the fix:
// a real caller hung up on 2026-10-01 when the business answered under a name the site had
// never mentioned, and nothing but a string decides whether that happens again.

import fs from 'node:fs';
import path from 'node:path';
import {
  connectingAnnouncement,
  spokenBusinessName,
  FORBIDDEN_ANNOUNCEMENT_PHRASES,
} from '@/lib/ppl/forwardAnnounce';
import { FORBIDDEN_IVR_PHRASES } from '@/lib/ppl/ivr';
import { last10 } from '@/lib/outreach/resolveBusinessName';
import { stripComments } from '@/test/stripComments';

const repo = path.resolve(__dirname, '../../..');

describe('spokenBusinessName', () => {
  it('drops a trailing legal suffix', () => {
    expect(spokenBusinessName('Too Cool Towing LLC')).toBe('Too Cool Towing');
    expect(spokenBusinessName('Madrona Electric LLC')).toBe('Madrona Electric');
    expect(spokenBusinessName('Trimble Towing & Automotive, LLC')).toBe('Trimble Towing & Automotive');
  });

  it('drops a trailing locality that the directory appended to the name', () => {
    // A real row: `Ken's Auto Rescue , Kennewick, WA`.
    expect(spokenBusinessName("Ken's Auto Rescue , Kennewick, WA")).toBe("Ken's Auto Rescue");
  });

  it('never removes a word that distinguishes one business from another', () => {
    // "And Recovery" is part of the name, not noise — two All Right entries differ by it.
    expect(spokenBusinessName('All Right Towing And Recovery')).toBe('All Right Towing And Recovery');
    expect(spokenBusinessName('All Right Towing')).toBe('All Right Towing');
    expect(spokenBusinessName("White's Towing & Recovery")).toBe("White's Towing & Recovery");
  });
});

describe('connectingAnnouncement', () => {
  it('names the business the caller is about to be connected to', () => {
    const said = connectingAnnouncement({
      businessName: 'Too Cool Towing LLC',
      trade: 'Towing',
      city: 'South Hill',
    });
    expect(said).toBe('Connecting you to Too Cool Towing, serving South Hill.');
  });

  // ⚠️ Shortened 2026-10-05: the first version ran six to seven seconds before any phone rang,
  // and the first real call after it shipped hung up at five. With a name, the name and the
  // city are the whole message — a trade descriptor is only spoken when there is no name.
  it('is short — one clause with the name, no preamble', () => {
    const said = connectingAnnouncement({ businessName: 'Madrona Electric LLC', trade: 'Electrical', city: 'Renton' });
    expect(said).toBe('Connecting you to Madrona Electric, serving Renton.');
    expect(said.split(' ').length).toBeLessThanOrEqual(8);
    expect(said).not.toMatch(/^Thanks for calling/);
  });

  // ⚠️ THE REGRESSION THAT MATTERS. The site says "South Hill Towing"; the business that answers
  // is Too Cool Towing. The announcement must never assert the site's invented identity, or the
  // answering business contradicts us exactly as it did on 2026-10-01.
  it('never speaks the site\'s invented <city> <trade> identity', () => {
    const said = connectingAnnouncement({
      businessName: 'Too Cool Towing LLC',
      trade: 'Towing',
      city: 'South Hill',
    });
    expect(said).not.toContain('South Hill Towing');
    // The city alone is fine and wanted — it is where the operator serves.
    expect(said).toContain('serving South Hill');
  });

  it('falls back to a true vague description, never to the site name, when unresolved', () => {
    const said = connectingAnnouncement({ businessName: null, trade: 'Towing', city: 'Grafton' });
    expect(said).toBe('Connecting you to a local towing company serving Grafton.');
    expect(said).not.toContain('Grafton Towing');
  });

  it('degrades sanely with no trade and no city', () => {
    expect(connectingAnnouncement({})).toBe('Connecting you to a local company.');
    expect(connectingAnnouncement({ businessName: 'Osborne\'s Towing' })).toBe(
      "Connecting you to Osborne's Towing.",
    );
  });

  it('says nothing on the forbidden lists, for every live campaign shape', () => {
    const shapes = [
      { businessName: 'Too Cool Towing LLC', trade: 'Towing', city: 'South Hill' },
      { businessName: null, trade: 'Towing', city: 'Grafton' },
      { businessName: 'Madrona Electric LLC', trade: 'Electrical', city: 'Renton' },
      {},
    ];
    for (const s of shapes) {
      const said = connectingAnnouncement(s).toLowerCase();
      for (const phrase of [...FORBIDDEN_ANNOUNCEMENT_PHRASES, ...FORBIDDEN_IVR_PHRASES]) {
        expect(said).not.toContain(phrase.toLowerCase());
      }
    }
  });

  it('the sentence that caused the hang-up is on the forbidden list', () => {
    expect(FORBIDDEN_ANNOUNCEMENT_PHRASES).toContain('please hold while i connect you');
  });
});

describe('last10', () => {
  // ⚠️ This is why the first resolution query returned zero rows for a table where 10 of 11
  // resolve: E.164 is 11 digits, a directory phone is 10, and comparing full strings matches
  // nothing while reading exactly like "we hold no names".
  it('matches E.164 against a directory-formatted number', () => {
    expect(last10('+12534425373')).toBe('2534425373');
    expect(last10('(253) 442-5373')).toBe('2534425373');
    expect(last10('253.442.5373')).toBe('2534425373');
    expect(last10('+12534425373')).toBe(last10('(253) 442-5373'));
  });

  it('refuses a number too short to identify anyone', () => {
    expect(last10('442-5373')).toBeNull();
    expect(last10('')).toBeNull();
    expect(last10(null)).toBeNull();
  });
});

// ── Source guards ───────────────────────────────────────────────────────────────────────────
// A unit test cannot catch the route going back to a bare hold, because the route's TwiML is a
// template literal no test imports. Read the file. Comments are stripped first — this very file
// quotes the old sentence to explain it, and the explanation must not satisfy the check.

describe('the live forward route (source)', () => {
  const routePath = 'app/api/twilio/geo/[campaignId]/route.ts';
  const src = stripComments(fs.readFileSync(path.join(repo, routePath), 'utf8'));

  it('does not ship a bare "please hold while I connect you"', () => {
    expect(src.toLowerCase()).not.toContain('please hold while i connect you');
  });

  it('builds the caller announcement from the shared builder', () => {
    expect(src).toContain('connectingAnnouncement(');
    // The name must come from the destination column, never from the site/campaign domain.
    expect(src).toContain('forward_to_name');
  });
});

describe('setCampaignForwardTo (source)', () => {
  const src = stripComments(fs.readFileSync(path.join(repo, 'lib/outreach/geoCampaigns.ts'), 'utf8'));

  // ⚠️ The load-bearing invariant: a name left over from a previous destination would have us
  // announce one business and dial another — worse than announcing no name. The only way to
  // guarantee they agree is to write both in the same statement.
  it('writes forward_to_name in the SAME update as forward_to', () => {
    const update = src.match(/\.update\(\{\s*forward_to:[^}]*\}\)/);
    expect(update).not.toBeNull();
    expect(update![0]).toContain('forward_to_name');
  });

  it('resolves the name rather than accepting one from a caller', () => {
    expect(src).toContain('resolveBusinessNameByPhone(to)');
    expect(src).not.toMatch(/function setCampaignForwardTo\([^)]*name\s*:/);
  });
});
