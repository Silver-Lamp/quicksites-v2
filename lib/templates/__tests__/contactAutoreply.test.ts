// lib/templates/__tests__/contactAutoreply.test.ts — the form's auto-reply is the merchant's email.
import fs from 'node:fs';
import path from 'node:path';
import { defaultAutoreply, fillPlaceholders, findContactFormContent, resolveAutoreply } from '@/lib/templates/contactAutoreply';

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');
const row = (content: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({
  slug: 'bhard',
  business_name: 'B Hard',
  custom_domain: 'bhard.store',
  contact_email: 'support@bhardstore.com',
  data: { pages: [{ blocks: [{ type: 'hero', content: {} }, { type: 'contact_form', content }] }] },
  ...extra,
});

describe('resolveAutoreply', () => {
  it('email-only default: the business on the From line, replies to its contact address, no QuickSites team', () => {
    const r = resolveAutoreply(row({ mode: 'email_only' }), { email: 'x@y.co' });
    expect(r.enabled).toBe(true);
    expect(r.fromName).toBe('B Hard');
    expect(r.replyTo).toBe('support@bhardstore.com');
    expect(r.subject).toBe('You’re on the list — B Hard');
    expect(r.text).toContain('Thanks for signing up.');
    expect(r.text).toContain('— B Hard');
    expect(r.text).toContain('because you submitted a form on bhard.store');
    expect(r.text).not.toMatch(/QuickSites/);
  });
  it('full-form default greets by name; a missing name reads "there"', () => {
    expect(resolveAutoreply(row({}), { name: 'Dana' }).text).toMatch(/^Hi Dana,/);
    expect(resolveAutoreply(row({}), {}).text).toMatch(/^Hi there,/);
    expect(resolveAutoreply(row({}), {}).subject).toBe('Thanks for contacting B Hard');
  });
  it('the merchant’s words win, placeholders fill, and the toggle can switch it off', () => {
    const r = resolveAutoreply(row({ mode: 'email_only', autoreply_from_name: 'B Hard by B Your Best', autoreply_subject: 'Got it — {email}', autoreply_body: 'See you the day ordering opens, {name}.' }), { email: 'x@y.co' });
    expect(r.fromName).toBe('B Hard by B Your Best');
    expect(r.subject).toBe('Got it — x@y.co');
    expect(r.text).toMatch(/^See you the day ordering opens, there\./);
    expect(resolveAutoreply(row({ autoreply_enabled: false })).enabled).toBe(false);
  });
  it('the submitting page’s mode wins over the block’s stored one', () => {
    expect(resolveAutoreply(row({}), { mode: 'email_only' }).subject).toMatch(/on the list/);
  });
  it('helpers', () => {
    expect(findContactFormContent({ pages: [{ content_blocks: [{ type: 'contact_form', props: { title: 'x' } }] }] })).toEqual({ title: 'x' });
    expect(findContactFormContent({ pages: [] })).toBeNull();
    expect(fillPlaceholders('{Name} / {business} / {site}', { name: '', business: 'B', site: 's' })).toBe('there / B / s');
    expect(defaultAutoreply('full').subject).toBe('Thanks for contacting {business}');
  });
});

describe('the wiring (source guards)', () => {
  it('the route sends the merchant’s reply, with reply-to, and no longer the platform note', () => {
    const src = read('app/api/send-contact-email/route.ts');
    expect(src).toMatch(/resolveAutoreply\(siteRow, \{/);
    expect(src).toMatch(/replyTo: reply\.replyTo/);
    expect(src).toMatch(/from: `\$\{reply\.fromName\.replace\(\/\[<>"\]\/g, ''\)\} <\$\{brand\.fromAddress\}>`/);
    // The old subject as CODE, not the comment that explains its removal (CLAUDE.md §4's lesson).
    expect(src).not.toMatch(/subject: 'Thanks for contacting us!'/);
    expect(src).not.toMatch(/brand\.footer/);
  });
  it('the form sends the name and the mode so the reply can address and shape itself', () => {
    const src = read('components/admin/templates/render-blocks/contact-form.tsx');
    expect(src).toMatch(/user_name: emailOnly \? null : formData\.name \|\| null/);
    expect(src).toMatch(/form_mode: mode/);
  });
  it('the editor offers the auto-reply section and saves only what the merchant typed', () => {
    const ed = read('components/admin/templates/block-editors/contact-form-editor.tsx');
    expect(ed).toMatch(/Auto-reply to the person who submits/);
    expect(ed).toMatch(/\.\.\.\(autoreplyEnabled \? \{\} : \{ autoreply_enabled: false \}\)/);
  });
});
