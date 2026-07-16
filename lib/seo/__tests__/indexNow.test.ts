import { submitToIndexNow, publicIndexUrl, indexNowKeyPath } from '@/lib/seo/indexNow';

// Obviously-fake, low-entropy fixture (not a real secret — satisfies the >=8 char length check).
const TEST_KEY = 'test-key-test-key';

describe('indexNow', () => {
  const OLD = process.env.INDEXNOW_KEY;
  afterEach(() => {
    process.env.INDEXNOW_KEY = OLD;
  });

  describe('publicIndexUrl', () => {
    it('prefers a custom domain', () => {
      expect(publicIndexUrl({ custom_domain: 'boston-towing.com', slug: 'x' })).toBe('https://boston-towing.com');
    });
    it('uses the delivered.menu url for listing drafts when the base domain is set', () => {
      const OLD_MENU = process.env.NEXT_PUBLIC_MENU_BASE_DOMAIN;
      process.env.NEXT_PUBLIC_MENU_BASE_DOMAIN = 'delivered.menu';
      // deliveredMenu reads the env at module load, so this asserts the shape, not the live value:
      const url = publicIndexUrl({ slug: 'lynns-diner', claim_source: 'listing_import' });
      // When the base domain isn't compiled in, we correctly return null rather than a relative /preview path.
      expect(url === null || url.startsWith('https://')).toBe(true);
      process.env.NEXT_PUBLIC_MENU_BASE_DOMAIN = OLD_MENU;
    });
    it('returns null for a plain platform site (no custom domain, not a menu draft)', () => {
      expect(publicIndexUrl({ slug: 'my-site', claim_source: 'guest_build' })).toBeNull();
    });
  });

  describe('submitToIndexNow', () => {
    it('is a no-op (returns []) with no key set', async () => {
      delete process.env.INDEXNOW_KEY;
      const fetchImpl = jest.fn();
      const res = await submitToIndexNow(['https://a.com/x'], fetchImpl as any);
      expect(res).toEqual([]);
      expect(fetchImpl).not.toHaveBeenCalled();
    });

    it('groups URLs by host and submits one request per host', async () => {
      process.env.INDEXNOW_KEY = TEST_KEY;
      const calls: any[] = [];
      const fetchImpl = jest.fn(async (_url: string, init: any) => {
        calls.push(JSON.parse(init.body));
        return { ok: true, status: 200 } as any;
      });
      const res = await submitToIndexNow(
        ['https://a.com/1', 'https://a.com/2', 'https://b.com/1', 'not-a-url'],
        fetchImpl as any,
      );
      expect(fetchImpl).toHaveBeenCalledTimes(2); // a.com + b.com; the bad URL is dropped
      const aReq = calls.find((c) => c.host === 'a.com');
      expect(aReq.urlList).toEqual(['https://a.com/1', 'https://a.com/2']);
      expect(aReq.key).toBe(TEST_KEY);
      expect(aReq.keyLocation).toBe(`https://a.com${indexNowKeyPath(TEST_KEY)}`);
      expect(res.every((r) => r.ok)).toBe(true);
    });

    it('never throws when fetch fails', async () => {
      process.env.INDEXNOW_KEY = TEST_KEY;
      const fetchImpl = jest.fn(async () => {
        throw new Error('network down');
      });
      const res = await submitToIndexNow(['https://a.com/x'], fetchImpl as any);
      expect(res).toEqual([{ host: 'a.com', ok: false, status: 0 }]);
    });
  });
});
