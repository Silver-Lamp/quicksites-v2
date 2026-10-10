/**
 * @jest-environment node
 */
// lib/sites/__tests__/heroCta.test.ts
//
// 2026-10-10: "Call Now" on vashon-electrical.com reloaded the home page. The scaffold's hero
// default was `cta_link: '/'` and the renderer read it as "go to /" — on 109 published sites.
import fs from 'node:fs';
import path from 'node:path';
import { resolveHeroCta, deriveCtaAction, phoneFromSite } from '@/lib/sites/heroCta';
import { stripComments } from '@/test/stripComments';

const read = (p: string) => stripComments(fs.readFileSync(path.join(process.cwd(), p), 'utf8'));

describe('the scaffold default: `/` is not a destination', () => {
  it('"Call Now" with the dead default and a phone dials the phone (the vashon-electrical case)', () => {
    expect(resolveHeroCta({ cta_link: '/', cta_text: 'Call Now', phoneDigits: '3604047198' })).toEqual({ action: 'call_phone', href: 'tel:3604047198' });
  });
  it('"Get a Free Quote" with the dead default goes to the contact form', () => {
    expect(resolveHeroCta({ cta_link: '/', cta_text: 'Get a Free Quote', phoneDigits: '3604047198' })).toEqual({ action: 'jump_to_contact', href: '#contact' });
    expect(resolveHeroCta({ cta_link: '', cta_text: 'Get Started' })).toEqual({ action: 'jump_to_contact', href: '#contact' });
  });
  it('"Call Now" with no phone anywhere still goes to the contact form rather than vanishing', () => {
    expect(resolveHeroCta({ cta_link: '/', cta_text: 'Call Now' })).toEqual({ action: 'jump_to_contact', href: '#contact' });
    expect(resolveHeroCta({ cta_action: 'call_phone', cta_text: 'Call' })).toEqual({ action: 'jump_to_contact', href: '#contact' });
  });
});

describe('the rules that already held', () => {
  it('an author anchor is kept, never redirected to the contact form', () => {
    expect(resolveHeroCta({ cta_link: '#menu', cta_text: 'See the menu', phoneDigits: '2065551234' })).toEqual({ action: 'jump_to_anchor', href: '#menu' });
    expect(deriveCtaAction('#restaurants')).toBe('jump_to_anchor');
  });
  it('a tel: link calls; a real page link navigates; an explicit action wins', () => {
    expect(resolveHeroCta({ cta_link: 'tel:+16661234567', cta_text: 'Call Now', phoneDigits: '6661234567' })).toEqual({ action: 'call_phone', href: 'tel:6661234567' });
    expect(resolveHeroCta({ cta_link: '/pricing', cta_text: 'See pricing' })).toEqual({ action: 'go_to_page', href: '/pricing' });
    expect(resolveHeroCta({ cta_action: 'go_to_page', cta_link: '/book', cta_text: 'Call us' })).toEqual({ action: 'go_to_page', href: '/book' });
  });
  it('honours a custom contact anchor', () => {
    expect(resolveHeroCta({ cta_link: '#contact', cta_text: 'Reach out', contactAnchor: 'get-in-touch' }).href).toBe('#get-in-touch');
  });
});

describe('phoneFromSite — the served snapshot has no columns', () => {
  it('reads the tracking number from data.meta.contact.phone when templates.phone is absent (the live vashon-electrical case)', () => {
    expect(phoneFromSite({ data: { meta: { contact: { phone: '+13604047198' } } } })).toBe('13604047198');
    expect(phoneFromSite({ data: JSON.stringify({ meta: { contact: { phone: '(360) 404-7198' } } }) })).toBe('3604047198');
  });
  it('prefers the column when present and returns empty, never a guess, when nothing is there', () => {
    expect(phoneFromSite({ phone: '2065551234', data: { meta: { contact: { phone: '3604047198' } } } })).toBe('2065551234');
    expect(phoneFromSite({ data: { meta: {} } })).toBe('');
    expect(phoneFromSite(null)).toBe('');
    expect(phoneFromSite({ data: { meta: { contact: { phone: '555' } } } })).toBe('');
  });
});

describe('source guards', () => {
  it('no default seeds `/` as a hero link any more', () => {
    for (const f of ['lib/blocks/defaultBlockContent.ts', 'admin/lib/zod/blockSchema.ts']) {
      const src = read(f);
      expect(src).not.toMatch(/cta_link: '\/'/);
      expect(src).not.toMatch(/cta_link = '\/'/);
      expect(src).not.toMatch(/cta_link: z\.string\(\)\.optional\(\)\.default\('\/'\)/);
    }
  });
  it('the hero renderer decides through the pure module', () => {
    const hero = read('components/admin/templates/render-blocks/hero.tsx');
    expect(hero).toMatch(/resolveHeroCta\(\{ cta_action, cta_link, cta_text, phoneDigits: resolvedPhoneDigits, contactAnchor \}\)/);
    expect(hero).toMatch(/merged\.cta_action = deriveCtaAction\(merged\.cta_link\)/);
    expect(hero).not.toMatch(/href = cta_link \|\| '\/contact'/);
    expect(hero).toMatch(/const dbPhoneDigits = phoneFromSite\(template\)/);
  });
});
