// lib/editor/__tests__/newTemplateUrl.test.ts
//
// The flag itself, plus a source guard over every place that navigates into the editor after
// creating a template — six of them across four files today. The guard is the point: appending
// `?created=1` by hand is easy to get right once and impossible to keep right, and a path that
// misses it fails in the quietest way available (a drawer covering the hero on one route).

import fs from 'node:fs';
import path from 'node:path';
import {
  NEW_TEMPLATE_PARAM,
  newTemplateEditorUrl,
  consumeNewTemplateFlag,
} from '@/lib/editor/newTemplateUrl';
import { stripComments } from '@/test/stripComments';

const repo = path.resolve(__dirname, '../../..');

describe('newTemplateEditorUrl', () => {
  it('builds both editor shapes with the flag', () => {
    expect(newTemplateEditorUrl('abc')).toBe('/admin/templates/abc?created=1');
    expect(newTemplateEditorUrl('abc', { edit: true })).toBe('/admin/templates/abc/edit?created=1');
  });

  it('encodes the id rather than interpolating it raw', () => {
    expect(newTemplateEditorUrl('a/b?c')).toBe('/admin/templates/a%2Fb%3Fc?created=1');
  });
});

describe('consumeNewTemplateFlag', () => {
  const setUrl = (href: string) => {
    window.history.replaceState({}, '', href);
  };

  it('is true once, then false — reading it strips the param', () => {
    setUrl('/admin/templates/abc/edit?created=1');
    expect(consumeNewTemplateFlag()).toBe(true);
    expect(window.location.search).toBe('');
    // A refresh of the stripped URL is an ordinary editor load.
    expect(consumeNewTemplateFlag()).toBe(false);
  });

  it('leaves other params alone while stripping its own', () => {
    setUrl('/admin/templates/abc/edit?created=1&walkthrough=1&tab=seo');
    expect(consumeNewTemplateFlag()).toBe(true);
    const q = new URLSearchParams(window.location.search);
    expect(q.get(NEW_TEMPLATE_PARAM)).toBeNull();
    // ⚠️ The walkthrough is a separate mechanism and must survive — stripping the whole query
    // would silently disable onboarding for every newly created site.
    expect(q.get('walkthrough')).toBe('1');
    expect(q.get('tab')).toBe('seo');
  });

  it('is false on an ordinary editor load', () => {
    setUrl('/admin/templates/abc/edit');
    expect(consumeNewTemplateFlag()).toBe(false);
  });

  it('ignores a value that is not exactly 1', () => {
    setUrl('/admin/templates/abc/edit?created=0');
    expect(consumeNewTemplateFlag()).toBe(false);
    setUrl('/admin/templates/abc/edit?created=true');
    expect(consumeNewTemplateFlag()).toBe(false);
  });
});

// ── Source guards ───────────────────────────────────────────────────────────────────────────

describe('creation paths go through the helper', () => {
  // Every file that navigates into the editor right after creating a template.
  const CREATION_FILES = [
    'app/admin/templates/new/page.tsx',
    'components/home/guest-start.tsx',
    'components/admin/templates/start/start-your-site.tsx',
    'components/admin/templates/templates-card-grid.tsx',
  ];

  it.each(CREATION_FILES)('%s uses newTemplateEditorUrl', (rel) => {
    const src = stripComments(fs.readFileSync(path.join(repo, rel), 'utf8'));
    expect(src).toContain('newTemplateEditorUrl');
  });

  it.each(CREATION_FILES)('%s hand-rolls no editor URL', (rel) => {
    const src = stripComments(fs.readFileSync(path.join(repo, rel), 'utf8'));
    // A navigation whose target is a template-editor URL built inline, e.g.
    // `router.push(\`/admin/templates/${id}/edit\`)`. Static paths like
    // '/admin/templates/new' and '/admin/templates/list' are not editor URLs and are fine.
    const handRolled = /(?:router\.(?:push|replace)|location\.(?:assign|href\s*=))\s*\(?\s*`\/admin\/templates\/\$\{/g;
    expect(src.match(handRolled)).toBeNull();
  });

  it('scans a non-empty set of real files', () => {
    // ⚠️ A sweep that matches nothing reports success. If these files are renamed the guard must
    // fail rather than quietly pass over an empty list.
    expect(CREATION_FILES.length).toBeGreaterThanOrEqual(4);
    for (const rel of CREATION_FILES) {
      expect(fs.existsSync(path.join(repo, rel))).toBe(true);
    }
  });
});

describe('the editor consumes the flag and does not persist the auto-close', () => {
  const rel = 'components/admin/templates/template-action-toolbar/TemplateActionToolbar.tsx';
  const src = stripComments(fs.readFileSync(path.join(repo, rel), 'utf8'));

  it('closes the pages tray on a newly created template', () => {
    expect(src).toContain('consumeNewTemplateFlag()');
    expect(src).toContain('setPageMgrOpen(false)');
  });

  // ⚠️ The invariant worth pinning: creating ONE site must not turn the tray off everywhere.
  // The persist effect writes on every change, so the auto-close needs an explicit skip.
  it('guards the localStorage write so the auto-close is not saved as a preference', () => {
    const effect = src.match(/autoClosedRef\.current[\s\S]{0,400}?qs:toolbar:pageMgrOpen/);
    expect(effect).not.toBeNull();
  });

  // ⚠️ THE SHAPE WAS NEVER THE PROBLEM. The first version of this guard asserted only that
  // `if (autoClosedRef.current)` existed — it did, and the preference was clobbered anyway,
  // because on mount the persist effect runs while pageMgrOpen is still `true` and consumed
  // the flag on that pass. Found by reading localStorage in a real browser, not here. The
  // guard must therefore pin the VALUE check, which is the part that makes it work.
  it('consumes the flag on the true->false transition, not on the mount pass', () => {
    expect(src).toMatch(/if \(autoClosedRef\.current && pageMgrOpen === false\)/);
    expect(src).not.toMatch(/if \(autoClosedRef\.current\)\s*\{/);
  });
});
