// lib/creative/__tests__/creativeReview.test.ts
//
// The review surface's load-bearing rules: a link names ONE reviewer for ONE project; the thread
// is built from rows, not trusted from the client; the page is noindex and the feedback route
// never takes a name from the body (source guards — the defects are shapes, not return values).
import fs from 'node:fs';
import path from 'node:path';
import { mintReviewToken, verifyReviewToken, normalizeKey, OWNER_REVIEWER } from '@/lib/creative/reviewToken';
import { threadFeedback, nextVersion, type CreativeVersion, type Feedback } from '@/lib/creative/versions';
import { REVIEW_PROJECTS, reviewProject } from '@/lib/creative/projects';

const ROOT = path.resolve(__dirname, '../../..');
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');

describe('review token', () => {
  const OLD = process.env.CLAIM_TOKEN_SECRET;
  beforeAll(() => { process.env.CLAIM_TOKEN_SECRET = 'test-secret-for-review'; });
  afterAll(() => { process.env.CLAIM_TOKEN_SECRET = OLD; });

  it('round-trips a reviewer for its project and refuses every other project', () => {
    const t = mintReviewToken('bhard', { key: 'Daryle', name: 'Daryle' });
    expect(verifyReviewToken(t, 'bhard')).toEqual({ key: 'daryle', name: 'Daryle' });
    expect(verifyReviewToken(t, 'other-client')).toBeNull();
  });
  it('refuses a tampered or expired token', () => {
    const t = mintReviewToken('bhard', { key: 'amy', name: 'Amy' }, 1_000_000);
    expect(verifyReviewToken(t, 'bhard', 1_000_000 + 1)).not.toBeNull();
    expect(verifyReviewToken(t, 'bhard', 1_000_000 + 91 * 24 * 3600 * 1000)).toBeNull();
    expect(verifyReviewToken(t.slice(0, -2) + 'xx', 'bhard', 1_000_000)).toBeNull();
    expect(verifyReviewToken(null, 'bhard')).toBeNull();
  });
  it('normalises keys so a link minted for "Daryle " merges with daryle', () => {
    expect(normalizeKey(' Daryle ')).toBe('daryle');
    expect(OWNER_REVIEWER.key).toBe('owner');
  });
});

describe('threadFeedback', () => {
  const v: CreativeVersion = { id: 'v1', project: 'bhard', track: 'get-it-done', version: 2, kind: 'audio', title: 'Get It Done', url: 'https://x/v2.mp3', content_type: null, duration_seconds: 31.6, transcript: null, transcript_status: 'pending', notes: null, is_live: true, created_at: '2026-10-17T00:00:00Z' };
  const row = (p: Partial<Feedback>): Feedback => ({ id: 'f', version_id: 'v1', author_key: 'amy', author_name: 'Amy', vote: null, body: null, parent_id: null, created_at: '2026-10-17T00:00:00Z', ...p });

  it('separates votes from comments and nests replies under their parent', () => {
    const t = threadFeedback(v, [
      row({ id: 'a', vote: 'up' }),
      row({ id: 'b', author_key: 'daryle', author_name: 'Daryle', vote: 'down' }),
      row({ id: 'c', author_key: 'daryle', author_name: 'Daryle', body: 'Drop the team line', created_at: '2026-10-17T01:00:00Z' }),
      row({ id: 'd', author_key: 'owner', author_name: 'Sandon', body: 'Done in v3', parent_id: 'c', created_at: '2026-10-17T02:00:00Z' }),
      row({ id: 'other', version_id: 'v9', body: 'not mine' }),
    ]);
    expect(t.up).toEqual(['Amy']);
    expect(t.down).toEqual(['Daryle']);
    expect(t.comments.map((c) => c.id)).toEqual(['c']);
    expect(t.comments[0].replies.map((r) => r.id)).toEqual(['d']);
  });
  it('shows an orphan reply rather than dropping it', () => {
    const t = threadFeedback(v, [row({ id: 'r', body: 'reply to a deleted note', parent_id: 'gone' })]);
    expect(t.comments.map((c) => c.id)).toEqual(['r']);
  });
  it('numbers the next take per track', () => {
    const ex = [{ track: 'get-it-done', version: 2 }, { track: 'bhard-jingle', version: 1 }];
    expect(nextVersion(ex, 'get-it-done')).toBe(3);
    expect(nextVersion(ex, 'pool-spot')).toBe(1);
  });
});

describe('projects', () => {
  it('every project has reviewers and tracks with unique keys', () => {
    for (const p of REVIEW_PROJECTS) {
      expect(p.reviewers.length).toBeGreaterThan(0);
      expect(new Set(p.tracks.map((t) => t.key)).size).toBe(p.tracks.length);
      expect(reviewProject(p.key.toUpperCase())).toBe(p);
    }
  });
});

describe('source guards', () => {
  it('the review page is noindex and never renders takes without an identity', () => {
    const src = read('app/review/[project]/page.tsx');
    expect(src).toMatch(/robots:\s*\{\s*index:\s*false/);
    expect(src).toMatch(/if \(!viewer\)/);
  });
  it('the feedback route stamps identity from the session or the token, never from the body', () => {
    const src = read('app/api/review/[project]/route.ts');
    expect(src).toMatch(/verifyReviewToken\(/);
    expect(src).toMatch(/getAdminUser\(/);
    // Any read of a name/author field from the body would be the defect.
    expect(src).not.toMatch(/body\.(author|name|authorName|author_name|reviewer)/);
  });
  it('set-live walks blocks AND content_blocks, content AND props (§8), and republishes', () => {
    const src = read('app/api/admin/creative/[project]/set-live/route.ts');
    expect(src).toMatch(/\['blocks', 'content_blocks'\]/);
    expect(src).toMatch(/\['content', 'props'\]/);
    expect(src).toMatch(/republishIfPublished\(/);
    expect(src).toMatch(/commitTemplatePatch\(/);
    expect(src).not.toMatch(/\.from\('templates'\)\s*\.update\(/);
  });
  it('players never autoplay (matched as a JSX attribute, not as a word — the comment says it too)', () => {
    const src = read('app/review/[project]/review-client.tsx');
    expect(src).not.toMatch(/<(audio|video)[^>]*\bautoPlay\b/i);
    expect(src).toMatch(/<audio controls/);
  });
});
