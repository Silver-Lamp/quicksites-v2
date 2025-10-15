'use client';
import * as React from "react";
import QRCode from "react-qr-code";
import DownloadQR from "@/components/qr/DownloadQR";
import type { CandidateHero } from "@/lib/blocks/candidate/schemas";
import type { Entitlements, FeatureCode } from "@/lib/electinfo/features";
import { Lock } from "lucide-react";

export function CandidateHeroBlock({
  content,
  entitlements,
  siteId,
  slug,
}: {
  content: CandidateHero;
  entitlements?: Entitlements;   // optional: when provided, we reflect gating
  siteId?: string;               // for notify payload
  slug?: string;                 // for notify payload
}) {
  const {
    photoUrl,
    name,
    office,
    city,
    tagline,
    url,
    shortUrl,
    ctaDonateHref,
    ctaVolunteerHref,
    showDownloadQR,
  } = content;

  const qrUrl = shortUrl || url;

  // If entitlements aren’t passed, default to "enabled" so we don’t accidentally hide CTAs.
  const donationsEnabled = entitlements ? !!entitlements.donations : true;
  const volunteerEnabled = entitlements ? !!entitlements.volunteer : true;

  async function notify(feature: FeatureCode) {
    try {
      await fetch("/api/electinfo/unlock-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feature, site_id: siteId, slug }),
      });
      alert("Thanks! We’ll notify the campaign.");
    } catch (e) {
      console.error(e);
      alert("Sorry, something went wrong.");
    }
  }

  const LockedButton = ({ label }: { label: string }) => (
    <button
      type="button"
      disabled
      className="inline-flex items-center gap-2 rounded-xl px-6 py-3 font-semibold
                 border border-white/10 bg-white/5 text-white/80
                 cursor-not-allowed opacity-70"
      aria-disabled="true"
    >
      <Lock className="h-4 w-4" />
      {label}
    </button>
  );

  const NotifyMini = ({ feature }: { feature: FeatureCode }) => (
    <button
      type="button"
      onClick={() => notify(feature)}
      className="inline-flex items-center rounded-lg border border-white/10 bg-white/5
                 px-3 py-2 text-xs font-medium text-white/90 hover:bg-white/10"
    >
      Notify
    </button>
  );

  // We show a locked version even if the href is missing, so users see what’s available.
  const showDonateRow = Boolean(ctaDonateHref) || !donationsEnabled;
  const showVolunteerRow = Boolean(ctaVolunteerHref) || !volunteerEnabled;

  return (
    <section className="relative overflow-hidden bg-indigo-50 py-16 dark:bg-indigo-950/30">
      <div className="mx-auto max-w-5xl px-4 text-center">
        <div className="mx-auto mb-8 flex flex-col items-center justify-center gap-6 md:flex-row md:gap-10">
          {photoUrl && (
            <img
              src={photoUrl}
              alt={`${name} headshot`}
              className="h-40 w-40 rounded-full object-cover shadow-md ring-4 ring-white dark:ring-gray-900"
            />
          )}
          <div className="flex flex-col items-center md:items-start">
            <h1 className="text-4xl font-extrabold md:text-5xl">{name}</h1>
            <p className="mt-1 text-base text-gray-700 dark:text-gray-200">
              {office} — {city}
            </p>
            {tagline && (
              <p className="mt-3 max-w-md text-center text-sm italic text-gray-600 dark:text-gray-300 md:text-left">
                “{tagline}”
              </p>
            )}
          </div>
          <div className="mt-2 flex flex-col items-center gap-2 md:mt-0">
            <div className="rounded-xl border bg-white p-3 dark:border-gray-700 dark:bg-gray-900">
              <QRCode value={qrUrl} size={96} />
            </div>
            <span className="text-xs text-gray-600 dark:text-gray-400">Scan to learn more</span>
            {showDownloadQR && (
              <div className="mt-3">
                <DownloadQR
                  value={qrUrl}
                  fileBaseName={name || 'qr'}
                  previewSize={128}    // small on-page
                  exportSize={1024}    // high-res export
                />
              </div>
            )}
          </div>
        </div>

        {/* Hero CTAs with gating awareness */}
        <div className="mt-4 flex flex-wrap justify-center gap-3 md:gap-4">
          {showDonateRow && (
            donationsEnabled && ctaDonateHref ? (
              <a
                href={ctaDonateHref}
                className="rounded-xl bg-indigo-600 px-6 py-3 font-semibold text-white hover:bg-indigo-700"
              >
                Contribute to Campaign
              </a>
            ) : (
              <div className="inline-flex items-center gap-2">
                <LockedButton label="Contribute to Campaign" />
                <NotifyMini feature="donations" />
              </div>
            )
          )}

          {showVolunteerRow && (
            volunteerEnabled && ctaVolunteerHref ? (
              <a
                href={ctaVolunteerHref}
                className="rounded-xl border border-indigo-600 px-6 py-3 font-semibold text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30"
              >
                Volunteer or Contact
              </a>
            ) : (
              <div className="inline-flex items-center gap-2">
                <LockedButton label="Volunteer or Contact" />
                <NotifyMini feature="volunteer" />
              </div>
            )
          )}
        </div>
      </div>
    </section>
  );
}
