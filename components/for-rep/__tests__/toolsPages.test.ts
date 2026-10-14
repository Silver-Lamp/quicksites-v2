/**
 * @jest-environment node
 */
// The three personal pages (/for-daniel, /for-amy, /for-daryle) share one shape (owner,
// 2026-10-13): a hello, "Your tools" with sign-in gating done once in the shared card, then
// folded pitch sentences. Each page's tool list names at least the two dashboards as auth-only.
import fs from 'node:fs';
import path from 'node:path';
import { stripComments } from '@/test/stripComments';

const read = (p: string) => stripComments(fs.readFileSync(path.join(process.cwd(), p), 'utf8'));

describe.each([
  ['daniel', 4, 'daniel', true],
  ['amy', 6, 'amyjurowski', false],
  ['daryle', 5, 'daryle24', false],
] as const)('/for-%s', (who, pitches, code, reps) => {
  const page = read(`app/for-${who}/page.tsx`);
  const tools = read(`app/for-${who}/tools.tsx`);

  it('is unlisted and mounts the tools card before the folded sections', () => {
    expect(page).toMatch(/robots: \{ index: false, follow: false \}/);
    expect(page).toMatch(/<ToolsCard \/>/);
    expect(page.indexOf('<ToolsCard />')).toBeLessThan(page.indexOf('<Pitch summary='));
  });

  it(`folds its sections into ${pitches} pitch sentences`, () => {
    expect(page.match(/<Pitch summary=/g)?.length).toBe(pitches);
    expect(page.match(/<\/Pitch>/g)?.length).toBe(pitches);
  });

  it('lists the two dashboards as auth-only and uses the shared card with their code', () => {
    expect(tools).toMatch(/href: '\/partners\/dashboard', auth: true/);
    expect(tools).toMatch(/href: '\/referrals\/dashboard', auth: true/);
    expect(tools).toMatch(new RegExp(`'${code}'`));
    expect(tools).toMatch(reps ? /<ToolsCard tools=\{TOOLS\} code=\{[A-Z_]+\} reps \/>/ : /<ToolsCard tools=\{TOOLS\} code=\{[A-Z_]+\} \/>/);
  });
});

describe('the shared card', () => {
  const card = read('components/for-rep/tools-card.tsx');
  it('gates auth tools on a real session and sends a signed-out visitor to sign in and back', () => {
    expect(card).toMatch(/t\.auth && !signedIn \? signInHref\(t\.href\) : t\.href/);
    expect(card).toMatch(/is_anonymous/);
    expect(card).toMatch(/🔒 sign in/);
  });
});
