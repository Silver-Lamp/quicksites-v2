/**
 * @jest-environment node
 */
// Every settings panel must be reachable from the sidebar the editor actually mounts.
//
// ⚠️ TWO FILES, NEARLY IDENTICAL NAMES, ONE OF THEM DEAD:
//     components/admin/templates/template-settings-panel.tsx   ← imported by NOTHING
//     components/admin/template-settings-panel/sidebar-settings.tsx ← what the editor renders
// Both list Theme/Backdrop/SEO panels, so the dead one looks exactly as alive as the real one when
// you open it. The "Take it with you" download button was added to the dead file and shipped: the
// route worked, the tests passed, tsc was clean, and the button did not exist on any page. Sandon
// went looking for it and could not find it.
//
// This is the same shape as the render-gate lesson — correct code, unreachable — and the cheapest
// possible check for it is asking whether anything imports the file.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

const LIVE_SIDEBAR = 'components/admin/template-settings-panel/sidebar-settings.tsx';

// ⚠️ Being imported by a corpse is not being reachable. The first version of this test counted the
// dead settings file as "something", so `backdrop-panel` — wired only from there — passed while
// being invisible in the editor for two weeks.
const DEAD_FILES = ['template-settings-panel.DEAD.tsx'];

function importedAnywhere(basename: string, excluding: string): boolean {
  // grep the tree rather than reasoning about it — the point is what the code says, not what the
  // layout implies.
  const out = execSync(
    `grep -rl "${basename}" --include=*.tsx --include=*.ts components app lib 2>/dev/null || true`,
    { cwd: process.cwd(), encoding: 'utf8' },
  );
  return out
    .split('\n')
    .filter(Boolean)
    .some(
      (f) =>
        !f.includes(excluding) &&
        !f.includes('__tests__') &&
        !DEAD_FILES.some((dead) => f.includes(dead)),
    );
}

describe('the live settings sidebar', () => {
  const src = readFileSync(join(process.cwd(), LIVE_SIDEBAR), 'utf8');

  it('is the one the editor mounts', () => {
    expect(importedAnywhere('template-settings-panel/sidebar-settings', LIVE_SIDEBAR)).toBe(true);
  });

  // The panel this test was written for. Named explicitly because a generic "some panel exists"
  // assertion would have passed while the button was in the dead file.
  it('renders the site download panel', () => {
    expect(src).toMatch(/<TakeItWithYouPanel/);
  });
});

describe('every panel component is reachable', () => {
  const dir = join(process.cwd(), 'components/admin/templates/panels');
  const panels = readdirSync(dir).filter((f) => f.endsWith('.tsx'));

  it('scans a real set of panels (a scan matching nothing reports success)', () => {
    expect(panels.length).toBeGreaterThan(3);
  });

  // ⚠️ Match the BASENAME, not `panels/<name>`. The first version searched for the directory-
  // qualified path and reported `park-address-picker` orphaned — it is imported by a sibling as
  // `./park-address-picker`. A check that fires on correct code is the failure that teaches people
  // to ignore output, and this one nearly buried the single real finding below.
  // ⚠️ Reachable from NOTHING LIVE. Listed rather than deleted: removing UI is the owner's call,
  // and a named orphan is more useful than a silent one. `backdrop-panel` was on this list until
  // it was restored to the live sidebar — it had shipped as "an editor picker" and never rendered.
  // ⚠️ Two entries came off this list after checking rather than assuming: `mascot-panel` and
  // `screensaver-panel` ARE imported, by their own renderers (site-mascot / site-screensaver), so
  // "only the dead file references it" was wrong about them. I had already written them into the
  // dead file's header as stranded before running the check.
  const KNOWN_ORPHANS = new Set(['pages-panel.tsx', 'slug-panel.tsx']);

  it.each(panels.filter((f) => !KNOWN_ORPHANS.has(f)))('%s is imported by something', (file) => {
    const base = file.replace(/\.tsx$/, '');
    expect(importedAnywhere(base, `panels/${file}`)).toBe(true);
  });

  it('does not let the orphan list grow', () => {
    const stillOrphaned = panels.filter(
      (f) => !importedAnywhere(f.replace(/\.tsx$/, ''), `panels/${f}`),
    );
    expect(stillOrphaned.sort()).toEqual([...KNOWN_ORPHANS].sort());
  });
});

describe('the dead settings file stays dead', () => {
  it('is not imported by anything', () => {
    expect(importedAnywhere('template-settings-panel.DEAD', 'template-settings-panel.DEAD.tsx')).toBe(
      false,
    );
  });

  it('says so in its own first line, where an autocomplete will show it', () => {
    const src = readFileSync(
      join(process.cwd(), 'components/admin/templates/template-settings-panel.DEAD.tsx'),
      'utf8',
    );
    expect(src.split('\n')[0]).toMatch(/DEAD/);
  });
});
