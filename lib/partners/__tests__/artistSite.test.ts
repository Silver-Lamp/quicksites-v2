/**
 * @jest-environment node
 */
// The HJ → QS artist-site handoff (contracts/artist-profile.md). Pure halves: the signature,
// the profile shape (only HJ hosts may be framed), and the assembled template (only what the
// profile says; the scaffold's speaking blocks never reach an artist page). Source guards over
// the route: fail-closed, constant-time, rate-limited, claim minted here.
import fs from 'node:fs';
import path from 'node:path';
import { ArtistProfileSchema, assembleArtistTemplate, signPartnerBody, verifyPartnerSignature } from '@/lib/partners/artistSite';
import { stripComments } from '@/test/stripComments';

const read = (p: string) => stripComments(fs.readFileSync(path.join(process.cwd(), p), 'utf8'));

const PROFILE = {
  slug: 'hivejournal-house-band',
  name: 'The HiveJournal House Band',
  bio: 'Loops cut from our own sessions. Instrumental, bar-exact, made for focus.',
  image_url: 'https://www.hivejournal.com/img/house-band.jpg',
  links: [
    { platform: 'bandcamp', url: 'https://hivejournal.bandcamp.com' },
    { platform: 'instagram', url: 'https://instagram.com/hivejournal' },
  ],
  loops: [{ id: 'l1', title: 'Night Shift', duration_sec: 48 }],
  hj_page_url: 'https://www.hivejournal.com/perfect-loops/artists/hivejournal-house-band',
  fan_link_url: 'https://perfectloops.fm/hivejournal-house-band',
  player_embed_url: 'https://www.hivejournal.com/perfect-loops/embed/hivejournal-house-band',
};

describe('signature', () => {
  const body = JSON.stringify(PROFILE);
  it('accepts the hex HMAC of the raw body and nothing else', () => {
    const sig = signPartnerBody(body, 'shared');
    expect(verifyPartnerSignature(body, sig, 'shared')).toBe(true);
    expect(verifyPartnerSignature(body, `sha256=${sig}`, 'shared')).toBe(true);
    expect(verifyPartnerSignature(`${body} `, sig, 'shared')).toBe(false);
    expect(verifyPartnerSignature(body, sig, 'other')).toBe(false);
    expect(verifyPartnerSignature(body, sig.slice(0, -2), 'shared')).toBe(false);
    expect(verifyPartnerSignature(body, null, 'shared')).toBe(false);
  });
  it('fails closed with no secret', () => {
    expect(verifyPartnerSignature(body, signPartnerBody(body, ''), undefined)).toBe(false);
    expect(verifyPartnerSignature(body, signPartnerBody(body, ''), '')).toBe(false);
  });
});

describe('profile shape', () => {
  it('accepts the contract example', () => {
    expect(ArtistProfileSchema.safeParse(PROFILE).success).toBe(true);
  });
  it('refuses an embed or fan link that is not HiveJournal’s — it becomes an iframe on a customer page', () => {
    expect(ArtistProfileSchema.safeParse({ ...PROFILE, player_embed_url: 'https://evil.example/embed' }).success).toBe(false);
    expect(ArtistProfileSchema.safeParse({ ...PROFILE, player_embed_url: 'http://www.hivejournal.com/perfect-loops/embed/x' }).success).toBe(false);
    expect(ArtistProfileSchema.safeParse({ ...PROFILE, fan_link_url: 'https://perfectloops.fm.evil.example/x' }).success).toBe(false);
  });
  it('refuses a slug that is not url-safe', () => {
    expect(ArtistProfileSchema.safeParse({ ...PROFILE, slug: 'House Band' }).success).toBe(false);
  });
});

