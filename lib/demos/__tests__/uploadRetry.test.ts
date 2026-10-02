// Which upload failures are worth retrying. Written because one `fetch failed` aborted a real
// run and left storage ahead of the database.

import { isTransientUploadError } from '@/lib/demos/uploadRetry';

describe('isTransientUploadError', () => {
  it('retries transport failures', () => {
    for (const m of [
      'fetch failed',
      'TypeError: fetch failed',
      'socket hang up',
      'connect ETIMEDOUT 1.2.3.4:443',
      'read ECONNRESET',
      'getaddrinfo EAI_AGAIN db.supabase.co',
      'upstream returned 503',
    ]) {
      expect(isTransientUploadError(m)).toBe(true);
    }
  });

  // ⚠️ Retrying a rejection the server MEANT just delays the same error by three waits and
  // buries the cause under "after retries".
  it('does NOT retry a rejection the server meant', () => {
    for (const m of [
      'Payload too large',
      'Invalid JWT',
      'new row violates row-level security policy',
      'mime type image/webp is not supported',
      'Duplicate',
    ]) {
      expect(isTransientUploadError(m)).toBe(false);
    }
  });
});
