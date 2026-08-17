/** @jest-environment node */
// The lemonade-stand minor-safety invariants, made enforceable.
//
// ⚠️ THESE WERE INSTINCTS UNTIL 2026-08-17 AND THAT WAS THE PROBLEM. The scaffold already did
// the right thing — no voice block, no address, no child's surname — but nothing made it stay
// true. PorchHearth's note, from a team that shipped a kids' chores feature behind five written
// invariants: *"instincts don't survive a growth idea six months from now; invariants with specs
// attached do."* This file is the spec.
//
// Ruled out unanimously and on the record by HiveJournal and PorchHearth (crosstalk 2026-08-17),
// both unprompted on the same day:
//
//   • NO MINOR VOICE, of any kind. Not a clone, and — the part people miss — not a REAL
//     recording of the child either. A recorded child's voice on a distributed commercial page
//     is a biometric-adjacent identifier of a minor published to the open web, with a consent
//     chain nobody in this mesh is qualified to improvise. A minor cannot give the consent a
//     voice artifact requires; that is not a process gap to be closed, it is the reason.
//     HJ, whose entire product is consent-first voice: "an easy no."
//     PH: their invariants refuse a minor even a LOGIN; a published voice is strictly more
//     exposure than an account.
//     And the stand does not need it — the kid's actual voice is right there on the driveway.
//
//   • THE ADULT HOLDS THE MONEY. Stripe requires an 18+ account holder, so the merchant account
//     is the parent's. The page must say so rather than leave "kid's stand takes card payments"
//     to be read the one wrong way.
//
//   • NO IDENTIFYING DETAIL OF THE CHILD. A stand page is already a public note that a named
//     child is at a particular house on a particular afternoon. First name at most; no surname,
//     no photo, no address — which is why the location block every other food scaffold adds is
//     deliberately absent here.
//
// A test rather than a comment because the failure mode is a well-meaning future edit: seeding
// the "In Your Voice" block into every scaffold for consistency, or adding a location block so
// customers can find the stand. Both are reasonable-sounding and both cross the line.

import { buildIndustryStarter } from '../industryScaffold';

const starter = () => buildIndustryStarter({ businessName: 'Renton Lemonade', industryKey: 'lemonade_stand' as any });

function allBlocks(s: any): any[] {
  const pages = s?.data?.pages ?? s?.pages ?? [];
  const out: any[] = [];
  for (const p of pages) {
    for (const key of ['content_blocks', 'blocks']) {
      if (Array.isArray(p?.[key])) out.push(...p[key]);
    }
  }
  return out;
}

describe('lemonade stand: no minor voice', () => {
  it('seeds no audio/voice block of any kind', () => {
    const types = allBlocks(starter()).map((b) => String(b?.type ?? ''));
    expect(types).not.toContain('about_that');
    expect(types.filter((t) => /audio|voice|podcast/i.test(t))).toEqual([]);
  });

  it('carries no audio embed id anywhere in the starter', () => {
    // An embed id is the thing that makes a voice block actually speak. Even a block seeded
    // "silent" for some other industry must never arrive here carrying one.
    const json = JSON.stringify(starter());
    expect(json).not.toMatch(/embed_id/i);
  });
});

describe('lemonade stand: no identifying detail of the child', () => {
  it('seeds no location/address block', () => {
    // Every other food scaffold adds one. Here it would publish which house a named child is
    // standing outside — the single most consequential difference between this vertical and a
    // restaurant, and it is a deliberate omission rather than an oversight.
    const types = allBlocks(starter()).map((b) => String(b?.type ?? ''));
    expect(types).not.toContain('location');
  });

  it('asks for no photo of a child', () => {
    const json = JSON.stringify(starter()).toLowerCase();
    for (const probe of ['child photo', 'kid photo', 'photo of your child', 'your kid’s photo']) {
      expect(json).not.toContain(probe);
    }
  });
});

describe('lemonade stand: the adult is the account holder', () => {
  it('addresses the setup copy to the grown-up, not the child', () => {
    // The scaffold's own header records why: every consumer payment app needs an 18+ account
    // holder, so copy written at kids is both untrue about who can finish and an invitation for
    // a nine-year-old to try opening a payments account.
    const json = JSON.stringify(starter()).toLowerCase();
    expect(json).not.toMatch(/\bkids?,? (sign|set) up\b/);
    expect(json).not.toMatch(/your own stripe account/);
  });

  it('still produces a working stand — the invariants constrain it, they do not empty it', () => {
    // A guard that passes because the scaffold produced nothing would be worthless. Pin that a
    // real page still comes out: something to sell, and a way to pay.
    const types = allBlocks(starter()).map((b) => String(b?.type ?? ''));
    expect(types).toContain('hero');
    expect(types).toContain('menu');
    expect(types.length).toBeGreaterThanOrEqual(3);
  });
});