describe('assembleArtistTemplate — only what the profile says', () => {
  const tpl: any = assembleArtistTemplate(ArtistProfileSchema.parse(PROFILE));
  const blocks: any[] = tpl.data.pages[0].blocks;
  const types = blocks.map((b) => b.type);

  it('is the musician scaffold with the player filled and ONE About block after it, with no stacked title', () => {
    expect(types[0]).toBe('hero');
    expect(types[1]).toBe('perfect_loops_player');
    expect(types[2]).toBe('story');
    // `blocks` and `content_blocks` are one array; the first live draft carried About twice.
    expect(types.filter((t) => t === 'story')).toHaveLength(1);
    expect(tpl.data.pages[0].content_blocks.filter((b: any) => b.type === 'story')).toHaveLength(1);
    expect(blocks[2].content.title).toBe('');
    expect(blocks[2].content.sections[0].heading).toBe(`About ${PROFILE.name}`);
    const player = blocks[1].content;
    expect(player.embed_url).toBe(PROFILE.player_embed_url);
    expect(player.fan_link_url).toBe(PROFILE.fan_link_url);
    expect(player.artist_name).toBe(PROFILE.name);
    expect(player.links).toHaveLength(2);
    expect(blocks[2].content.sections[0].body).toBe(PROFILE.bio);
    expect(blocks[0].content.image_url).toBe(PROFILE.image_url);
  });
  it('seeds shows, releases and the gallery EMPTY and never the scaffold’s speaking blocks', () => {
    for (const t of ['services', 'faq', 'testimonials', 'cta', 'about_that', 'order_bar']) expect(types).not.toContain(t);
    const shows = blocks.find((b) => b.type === 'events');
    expect(shows.content.events).toEqual([]);
    expect(blocks.find((b) => b.type === 'selected_work').content.items).toEqual([]);
    expect(blocks.find((b) => b.type === 'gallery').content.images).toEqual([]);
  });
  it('stamps the HJ provenance as the idempotency key', () => {
    expect(tpl.data.meta.hj_handoff).toMatchObject({ artist_slug: PROFILE.slug, hj_page_url: PROFILE.hj_page_url });
    expect(tpl.data.meta.built_for).toBe(PROFILE.name);
  });
  it('no bio → no About block', () => {
    const t2: any = assembleArtistTemplate(ArtistProfileSchema.parse({ ...PROFILE, bio: '' }));
    expect(t2.data.pages[0].blocks.map((b: any) => b.type)).not.toContain('story');
  });
});

// ⚠️ THE FIRST REAL SIGNED POST (2026-10-13 19:19 UTC) 500'D ON THIS. The URL rules were defined in
// the block renderer, a 'use client' file; imported into the server route they arrive as client
// references and throw when called. Jest ignores the directive, so only reading the import graph
// catches it: nothing the route reaches may import from a client component file.
describe('server code never imports from a client component', () => {
  it.each(['lib/partners/artistSite.ts', 'app/api/partner/hj/artist-site/route.ts', 'lib/partners/perfectLoopsUrls.ts'])('%s', (p) => {
    const src = read(p);
    expect(src).not.toMatch(/from '@\/components\//);
    expect(src).not.toMatch(/['"]use client['"]/);
  });
  it('the renderer takes the URL rules from the plain module rather than defining them', () => {
    const r = read('components/admin/templates/render-blocks/perfect-loops-player.tsx');
    expect(r).toMatch(/from '@\/lib\/partners\/perfectLoopsUrls'/);
    expect(r).not.toMatch(/export function isAllowed/);
  });
});

describe('the route', () => {
  const src = read('app/api/partner/hj/artist-site/route.ts');
  it('fails closed, verifies the raw body, rate-limits, validates, and mints the claim on this side', () => {
    expect(src).toMatch(/receiver_not_configured.*503/);
    expect(src).toMatch(/await req\.text\(\)/);
    expect(src).toMatch(/verifyPartnerSignature\(raw/);
    expect(src).toMatch(/x-partner-id'\) !== 'hivejournal'/);
    expect(src).toMatch(/rateLimitOr429\(req, 'hj-artist-site'/);
    expect(src).toMatch(/ArtistProfileSchema\.safeParse/);
    expect(src).not.toMatch(/claim_url.*req\./); // never passes a caller-supplied claim through
    expect(read('lib/partners/artistSite.ts')).toMatch(/mintSiteClaimToken\(/);
    expect(read('lib/partners/artistSite.ts')).toMatch(/claim_source: 'operator_draft'/);
  });
});
