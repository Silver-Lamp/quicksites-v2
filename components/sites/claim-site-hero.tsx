// Presentational hero for the public claim landing (app/claim-site/[id]). Shows the
// "we already built it" pitch with an INLINE live preview of the real site (iframe), the
// value chips, urgency, and the two CTAs. Kept as its own component so it can be previewed
// in isolation. Server-safe (no client hooks).

const BASE_PERKS = ['Free hosting', 'Online ordering', 'Edit anytime', 'Live in minutes'];
// ⚠️ A trade has no order to take. "Online ordering" and "we earn when you sell" on a tow shop's
// pitch offer something the page cannot do (the same wrongness as "Is this your restaurant?");
// what a trade site does is let a customer request a quote or call in one tap.
const TRADE_PERKS = ['Free hosting', 'Request a quote in one tap', 'Edit anytime', 'Live in minutes'];

export default function ClaimSiteHero({
  name,
  previewHref,
  claimHref,
  urlLabel,
  brandName,
  brandLogoUrl,
  contactEmail,
  bookingUrl = null,
  feePercent,
  demandCount = 0,
  competition = false,
  isFood = true,
}: {
  /** Restaurants get the menu / ordering / take-rate pitch; every other trade gets the listing / quote pitch. */
  isFood?: boolean;
  name: string;
  /** What the iframe and "Open full preview" show — the site's real public address, never an editor surface. */
  previewHref: string;
  claimHref: string;
  /**
   * Only a first-to-claim competition may say "it goes to one business — claim it before a
   * competitor". A per-business draft is nobody's prize; that line on it is invented urgency.
   */
  competition?: boolean;
  /** Text shown in the fake browser URL bar above the preview (e.g. "slug.delivered.menu"). */
  urlLabel: string;
  /** Owning-org brand (e.g. "CedarSites"); shown as a "Built by" wordmark. Null → QuickSites default (no wordmark). */
  brandName?: string | null;
  brandLogoUrl?: string | null;
  /** "Questions? email us" contact, so a prospect can reach a human before claiming. */
  contactEmail?: string | null;
  /** "Or book 15 minutes" — a scheduling link; a calendar with a face behind it beats an inbox. */
  bookingUrl?: string | null;
  /** Menu-ordering sites: the concrete take-rate (e.g. 8) → states "keep {100-fee}%, no monthly". Null → generic copy. */
  feePercent?: number | null;
  /** Real order-intent already logged on this preview — the count (never PII) is the sharpest reason to claim now. */
  demandCount?: number;
}) {
  const hasFee = typeof feePercent === 'number' && feePercent > 0;
  const hasDemand = demandCount > 0;
  const keepPct = hasFee ? 100 - (feePercent as number) : null;
  const PERKS = hasFee
    ? ['Free hosting — no monthly', `Keep ${keepPct}% of every order`, 'Edit anytime', 'Live in minutes']
    : isFood
      ? BASE_PERKS
      : TRADE_PERKS;
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center px-6 py-14 text-center">
      {brandName && (
        <div className="mb-6 flex items-center gap-2 text-sm text-zinc-400">
          {brandLogoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={brandLogoUrl} alt={brandName} className="h-6 w-auto" />
          ) : (
            <span className="font-semibold text-zinc-200">{brandName}</span>
          )}
        </div>
      )}
      <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
        We already built it
      </span>
      <h1 className="mt-6 text-4xl font-extrabold tracking-tight sm:text-5xl">
        {name}’s new website is ready.
      </h1>
      {hasDemand && (
        <div className="mt-4 rounded-2xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-sm font-semibold text-amber-200">
          🔥 {demandCount} {demandCount === 1 ? 'person has' : 'people have'} already tried to order here —
          claim your site to start taking their orders.
        </div>
      )}
      <p className="mx-auto mt-4 max-w-xl text-lg text-zinc-400">
        {isFood ? (
          <>
            We assembled it from your public listing — your menu, hours, location, and online ordering.
            {hasFee
              ? ` Free hosting, no monthly fee — you keep ${keepPct}% of every order, we only take ${feePercent}% when you sell. Here it is:`
              : ' Free hosting; we only earn a small fee when you sell. Here it is:'}
          </>
        ) : (
          <>
            We built it from your public listing — name, phone, address and hours. Free to keep on its own
            address; your own .com is the one thing we charge for. Here it is:
          </>
        )}
      </p>

      {/* Inline live preview — the actual built site, so they see the value before signing up. */}
      <div className="mt-8 w-full overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-900 shadow-2xl">
        <div className="flex items-center gap-2 border-b border-zinc-800 bg-zinc-950/80 px-4 py-2">
          <span className="h-3 w-3 rounded-full bg-red-400/70" />
          <span className="h-3 w-3 rounded-full bg-amber-400/70" />
          <span className="h-3 w-3 rounded-full bg-emerald-400/70" />
          <span className="ml-3 truncate rounded-md bg-zinc-800 px-3 py-1 text-xs text-zinc-400">{urlLabel}</span>
        </div>
        <iframe src={previewHref} title={`${name} preview`} loading="lazy" className="h-[460px] w-full bg-white" />
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        {PERKS.map((p) => (
          <span key={p} className="rounded-full border border-zinc-700 bg-zinc-800/50 px-3 py-1 text-xs font-medium text-zinc-300">
            ✓ {p}
          </span>
        ))}
      </div>

      <div className="mt-7 flex flex-col gap-3 sm:flex-row">
        <a
          href={previewHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center rounded-2xl border border-zinc-700 px-6 py-3 text-base font-semibold text-zinc-200 transition hover:bg-zinc-800/60"
        >
          Open full preview ↗
        </a>
        <a
          href={claimHref}
          className="inline-flex items-center justify-center rounded-2xl bg-emerald-500 px-6 py-3 text-base font-semibold text-emerald-950 transition hover:opacity-90"
        >
          Claim it free →
        </a>
      </div>

      {competition ? (
        <p className="mt-5 text-sm text-amber-400/90">
          This is a premium local domain — it goes to <b>one</b> business. Claim it before a competitor does.
        </p>
      ) : (
        <p className="mt-5 text-sm text-zinc-400">
          Built from your public listing — name, phone, address and hours. Nothing else. Don’t want it? Say the word and it’s gone.
        </p>
      )}
      <p className="mt-2 text-sm text-zinc-500">
        Claiming creates your account and makes this site yours to edit and publish.
      </p>
      {(contactEmail || bookingUrl) && (
        <p className="mt-6 text-sm text-zinc-500">
          {contactEmail && (
            <>
              Questions? Email{' '}
              <a href={`mailto:${contactEmail}`} className="text-sky-400 underline underline-offset-4">
                {contactEmail}
              </a>
            </>
          )}
          {contactEmail && bookingUrl && <>{' '}· </>}
          {bookingUrl && (
            <>
              Prefer to talk?{' '}
              <a href={bookingUrl} target="_blank" rel="noopener noreferrer" className="text-sky-400 underline underline-offset-4">
                Book 15 minutes
              </a>
            </>
          )}
        </p>
      )}
    </main>
  );
}
