// components/sites/admin-edit-pill.tsx
//
// A small "Edit in QuickSites" pill on a public tenant site, for an operator who is already
// logged in elsewhere and wants to jump into the editor for the site they're looking at.
//
// ── Why this isn't simply `{admin && <EditButton/>}` ─────────────────────────────────────
// Auth cookies here are HOST-ONLY (nothing configures a cookie domain). A session on
// www.quicksites.ai is not sent to starter-restaurant.delivered.menu, to a customer's custom
// domain, or even to <slug>.quicksites.ai — they're all different hosts. So on the surfaces
// where you'd most want this button, the server genuinely cannot tell an admin from a
// stranger. Rendering it from `admin` alone would work only at
// www.quicksites.ai/sites/<slug>, which is the one place you least need it.
//
// Two triggers, therefore:
//   • `admin` — true where the cookie IS visible. Zero friction, appears automatically.
//   • `?edit=1` — an explicit opt-in that works on ANY host.
//
// The pill is safe to show a stranger who stumbles onto `?edit=1`: it carries no template id
// and no account data. It links to /admin/templates/resolve on the canonical host, which
// requires an admin session before it will resolve anything. Worst case a curious visitor
// gets a login screen.
//
// Deliberately NOT rendered when neither trigger is present, so a normal visitor's page is
// byte-identical to what it is today.

import { CANONICAL_ORIGIN } from '@/lib/site/canonicalOrigin';

export default function AdminEditPill({
  slug,
  host,
  admin,
  editParam,
}: {
  slug: string;
  host?: string | null;
  /** True only where the auth cookie reached this host (effectively the canonical origin). */
  admin: boolean;
  /** `?edit=1` — the universal fallback for every other host. */
  editParam: boolean;
}) {
  if (!admin && !editParam) return null;

  const href =
    `${CANONICAL_ORIGIN}/admin/templates/resolve` +
    `?slug=${encodeURIComponent(slug)}` +
    (host ? `&host=${encodeURIComponent(host)}` : '');

  return (
    <a
      href={href}
      // Bottom-LEFT: the "Hear this page" launcher already occupies bottom-left on public
      // pages, so this sits above it rather than overlapping. z-index clears both.
      className="fixed bottom-20 left-4 z-[60] inline-flex items-center gap-2 rounded-full border border-emerald-400/40 bg-zinc-900/90 px-3.5 py-2 text-xs font-medium text-emerald-300 shadow-lg backdrop-blur transition hover:border-emerald-400 hover:text-emerald-200"
      title="Open this site in the QuickSites editor (requires an admin session)"
    >
      <span aria-hidden>✎</span>
      Edit in QuickSites
    </a>
  );
}
