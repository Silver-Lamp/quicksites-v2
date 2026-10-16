// lib/ab/__tests__/siteAb.test.ts — per-site A/B: the pure decisions, and source guards over the
// two public routes (both must make the same decision, and never on a draft/preview).
import fs from 'node:fs';
import path from 'node:path';
import { applySiteVariantB, parseSiteAb, pickSiteVariant, siteAbCookie, siteExperimentId, templateIdFromExperiment } from '@/lib/ab/siteAb';

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');
const ID = 'c66caf39-7460-4352-bbb4-4657efd97f2b';

describe('names', () => {
  it('experiment ↔ template id round-trips; cookie is per site and short', () => {
    expect(siteExperimentId(ID)).toBe(`site:${ID}`);
    expect(templateIdFromExperiment(`site:${ID}`)).toBe(ID);
    expect(templateIdFromExperiment('homepage_hero')).toBeNull();
    expect(templateIdFromExperiment('site:not-a-uuid')).toBeNull();
    expect(siteAbCookie(ID)).toBe('qs_ab_c66caf39');
  });
});

describe('parseSiteAb', () => {
  it('a test is ON only when B has an https video or image', () => {
    expect(parseSiteAb(ID, { enabled: true, split_b: 50, b: { hero: { headline: 'x' } } }).enabled).toBe(false);
    expect(parseSiteAb(ID, { enabled: true, split_b: 50, b: { hero: { video_url: 'http://x/v.mp4' } } }).enabled).toBe(false);
    const t = parseSiteAb(ID, { enabled: true, split_b: 150, b: { hero: { video_url: 'https://x/v.mp4' } } });
    expect(t.enabled).toBe(true);
    expect(t.split_b).toBe(100);
  });
});

describe('pickSiteVariant', () => {
  const t = parseSiteAb(ID, { enabled: true, split_b: 50, b: { hero: { video_url: 'https://x/v.mp4' } } });
  it('the cookie is sticky; a fresh visitor draws', () => {
    expect(pickSiteVariant(t, 'B')).toEqual({ variant: 'B', assigned: false });
    expect(pickSiteVariant(t, 'A')).toEqual({ variant: 'A', assigned: false });
    expect(pickSiteVariant(t, null, () => 0.1)).toEqual({ variant: 'B', assigned: true });
    expect(pickSiteVariant(t, null, () => 0.9)).toEqual({ variant: 'A', assigned: true });
  });
  it('off → A, never assigned', () => {
    expect(pickSiteVariant({ ...t, enabled: false }, null, () => 0.1)).toEqual({ variant: 'A', assigned: false });
  });
});

describe('applySiteVariantB', () => {
  const data = {
    pages: [
      {
        blocks: [{ type: 'hero', content: { headline: 'A', image_url: 'https://a/img.png', layout_mode: 'inline' }, props: { headline: 'A' } }, { type: 'services', content: {} }],
        content_blocks: [{ type: 'hero', content: { headline: 'A' } }],
      },
      { blocks: [{ type: 'hero', content: { headline: 'second page' } }] },
    ],
  };
  it('overrides the FIRST hero in both arrays and both copies; everything else untouched', () => {
    const out: any = applySiteVariantB(data, { video_url: 'https://x/v.mp4', poster_url: 'https://x/p.png', has_audio: true, layout_mode: 'full_bleed' });
    const h = out.pages[0].blocks[0].content;
    expect(h).toMatchObject({ headline: 'A', video_url: 'https://x/v.mp4', image_url: 'https://x/p.png', layout_mode: 'full_bleed', video_has_audio: true });
    expect(out.pages[0].blocks[0].props).toMatchObject({ video_url: 'https://x/v.mp4' });
    expect(out.pages[0].content_blocks[0].content).toMatchObject({ video_url: 'https://x/v.mp4' });
    expect(out.pages[0].blocks[1]).toEqual({ type: 'services', content: {} });
    expect(out.pages[1].blocks[0].content).toEqual({ headline: 'second page' });
    expect((data.pages[0].blocks[0].content as any).video_url).toBeUndefined(); // input untouched
  });
  it('patches the renderer shape too — `pages` AND `data.pages` (the live miss on bhard.store)', () => {
    const site = { pages: data.pages, data: { pages: JSON.parse(JSON.stringify(data.pages)), meta: {} } };
    const out: any = applySiteVariantB(site, { video_url: 'https://x/v.mp4', layout_mode: 'full_bleed' });
    expect(out.pages[0].blocks[0].content.layout_mode).toBe('full_bleed');
    expect(out.data.pages[0].blocks[0].content.layout_mode).toBe('full_bleed');
    expect(out.data.pages[0].content_blocks[0].content.video_url).toBe('https://x/v.mp4');
    expect(out.data.meta).toEqual({});
  });
  it('a video with no declared audio is flagged silent (the toggle must not appear)', () => {
    const out: any = applySiteVariantB(data, { video_url: 'https://x/v.mp4' });
    expect(out.pages[0].blocks[0].content.video_has_audio).toBe(false);
    expect(out.pages[0].blocks[0].content.layout_mode).toBe('background');
  });
});

describe('the wiring (source guards)', () => {
  const sites = read('app/sites/[slug]/[[...rest]]/page.tsx');
  const host = read('app/host/[[...rest]]/page.tsx');
  it('both public routes read the per-site cookie, apply B, stamp the root and mount the beacon', () => {
    for (const src of [sites, host]) {
      expect(src).toMatch(/pickSiteVariant\(test, cookieVal\)/);
      expect(src).toMatch(/applySiteVariantB\(/);
      expect(src).toMatch(/abStamp=\{abStamp\}/);
      expect(src).toMatch(/<AbBeacon experiment=\{experiment\} variant=\{picked\.variant\} assigned=\{picked\.assigned\} \/>/);
      expect(src).not.toMatch(/cookies\(\)\)\.set/);
    }
  });
  it('never on a draft or a preview snapshot', () => {
    expect(sites).toMatch(/if \(normalized && !isDraft && siteRow\.template_id\)/);
    expect(host).toMatch(/if \(payload\.templateId && !payload\.isPreview\)/);
  });
  it('the renderer stamps the experiment on its root; the client reads it', () => {
    expect(read('components/sites/site-renderer.tsx')).toMatch(/'data-qs-ab': abStamp/);
    expect(read('lib/ab/client.ts')).toMatch(/AB_STAMP_ATTR = 'data-qs-ab'/);
  });
  it('the hero video is muted autoplay with a poster; sound is a tap, only when declared', () => {
    const v = read('components/sites/hero-video-layer.tsx');
    expect(v).toMatch(/autoPlay\s+muted\s+loop\s+playsInline/);
    expect(v).toMatch(/\{hasAudio \? \(/);
  });
  it('the editor links to the site test', () => {
    expect(read('components/admin/templates/template-editor-toolbar.tsx')).toMatch(/\/admin\/ab\?template=\$\{currentId\}/);
  });
});
