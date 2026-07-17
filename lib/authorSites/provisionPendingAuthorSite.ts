// lib/authorSites/provisionPendingAuthorSite.ts
//
// Post-login step for HJ Author Sites: if the browser carries a pending author-handoff
// cookie (set when the author opened their HJ join link), provision the reseller-
// branded storefront into the now-authenticated account. Mirrors claimPendingSiteDraft
// but for a fresh CREATE (not an ownership transfer). Best-effort: never throws, always
// clears the cookie. Returns the new template id so the caller can redirect the author
// straight into their editor.
import type { User } from '@supabase/supabase-js';
import { AUTHOR_HANDOFF_COOKIE, verifyAuthorHandoffToken } from '@/lib/authorSites/handoffToken';
import { provisionAuthorSite } from '@/lib/authorSites/provisionAuthorSite';

type CookieStore = {
  get(name: string): { value: string } | undefined;
  set(arg: { name: string; value: string; [k: string]: any }): void;
};

/** Returns the provisioned template id (created or pre-existing), or null if nothing was armed. */
export async function provisionPendingAuthorSite(
  user: User | null | undefined,
  store: CookieStore,
): Promise<string | null> {
  try {
    // Anonymous (guest) sessions can't own a reseller author site — only real users.
    if (!user || user.is_anonymous) return null;
    const token = store.get(AUTHOR_HANDOFF_COOKIE)?.value;
    if (!token) return null;
    store.set({ name: AUTHOR_HANDOFF_COOKIE, value: '', path: '/', maxAge: 0 });

    const payload = verifyAuthorHandoffToken(token);
    if (!payload) return null;

    // The sellable-artifacts export is authed with the author's HJ token, so we can't
    // fetch the catalog here — provision the branded shell (import lands later).
    const result = await provisionAuthorSite({ payload, ownerId: user.id });
    if (!result.ok) {
      console.error('[author-handoff] provision failed:', result.error);
      return null;
    }
    return result.templateId;
  } catch (e) {
    console.error('[author-handoff] provision threw:', (e as any)?.message || e);
    return null;
  }
}
