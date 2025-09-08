// components/admin/templates/render-blocks/service-areas.tsx
'use client';

import * as React from 'react';
import type { Block } from '@/types/blocks';

type Props = {
  block: Block;
  content?: Block['content'];
  /** When rendering inside the editor preview, pass the selected viewport */
  device?: 'mobile' | 'tablet' | 'desktop';
  /** Optional visual tweaks from caller */
  colorMode?: 'light' | 'dark';
  compact?: boolean;
};

function toStringArray(v: unknown): string[] {
  if (!v) return [];
  if (Array.isArray(v)) {
    return v
      .map((x) => (typeof x === 'string' ? x : (x && typeof x === 'object' ? String((x as any).name ?? (x as any).label ?? '') : '')))
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (typeof v === 'string') {
    return v.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

function normalize(block: Block, override?: any) {
  const src = (override ?? block?.content ?? {}) as any;
  const title = src.title ?? 'Our Service Areas';
  const subtitle = src.subtitle ?? src.sub_title ?? src.subHeading ?? '';
  // accept several aliases: cities | areas | service_areas | city_list
  const citiesRaw =
    src.cities ??
    src.areas ??
    src.service_areas ??
    src.city_list ??
    (block as any)?.props?.cities ??
    [];
  const dedup = Array.from(new Set(toStringArray(citiesRaw)));
  return { title, subtitle, cities: dedup };
}

export default function RenderServiceAreas({
  block,
  content,
  device,
  colorMode = 'dark',
  compact = false,
}: Props) {
  const { title, subtitle, cities } = React.useMemo(
    () => normalize(block, content),
    [block, content]
  );

  // Editor device forcing (when previewing mobile/tablet)
  const forcedMobile = device === 'mobile';
  const forcedTablet = device === 'tablet';
  const isNarrow = forcedMobile || forcedTablet;

  const bg =
    colorMode === 'light'
      ? 'bg-white text-gray-900'
      : 'bg-neutral-950 text-white';

  const subText = colorMode === 'light' ? 'text-gray-600' : 'text-neutral-300';

  // Typography & spacing scale by device/compact
  const titleCls = isNarrow || compact ? 'text-xl' : 'text-2xl';
  const itemText = isNarrow || compact ? 'text-base' : 'text-lg';
  const outerPad = isNarrow || compact ? 'py-6 px-3' : 'py-8 px-4';
  const gap = isNarrow || compact ? 'gap-2' : 'gap-3';

  // Grid columns adapt to editor device
  let gridCols = 'grid-cols-2 md:grid-cols-3'; // default behavior
  if (device === 'mobile') gridCols = 'grid-cols-1'; // force single column in mobile preview
  else if (device === 'tablet') gridCols = 'grid-cols-2';

  return (
    <section
      className={`${bg} rounded-lg ${outerPad}`}
      data-device={device || 'auto'}
    >
      <h2 className={`${titleCls} font-bold mb-2`}>{title}</h2>
      {subtitle ? (
        <p className={`mb-4 ${subText}`}>{subtitle}</p>
      ) : null}

      {cities.length ? (
        <div className={`grid ${gridCols} ${gap} ${itemText}`}>
          {cities.map((city) => (
            <div
              key={city}
              className="before:content-['•'] before:mr-2 before:opacity-70"
            >
              {city}
            </div>
          ))}
        </div>
      ) : (
        <div className={`${subText} italic`}>No service areas configured yet.</div>
      )}
    </section>
  );
}
