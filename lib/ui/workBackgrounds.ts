// lib/ui/workBackgrounds.ts
//
// Curated decorative backgrounds for the admin work surface (the chrome/sidebar
// area — never the site-in-progress canvas, which paints its own opaque surface).
// Shared by the picker (profile) and the fixed background layer (admin chrome).
// The preference is stored client-side in localStorage — no DB migration needed.

export const WORK_BG_STORAGE_KEY = 'qs:work-bg';
export const WORK_BG_CHANGED_EVENT = 'qs:work-bg:changed';

export type WorkBackground = {
  id: string;
  label: string;
  src: string;
  /** 0–1 image opacity over the dark base; keeps text readable on top. */
  opacity: number;
};

export const WORK_BACKGROUNDS: WorkBackground[] = [
  { id: 'nautical-chart', label: 'Nautical chart', src: '/backgrounds/work/nautical-chart.jpg', opacity: 0.16 },
  { id: 'compass-map', label: 'Compass & map', src: '/backgrounds/work/compass-map.jpg', opacity: 0.14 },
  { id: 'open-book-wood', label: 'Open book', src: '/backgrounds/work/open-book-wood.jpg', opacity: 0.14 },
  { id: 'chalkboard', label: 'Chalkboard desk', src: '/backgrounds/work/chalkboard.jpg', opacity: 0.16 },
];

export function findWorkBackground(id: string | null | undefined): WorkBackground | null {
  if (!id || id === 'none') return null;
  return WORK_BACKGROUNDS.find((b) => b.id === id) ?? null;
}

/** Read the saved selection (browser only). Returns '' when none/unset. */
export function readWorkBackgroundId(): string {
  if (typeof window === 'undefined') return '';
  try {
    return window.localStorage.getItem(WORK_BG_STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

/** Persist the selection + broadcast so the live background layer updates. */
export function writeWorkBackgroundId(id: string): void {
  if (typeof window === 'undefined') return;
  try {
    if (!id || id === 'none') window.localStorage.removeItem(WORK_BG_STORAGE_KEY);
    else window.localStorage.setItem(WORK_BG_STORAGE_KEY, id);
    window.dispatchEvent(new CustomEvent(WORK_BG_CHANGED_EVENT, { detail: id || '' }));
  } catch {
    /* no-op */
  }
}
