'use client';

// components/admin/templates/render-blocks/neighborhood-stay.tsx
//
// Short-term-rental listing — a sibling of listing_card tuned for stays (nightly price,
// guests, amenities, min/max-stay) with the novel "hear the host describe this place" hook.
// The PorchHearth mesh seam (crosstalk/contracts/neighborhood-stay-embed.md): v1 renders from
// INLINE content (works today — a host can build their rental site on QS now); when PorchHearth
// deploys its public property/availability/booking endpoints, the CTA upgrades from "inquire" to
// a live "book" wired to their engine (Property shape maps ~1:1 onto this block's fields).
//
// Host voice: `host_audio_url` (a direct MP3 — the future Property.hostAudioUrl / an HJ About That
// render) plays in a native <audio>; OR an `about_that_embed_id` uses the QS About That player.
// The block is a PLAYER only — it renders no audio (HJ owns the voice/consent rail).

import * as React from 'react';
import type { Block } from '@/types/blocks';
import { AboutThatEmbed, isValidEmbedId } from './about-that';
import NeighborhoodStayBooking from '@/components/site/neighborhood-stay-booking';

type Props = {
  block?: Block;
  content?: Block['content'];
  previewOnly?: boolean;
};

const str = (v: any): string => (typeof v === 'string' ? v : v == null ? '' : String(v));
const priceDigits = (price: string): number | null => {
  const n = Number(price.replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
};

export default function RenderNeighborhoodStay({ block, content }: Props) {
  const c: any = content ?? block?.content ?? (block as any)?.props ?? {};
  const title = str(c.title);
  const address = str(c.address);
  const pricePerNight = str(c.price_per_night);
  const beds = str(c.beds);
  const bathrooms = str(c.bathrooms);
  const maxGuests = str(c.max_guests);
  const minStay = str(c.min_stay);
  const maxStay = str(c.max_stay);
  const description = str(c.description);
  const cancellation = str(c.cancellation);
  const ctaText = str(c.cta_text) || 'Check availability';
  const ctaLink = str(c.cta_link) || '#contact';
  const amenities: string[] = Array.isArray(c.amenities) ? c.amenities.filter((a: any) => typeof a === 'string' && a) : [];
  const images: string[] = Array.isArray(c.images) ? c.images.filter((u: any) => typeof u === 'string' && u) : [];
  const hostAudioUrl = str(c.host_audio_url);
  const embedId = str(c.about_that_embed_id);
  const embedWidth = str(c.about_that_width);
  // When bound to a live PorchHearth property, render the availability + booking form instead of
  // the inline inquire CTA (crosstalk/contracts/neighborhood-stay-embed.md).
  const propertyId = str(c.porchhearth_property_id);
  const siteRef = str(c.site_ref);
  const numOr = (v: string): number | undefined => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  };

  const [mainIdx, setMainIdx] = React.useState(0);
  const main = images[Math.min(mainIdx, Math.max(0, images.length - 1))];

  // Host-voice rail: when bound to a PorchHearth property with no inline audio, pull the property's
  // SERVED hostAudioUrl (crosstalk/contracts/neighborhood-stay-embed.md) so the host voice "rides
  // along" from PorchHearth to every surface from one field. Best-effort; silent if unavailable.
  const [servedHostAudio, setServedHostAudio] = React.useState('');
  React.useEffect(() => {
    if (!propertyId || hostAudioUrl) return;
    let alive = true;
    fetch(`/api/porchhearth/properties/${encodeURIComponent(propertyId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((p) => { if (alive && p && typeof p.hostAudioUrl === 'string') setServedHostAudio(p.hostAudioUrl.trim()); })
      .catch(() => {});
    return () => { alive = false; };
  }, [propertyId, hostAudioUrl]);
  const effectiveHostAudio = hostAudioUrl || servedHostAudio;

  const stats = [
    beds && { icon: '🛏', label: `${beds} bd` },
    bathrooms && { icon: '🛁', label: `${bathrooms} ba` },
    maxGuests && { icon: '👥', label: `Sleeps ${maxGuests}` },
  ].filter(Boolean) as Array<{ icon: string; label: string }>;

  const stayNote = [minStay && `${minStay}-night min`, maxStay && `${maxStay}-night max`].filter(Boolean).join(' · ');

  // Structured data for a lodging listing (only with an address; price when parseable).
  const jsonLd = address
    ? {
        '@context': 'https://schema.org',
        '@type': 'LodgingBusiness',
        name: title || address,
        ...(description ? { description } : {}),
        address,
        ...(images.length ? { image: images } : {}),
        ...(priceDigits(pricePerNight) != null
          ? { priceRange: `$${priceDigits(pricePerNight)}/night` }
          : {}),
      }
    : null;

  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-8">
      {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />}
      <div className="overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-sm md:flex">
        {/* Gallery */}
        <div className="md:w-1/2">
          {main ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={main} alt={title || address || 'Rental photo'} className="h-64 w-full object-cover md:h-80" />
          ) : (
            <div className="flex h-64 w-full items-center justify-center bg-muted text-5xl md:h-80" aria-hidden>
              🏡
            </div>
          )}
          {images.length > 1 && (
            <div className="flex gap-1.5 overflow-x-auto p-2">
              {images.slice(0, 6).map((u, i) => (
                <button
                  key={`${u}-${i}`}
                  type="button"
                  onClick={() => setMainIdx(i)}
                  className={`h-14 w-20 shrink-0 overflow-hidden rounded-md border ${i === mainIdx ? 'border-primary' : 'border-border opacity-80 hover:opacity-100'}`}
                  aria-label={`Photo ${i + 1}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={u} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Details */}
        <div className="flex flex-1 flex-col gap-3 p-6 md:p-8">
          {pricePerNight && (
            <div className="text-2xl font-bold tabular-nums">
              {pricePerNight}
              <span className="text-sm font-normal text-muted-foreground"> / night</span>
            </div>
          )}
          {title && <h2 className="text-xl font-semibold tracking-tight">{title}</h2>}
          {address && <div className="text-sm text-muted-foreground">{address}</div>}

          {stats.length > 0 && (
            <div className="flex flex-wrap items-center gap-4 text-sm font-medium">
              {stats.map((s) => (
                <span key={s.label} className="inline-flex items-center gap-1.5">
                  <span aria-hidden>{s.icon}</span> {s.label}
                </span>
              ))}
            </div>
          )}

          {description && <p className="text-sm leading-relaxed text-foreground/90">{description}</p>}

          {amenities.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {amenities.map((a) => (
                <span key={a} className="rounded-full border border-border bg-muted/50 px-2.5 py-0.5 text-xs text-foreground/80">
                  {a}
                </span>
              ))}
            </div>
          )}

          {/* The hook: hear the host describe the place. Direct/served audio wins; else the QS About That player. */}
          {effectiveHostAudio ? (
            <div className="mt-1">
              <div className="mb-1 text-xs font-medium text-muted-foreground">🎙️ Hear the host describe this place</div>
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <audio controls preload="none" src={effectiveHostAudio} className="w-full max-w-md" />
            </div>
          ) : isValidEmbedId(embedId) ? (
            <div className="mt-1">
              <div className="mb-1 text-xs font-medium text-muted-foreground">🎙️ Hear the host describe this place</div>
              <AboutThatEmbed embedId={embedId} width={embedWidth} />
            </div>
          ) : null}

          {stayNote && <div className="text-xs text-muted-foreground">{stayNote}</div>}

          <div className="mt-auto space-y-2 pt-2">
            {propertyId ? (
              <NeighborhoodStayBooking
                propertyId={propertyId}
                siteRef={siteRef || undefined}
                maxGuests={numOr(maxGuests)}
                minStay={numOr(minStay)}
                maxStay={numOr(maxStay)}
              />
            ) : (
              <a
                href={ctaLink}
                className="inline-flex rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow transition hover:opacity-90"
              >
                {ctaText}
              </a>
            )}
            {cancellation && <div className="text-xs text-muted-foreground">{cancellation}</div>}
          </div>
        </div>
      </div>
    </section>
  );
}
