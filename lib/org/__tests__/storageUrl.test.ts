// lib/org/__tests__/storageUrl.test.ts — a brand URL never carries an expiry (the 2026-10-16 logo outage).
import fs from 'node:fs';
import path from 'node:path';
import { isSignedStorageUrl, publicStorageUrl } from '@/lib/org/storageUrl';

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');
const SIGNED = 'https://kcwruliugwidsdgsrthy.supabase.co/storage/v1/object/sign/logos/orgs/d7d9/quicksites-logo-1760030188264.webp?token=eyJraWQiOi.abc.def';
const PUBLIC = 'https://kcwruliugwidsdgsrthy.supabase.co/storage/v1/object/public/logos/orgs/d7d9/quicksites-logo-1760030188264.webp';

describe('publicStorageUrl', () => {
  it('rewrites a signed URL on a public bucket to its public form and drops the token', () => {
    expect(publicStorageUrl(SIGNED)).toBe(PUBLIC);
  });
  it('leaves a public URL, a private-bucket signed URL, a foreign URL and null alone', () => {
    expect(publicStorageUrl(PUBLIC)).toBe(PUBLIC);
    const priv = SIGNED.replace('/sign/logos/', '/sign/resume-versions/');
    expect(publicStorageUrl(priv)).toBe(priv);
    expect(publicStorageUrl('https://example.com/logo.png')).toBe('https://example.com/logo.png');
    expect(publicStorageUrl(null)).toBeNull();
    expect(publicStorageUrl(undefined)).toBeUndefined();
    expect(publicStorageUrl('/brand/qs-mark.png')).toBe('/brand/qs-mark.png');
  });
  it('isSignedStorageUrl names the thing that will expire', () => {
    expect(isSignedStorageUrl(SIGNED)).toBe(true);
    expect(isSignedStorageUrl(PUBLIC)).toBe(false);
    expect(isSignedStorageUrl(null)).toBe(false);
  });
});

describe('the wiring (source guards)', () => {
  it('the upload helper stores a public URL for a public bucket and never a signed one', () => {
    const src = read('lib/org/orgAssetUpload.ts');
    expect(src).toMatch(/getBucket\(ORG_ASSETS_BUCKET\)/);
    expect(src).toMatch(/bucket\?\.public/);
    expect(src).not.toMatch(/Prefer a signed URL/);
  });
  it('every org-brand reader normalises on read (the rows already written carry tokens)', () => {
    for (const p of ['lib/org/resolveOrg.ts', 'lib/outreach/campaignBrand.ts', 'lib/partners/whiteLabel.ts', 'components/admin/AppHeader/AdminNavSections.tsx']) {
      expect(read(p)).toMatch(/publicStorageUrl\(/);
    }
  });
});
