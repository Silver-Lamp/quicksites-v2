// lib/qr/sticker-presets.ts
// Common Avery / generic label presets for sticker sheet generation.
// Units are POINTS (1 in = 72 pt). Tweak margins/pitch a few points
// if your printer needs micro-alignment.
//
// Pair with:
//  - lib/qr/sticker.ts (raster, pdf-lib)
//  - app/api/qr/sticker-vector/route.ts (vector, pdfkit)

export type StickerPreset = {
    /** Identifier (e.g., "avery-5160") */
    id: string;
    /** Human-friendly label shown in UIs */
    label: string;
  
    /** Page size (points) — most US letter sheets are 8.5x11" */
    page: { width: number; height: number };
  
    /** Grid info */
    columns: number;
    rows: number;
  
    /** Individual label size (points) */
    labelWidth: number;
    labelHeight: number;
  
    /** Page margins to the first label’s top-left (points) */
    marginLeft: number;
    marginTop: number;
  
    /**
     * Pitch = center-to-center distance between labels.
     * For tightly packed labels, pitch ~= label size (+ gutter)
     */
    hPitch: number;
    vPitch: number;
  
    /**
     * When true, helper code may draw circular cut guides.
     * Useful for round labels (e.g., Avery 6450).
     */
    round?: boolean;
  };
  
  const LETTER = { width: 8.5 * 72, height: 11 * 72 };
  
  /**
   * Known-good presets. Margins/pitches closely match Avery specs,
   * but real printers can drift — adjust by ±2–3 pt if needed.
   */
  export const STICKER_PRESETS: StickerPreset[] = [
    {
      // Avery 5160 — Address Labels 1" x 2.625" (3 x 10 = 30 labels)
      id: "avery-5160",
      label: 'Avery 5160 — 1" × 2.625" (3×10)',
      page: LETTER,
      columns: 3,
      rows: 10,
      labelWidth: 2.625 * 72, // 2.625"
      labelHeight: 1 * 72,    // 1.0"
      marginLeft: 0.1875 * 72, // 3/16"
      marginTop: 0.5 * 72,     // 1/2"
      hPitch: 2.75 * 72,       // 2.75"
      vPitch: 1 * 72,          // 1.0"
    },
    {
      // Avery 5163 — Shipping Labels 2" x 4" (2 x 5 = 10 labels)
      id: "avery-5163",
      label: 'Avery 5163 — 2" × 4" (2×5)',
      page: LETTER,
      columns: 2,
      rows: 5,
      labelWidth: 4 * 72,
      labelHeight: 2 * 72,
      marginLeft: 0.15625 * 72, // ~5/32"
      marginTop: 0.5 * 72,
      hPitch: 4.1875 * 72,      // 4.1875"
      vPitch: 2 * 72,
    },
    {
      // Avery 6450 — Round 2.5" (3 x 4 = 12 circles)
      // Note: round = true draws circular cut guides in supported code.
      id: "avery-6450-round-2.5in",
      label: 'Avery 6450 — 2.5" Round (3×4)',
      page: LETTER,
      columns: 3,
      rows: 4,
      labelWidth: 2.5 * 72,    // diameter
      labelHeight: 2.5 * 72,   // diameter
      marginLeft: 0.5 * 72,
      marginTop: 0.5 * 72,
      hPitch: 2.75 * 72,       // center-to-center horizontally
      vPitch: 2.75 * 72,       // center-to-center vertically
      round: true,
    },
    {
      // Generic square 2" labels in a 3×5 grid with comfortable margins.
      id: "square-2in-3x5",
      label: 'Square 2" (3×5) • generic',
      page: LETTER,
      columns: 3,
      rows: 5,
      labelWidth: 2 * 72,
      labelHeight: 2 * 72,
      marginLeft: 0.5 * 72,
      marginTop: 0.5 * 72,
      hPitch: 2.5 * 72,
      vPitch: 2.5 * 72,
    },
  ];
  
  /** Convenience lookups */
  const _presetMap: Record<string, StickerPreset> = Object.fromEntries(
    STICKER_PRESETS.map((p) => [p.id, p])
  );
  
  /** Get a preset by id (throws if not found). */
  export function getPresetById(id: string): StickerPreset {
    const p = _presetMap[id];
    if (!p) throw new Error(`Unknown sticker preset: ${id}`);
    return p;
  }
  
  /** List presets for UI pickers. */
  export function listStickerPresets(): { id: string; label: string }[] {
    return STICKER_PRESETS.map(({ id, label }) => ({ id, label }));
  }
  