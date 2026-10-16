/**
 * @jest-environment node
 */
import fs from 'node:fs';
import path from 'node:path';
import { AB_COOKIE, isAbEventName, parseHomepageAb, pickVariant, summarizeAb } from '@/lib/ab/homepage';
import { stripComments } from '@/test/stripComments';

const read = (p: string) => stripComments(fs.readFileSync(path.join(process.cwd(), p), 'utf8'));
const b = { video_url: 'https://x.test/b.mp4', poster_url: 'https://x.test/b.png' };

describe('parseHomepageAb', () => {
  it('is off unless enabled AND B has https video + poster', () => {
    expect(parseHomepageAb(null).enabled).toBe(false);
    expect(parseHomepageAb({ enabled: true }).enabled).toBe(false);
    expect(parseHomepageAb({ enabled: true, b: { video_url: 'http://x.test/b.mp4', poster_url: b.poster_url } }).enabled).toBe(false);
    const on = parseHomepageAb({ enabled: true, split_b: '30', b: { ...b, headline: ' New ', has_audio: true } });
    expect(on).toMatchObject({ enabled: true, split_b: 30, b: { ...b, headline: 'New', has_audio: true } });
    expect(parseHomepageAb({ enabled: true, split_b: 500, b }).split_b).toBe(100);
  });
});

describe('pickVariant', () => {
  const on = parseHomepageAb({ enabled: true, split_b: 50, b });
  it('A when off; the cookie wins when valid; otherwise a draw by split', () => {
    expect(pickVariant(parseHomepageAb(null), 'B')).toEqual({ variant: 'A', assigned: false });
    expect(pickVariant(on, 'B')).toEqual({ variant: 'B', assigned: false });
    expect(pickVariant(on, 'junk', () => 0.1)).toEqual({ variant: 'B', assigned: true });
    expect(pickVariant(on, null, () => 0.9)).toEqual({ variant: 'A', assigned: true });
    expect(pickVariant(parseHomepageAb({ enabled: true, split_b: 0, b }), null, () => 0).variant).toBe('A');
    expect(pickVariant(parseHomepageAb({ enabled: true, split_b: 100, b }), null, () => 0.999).variant).toBe('B');
  });
});

describe('summarizeAb', () => {
  it('rates are per unique visitor and null without exposures', () => {
    const rows = summarizeAb([{ variant: 'A', event: 'exposure', visitors: 200 }, { variant: 'A', event: 'guest_build_started', visitors: 10 }, { variant: 'B', event: 'cta_click', visitors: 3 }]);
    expect(rows[0]).toMatchObject({ variant: 'A', exposures: 200, build_rate: 0.05, cta_rate: 0 });
    expect(rows[1]).toMatchObject({ variant: 'B', exposures: 0, cta_click: 3, cta_rate: null, build_rate: null });
  });
  it('event names are allowlisted', () => {
    expect(isAbEventName('exposure')).toBe(true);
    expect(isAbEventName('anything')).toBe(false);
  });
});

describe('the wiring', () => {
  it('the page reads the cookie and never sets it; the route sets it only on assign', () => {
    const page = read('app/page.tsx');
    expect(page).toMatch(/cookies\(\)\)\.get\(AB_COOKIE\)/);
    expect(page).not.toMatch(/cookies\(\)\)\.set/);
    const route = read('app/api/ab/event/route.ts');
    expect(route).toMatch(/isSyntheticRequest\(req\.headers\.get\('user-agent'\)\)/);
    expect(route).toMatch(/body\?\.assign === true && !req\.cookies\.get\(cookieName\)/);
    expect(route).toMatch(/const cookieName = templateId \? siteAbCookie\(templateId\) : AB_COOKIE/);
    expect(route).not.toMatch(/user_agent|ip:/);
    expect(AB_COOKIE).toBe('qs_ab_home');
  });
  it('variant B video is muted autoplay with a poster; sound is a user action', () => {
    const v = read('components/home/hero-video-b.tsx');
    expect(v).toMatch(/autoPlay\s+muted\s+loop\s+playsInline/);
    expect(v).toMatch(/poster=\{b\.poster_url\}/);
    expect(v).toMatch(/onClick=\{toggle\}/);
    expect(v).not.toMatch(/autoplay[^]*unmuted/i);
  });
  it('conversions are recorded from the guest build and the primary CTA', () => {
    expect(read('components/home/guest-start.tsx')).toMatch(/abEvent\('guest_build_started'\)/);
    expect(read('components/home/home-client.tsx')).toMatch(/abEvent\('cta_click'\)/);
  });
});
