'use client';

// components/admin/ppl-buy-and-attach.tsx
//
// One click from a suggestion to a live, tracked, forwarded number.
//
// `provision-number` already did the whole sequence — find a local number near the forward-to's
// area code, buy it, point voice + SMS at our webhooks, save it on the campaign, and text the
// business the one-time notice. It just had no button anywhere near the recommendation, so
// acting on a pick meant copying two fields into a form on another page.
//
// ⚠️ WHY BUY RATHER THAN REUSE A HELD NUMBER. Eight of the ten campaigns with a pick have no
// number on the account at all, and for the two that do, "is this held number local to that
// market?" is not answerable from what Twilio returns — `listTrackingNumbers` gives no locality
// or region, and digits alone are not enough: +1 938 800 3858 IS Cullman's area (938 overlays
// 256) and an exact area-code match would reject it. Rather than encode an overlay table I would
// be guessing at, buying asks Twilio for a number near the forward-to and lets it answer. The
// held-number case stays available through "Use this pick" → choose the number → Attach.
//
// ⚠️ THIS SPENDS MONEY AND TEXTS A STRANGER, so the confirm says both in plain words. A number is
// ~$1.15/mo recurring, and the notice is the first contact that business has ever had from us.
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function PplBuyAndAttach({
  campaignId,
  domain,
  forwardTo,
  businessName,
  enabled,
}: {
  campaignId: string;
  domain: string;
  forwardTo: string;
  businessName?: string | null;
  /** CALL_TRACKING_ENABLED. The route refuses anyway; this explains the refusal up front. */
  enabled: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function run() {
    if (
      !window.confirm(
        `Buy a Twilio number for ${domain} and forward it to ${businessName ?? 'this business'} at ${forwardTo}?\n\n` +
          `• Buys a real local number (~$1.15/month, recurring)\n` +
          `• Texts ${forwardTo} the one-time notice — their first contact from us\n` +
          `• They can reply STOP to end it`,
      )
    )
      return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch('/api/admin/prospects/geo-campaign/provision-number', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId, forwardTo }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || r.statusText);
      // ⚠️ Report what actually happened to the NOTICE too. An opted-out business gets the number
      // bought and the forward dropped — success and a silent non-delivery look identical
      // otherwise, and that is the case where a caller reaches nobody.
      const notice = j.notice?.sent
        ? 'notice sent'
        : `notice NOT sent (${j.notice?.reason ?? 'unknown'})`;
      // ⚠️ Say whether the SITE was updated too. Everything else can succeed while the page
      // keeps advertising the old phone — in which case the number produces no calls, the
      // campaign reads "0 calls", and the market looks dead. A silent partial success here is
      // the most expensive outcome, because it looks exactly like a working one.
      const site = j.site?.ok
        ? j.site.republished
          ? `site updated (${j.site.fields} field${j.site.fields === 1 ? '' : 's'})`
          : `site saved but NOT republished${j.site.warning ? ` — ${j.site.warning}` : ''}`
        : `⚠️ SITE NOT UPDATED${j.site?.warning ? ` — ${j.site.warning}` : ''}; run scripts/set-site-phone.mjs`;
      // ⚠️ Say it loudly when the number is not local. seatac-towing.com was given an OHIO
      // number because 206 was sold out and the old code fell back to "anywhere" without a
      // word. On a geo site the area code IS the pitch.
      const loc =
        j.locality && j.locality !== 'area_code'
          ? ` ⚠️ NOT a local area code (${j.locality}) — consider releasing and retrying`
          : '';
      setMsg(
        j.alreadyProvisioned
          ? `already had ${j.number}`
          : `bought ${j.number} → ${j.forwardTo ?? 'nobody (opted out)'}; ${notice}; ${site}${loc}`,
      );
      router.refresh();
    } catch (e: any) {
      setMsg(e?.message || 'failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={run}
        disabled={!enabled || busy || !forwardTo}
        title={
          enabled
            ? 'Buy a local number, point it here, and text the one-time notice'
            : 'Call tracking is off — set CALL_TRACKING_ENABLED=1 in Vercel production and redeploy'
        }
        className={
          enabled
            ? 'rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-50'
            : 'cursor-not-allowed rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground'
        }
      >
        {busy ? 'Buying…' : 'Buy number & attach'}
      </button>
      {msg ? <span className="text-xs text-muted-foreground">{msg}</span> : null}
    </span>
  );
}
