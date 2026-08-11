// components/admin/templates/render-blocks/location.tsx
'use client';

import * as React from 'react';

// Location card for local businesses (restaurants especially): address, a big
// tap-to-call phone, a "Get Directions" button, and an optional keyless Google Maps
// embed. Mobile-first — the phone + directions are thumb-sized primary actions.

function telHref(phone: string) {
  const digits = (phone || '').replace(/[^\d+]/g, '');
  return digits ? `tel:${digits}` : '';
}

function directionsHref(content: any): string {
  if (content.directions_url) return String(content.directions_url);
  const q = String(content.map_query || content.address || '').trim();
  return q ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}` : '';
}

function mapEmbedSrc(content: any): string {
  const q = String(content.map_query || content.address || '').trim();
  return q ? `https://maps.google.com/maps?q=${encodeURIComponent(q)}&output=embed` : '';
}

export default function RenderLocation(props: any) {
  const content: any = props?.block?.content ?? props?.content ?? props ?? {};
  const title: string = content.title || 'Find Us';
  const name: string = content.business_name || '';
  const address: string = content.address || '';
  const hint: string = content.find_us_hint || '';
  const phone: string = content.phone || '';
  const email: string = content.email || '';
  const showMap: boolean = content.show_map !== false;

  const tel = telHref(phone);
  const dir = directionsHref(content);
  const map = showMap ? mapEmbedSrc(content) : '';

  if (!address && !phone && !map) {
    return (
      <section className="mx-auto max-w-3xl px-4 py-8 text-center text-sm text-muted-foreground">
        Add your address and phone number so customers can find and call you.
      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-10 sm:py-14">
      <div className="grid gap-6 md:grid-cols-2 md:items-stretch">
        <div className="flex flex-col justify-center">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h2>
          {name && <p className="mt-1 text-lg font-medium">{name}</p>}

          {address && (
            <p className="mt-3 whitespace-pre-line text-muted-foreground">{address}</p>
          )}

          {/* The human directions, under the address it corrects. Absent unless the owner wrote
              one — see find_us_hint in the schema for why it is never generated. */}
          {hint && (
            <p className="mt-1 text-sm font-medium text-foreground">{hint}</p>
          )}

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            {tel && (
              <a
                href={tel}
                className="inline-flex items-center justify-center rounded-lg bg-primary px-5 py-3 text-base font-semibold text-primary-foreground transition hover:opacity-90"
              >
                📞 {phone}
              </a>
            )}
            {dir && (
              <a
                href={dir}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center rounded-lg border border-border px-5 py-3 text-base font-semibold transition hover:bg-muted"
              >
                Get Directions →
              </a>
            )}
          </div>

          {email && (
            <a href={`mailto:${email}`} className="mt-4 text-sm text-muted-foreground underline underline-offset-2">
              {email}
            </a>
          )}
        </div>

        {map && (
          <div className="min-h-[240px] overflow-hidden rounded-2xl border border-border">
            <iframe
              title="Map"
              src={map}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="h-full min-h-[240px] w-full"
            />
          </div>
        )}
      </div>
    </section>
  );
}
