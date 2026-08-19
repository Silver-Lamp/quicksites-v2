import fs from 'node:fs';
import path from 'node:path';
import {
  downloadFilenameFor,
  formatsOf,
  isResumeFormat,
  storagePathFor,
  type ResumeVersion,
} from '../versions';

const LABEL = 'Indeed — Distinguished Engineer, AI';

describe('storagePathFor', () => {
  // ⚠️ THE LOAD-BEARING TEST. The whole feature rests on one property: a version's LABEL names the
  // company it was tailored for, and that name must be unable to reach a storage path. It is
  // unable to because there is no argument through which it could arrive — this test is what makes
  // that true tomorrow, when someone "helpfully" adds a readable path segment.
  it('takes no argument that could carry the label', () => {
    const p = storagePathFor('owner-1', 'ver-1', 'pdf');
    expect(p).toBe('owner-1/ver-1/resume.pdf');
    expect(storagePathFor.length).toBe(3);
    expect(p).not.toMatch(/indeed/i);
  });
});

describe('downloadFilenameFor', () => {
  // ⚠️ A résumé is forwarded — that is its purpose. A file named for the company it was tailored
  // to is the leak arriving by hand, as an attachment, to someone who was not that company.
  it('never leaks the tailoring target, even if a label is passed in', () => {
    expect(downloadFilenameFor('Sandon Jurowski', 'pdf')).toBe('Sandon-Jurowski-Resume.pdf');
    // Defensive: a future caller that wrongly passes the label still cannot emit a company-shaped
    // filename with punctuation intact — but the real guarantee is the call sites, asserted below.
    expect(downloadFilenameFor(LABEL, 'docx')).not.toContain('—');
    expect(downloadFilenameFor('', 'md')).toBe('Resume-Resume.md');
  });

  it('produces a safe filename for a header', () => {
    for (const name of ['Ann O’Neil', 'Zoë  Smith', '../../etc/passwd']) {
      const f = downloadFilenameFor(name, 'pdf');
      expect(f).not.toMatch(/["\\/\n\r]/);
    }
  });
});

describe('format helpers', () => {
  it('accepts only formats we are willing to serve', () => {
    expect(isResumeFormat('pdf')).toBe(true);
    expect(isResumeFormat('docx')).toBe(true);
    expect(isResumeFormat('exe')).toBe(false);
    expect(isResumeFormat('toString')).toBe(false); // not a prototype key
  });

  it('lists only formats a version actually has', () => {
    const v = {
      files: [
        { format: 'md', path: 'a', size_bytes: 1, content_type: 'text/markdown' },
        { format: 'pdf', path: 'b', size_bytes: 2, content_type: 'application/pdf' },
      ],
    } as unknown as ResumeVersion;
    expect(formatsOf(v)).toEqual(['pdf', 'md']);
  });
});

// ── Source guards ────────────────────────────────────────────────────────────────────────────
//
// These assert properties of the CODE, not of a return value, because that is where they can rot.
// A unit test cannot catch someone deleting a `.eq('is_public', true)`; reading the file can.

const repoRoot = path.resolve(__dirname, '../../..');
const read = (p: string) => fs.readFileSync(path.join(repoRoot, p), 'utf8');

describe('public download route', () => {
  const src = read('app/api/resume/[slug]/[format]/route.ts');

  it('is a non-empty file (a guard that scans nothing reports success)', () => {
    expect(src.length).toBeGreaterThan(500);
  });

  // ⚠️ Without this filter the route serves whatever version happens to come back first — which is
  // to say, it publishes a private document. It is one deleted line away at all times.
  it('requires is_public when resolving the version', () => {
    expect(src).toContain("'is_public', true");
  });

  // ⚠️ THE REGRESSION THIS EXISTS FOR (migration 20260830). The first cut resolved
  // `slug → owner → the owner's public version`, so all 2,227 templates that account owns served
  // the résumé, each under its own business name. Scoping must be to the SITE.
  it('matches on the site, never on the owner', () => {
    expect(src).toContain("'public_site_id', siteId");
    expect(src).not.toContain("'owner_id'");
    expect(src).not.toMatch(/owner_id.*resume_versions|resume_versions[\s\S]{0,200}owner_id/);
  });

  it('streams with a filename we control rather than redirecting to storage', () => {
    expect(src).toContain('content-disposition');
    expect(src).toContain('downloadFilenameFor');
    expect(src).not.toMatch(/createSignedUrl|getPublicUrl|NextResponse\.redirect/);
  });

  // ⚠️ Selecting `label` is fine; putting it in a response is not. This asserts the label never
  // reaches a header or a body on the public path.
  it('never emits the version label', () => {
    expect(src).not.toMatch(/filename="?\$\{[^}]*label/i);
    expect(src).not.toMatch(/json\(\{[^}]*label/i);
  });
});

describe('publishing requires naming a site', () => {
  // ⚠️ The tempting convenience — "no siteId? fall back to the owner's site" — is precisely the
  // 20260830 bug. A fallback here would restore it silently, so the absence is asserted.
  const src = read('app/api/verbatim/resumes/route.ts');
  it('has no owner fallback when siteId is missing', () => {
    expect(src).toContain('siteId');
    expect(src).not.toMatch(/siteId\s*\|\|\s*(gate\.user\.id|ownerId)/);
  });
});

describe('résumé tables are reached through the caller session, not the service role', () => {
  // ⚠️ CLAUDE.md §6's norm is service-role + route authorization, which is right for a menu and
  // wrong here: it would make every query *capable* of reading anyone's job search. The one
  // permitted exception is the public download route, whose caller is anonymous by definition.
  it('keeps supabaseAdmin out of the owner-facing DB reads', () => {
    const src = read('app/api/verbatim/resumes/route.ts');
    const dbLines = src
      .split('\n')
      .filter(
        (l) =>
          l.includes("from('resume_versions')") ||
          l.includes('await anyDb') ||
          l.includes('await (db as any)')
      );
    expect(dbLines.length).toBeGreaterThan(0);
    for (const line of dbLines) expect(line).not.toContain('supabaseAdmin');
    // Every USE of supabaseAdmin in this file must be a storage call — never a table read.
    // ⚠️ The import line is excluded deliberately: a check that fires on correct code trains you
    // to skip its output, which is the same silence-looks-like-success failure as a permanently
    // red CI row (CLAUDE.md §7). Asserted below that the exclusion still leaves something to scan.
    const uses = src
      .split('\n')
      .filter((l) => l.includes('supabaseAdmin') && !l.trimStart().startsWith('import'));
    expect(uses.length).toBeGreaterThan(0);
    for (const line of uses) expect(line).toMatch(/storage/);
  });
});
