// lib/home/flyThrough.ts
//
// Constants for the homepage showcase fly-through, in a PLAIN module on purpose.
//
// ⚠️ These used to live in components/home/site-fly-through.tsx, a 'use client' file, and
// app/page.tsx (a server component) imported FLY_COUNT from there. Across the server→client
// boundary a non-component export is NOT the value — it is a client-reference proxy object — so
// `sites.slice(0, FLY_COUNT)` became `slice(0, {object})` → `slice(0, NaN)` → `[]`, the component
// returned null, and the layer was absent from production while every test passed (2026-10-06,
// found by grepping the served HTML for the layer). Values shared by server and client code go
// in a module with no directive.

export const FLY_COUNT = 5;

export type FlySite = { slug: string; name: string; industry: string | null };

/** Where each card starts (near the vanishing point) and drifts to, as % of the viewport. */
export const FLY_LANES: ReadonlyArray<{ x0: number; y0: number; x1: number; y1: number; seconds: number }> = [
  { x0: -4, y0: -6, x1: -34, y1: -26, seconds: 18 },
  { x0: 6, y0: -2, x1: 36, y1: -18, seconds: 21 },
  { x0: -8, y0: 6, x1: -30, y1: 28, seconds: 19 },
  { x0: 9, y0: 5, x1: 32, y1: 26, seconds: 22 },
  { x0: 0, y0: 1, x1: 2, y1: 8, seconds: 24 },
];
