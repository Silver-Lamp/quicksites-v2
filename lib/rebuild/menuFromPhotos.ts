// lib/rebuild/menuFromPhotos.ts
//
// Read a restaurant's menu from PHOTOS (the ones diners upload to Google/Yelp) with
// a vision model, into the SAME structured shape the URL-conversion path produces
// (parseMenu). This is what lets us auto-assemble a site for a business that has NO
// website — only a listing + menu photos. Everything downstream (assembleDraft →
// menu/location/hours/order_bar blocks) is reused unchanged.
//
// Prices read here are OCR GUESSES — the owner still confirms every price in the
// "Enable ordering" gate before anything is chargeable (see menu-editor).

import { getOpenAI, resolveModel } from '@/lib/ai/openaiClient';
import { meterLLMCall } from '@/lib/ai/meter';
import { parseMenu, type MenuSectionSpec } from '@/lib/rebuild/inferSiteSpec';

const ROUTE = '/api/import-listing';
const MAX_IMAGES = 6;
const MAX_CANDIDATES = 12;

/**
 * From a listing's photos, pick the ones that are actually MENUS — a cheap low-detail
 * vision pass so we don't need the operator to hand-supply menu photo URLs, and don't
 * waste high-detail OCR tokens on storefront/food shots. Returns the menu-image URLs
 * (empty if none look like menus). Metered.
 */
export async function pickMenuPhotos(imageUrls: string[], userId: string | null): Promise<string[]> {
  const urls = (imageUrls ?? []).filter((u) => typeof u === 'string' && u.trim()).slice(0, MAX_CANDIDATES);
  if (urls.length <= 1) return urls; // nothing to choose between

  const sys =
    'You are shown photos from a restaurant listing. Identify which images are MENUS — ' +
    'a readable list of dishes and/or prices (printed menu, menu board, chalkboard, menu ' +
    'page). Storefronts, plated food, interiors and people are NOT menus. Return JSON: ' +
    '{"menu":[<0-based indexes of the menu images>]}. Empty array if none.';
  const content: any[] = [
    { type: 'text', text: 'Which of these images are menus? Return their indexes.' },
    ...urls.map((url) => ({ type: 'image_url', image_url: { url, detail: 'low' } })),
  ];

  const parsed = await meterLLMCall<any>(
    { provider: 'openai', model_code: 'gpt-4o', modality: 'chat', user_id: userId, route: ROUTE },
    async () => {
      const openai = getOpenAI('chat');
      const r = await openai.chat.completions.create({
        model: resolveModel('gpt-4o', 'chat'),
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: sys },
          { role: 'user', content: content as any },
        ],
      });
      let out: any = {};
      try {
        out = JSON.parse(r.choices[0]?.message?.content || '{}');
      } catch {
        /* keep {} */
      }
      return { value: out, usage: { input_tokens: r.usage?.prompt_tokens, output_tokens: r.usage?.completion_tokens } };
    },
  );

  const idx = Array.isArray(parsed?.menu) ? parsed.menu : [];
  return idx
    .filter((i: unknown) => Number.isInteger(i) && (i as number) >= 0 && (i as number) < urls.length)
    .map((i: number) => urls[i]);
}

/**
 * Extract a structured menu from one or more menu images (public URLs or data: URLs
 * the model can read). Returns { sections } or undefined if nothing legible.
 * Metered; safe to call with non-menu images (they're ignored).
 */
export async function menuFromPhotos(
  imageUrls: string[],
  userId: string | null,
): Promise<{ sections: MenuSectionSpec[] } | undefined> {
  const urls = (imageUrls ?? []).filter((u) => typeof u === 'string' && u.trim()).slice(0, MAX_IMAGES);
  if (!urls.length) return undefined;

  const sys =
    'You read photographs of restaurant menus and output the menu as JSON. Use the ' +
    'EXACT dish names and prices as printed — never invent or round. Group items under ' +
    "the menu's own section headings (Breakfast, Appetizers, Entrées, Drinks, …). " +
    'Ignore any image that is not a menu (storefront, food plating, people). ' +
    'Return JSON: {"sections":[{"name":string,"items":[{"name":string,' +
    '"description":string,"price":string}]}]}. If no menu is legible, return {"sections":[]}.';

  const content: any[] = [
    { type: 'text', text: 'Extract the complete menu from these photo(s). Prices as short strings like "$14".' },
    ...urls.map((url) => ({ type: 'image_url', image_url: { url, detail: 'high' } })),
  ];

  const parsed = await meterLLMCall<any>(
    { provider: 'openai', model_code: 'gpt-4o', modality: 'chat', user_id: userId, route: ROUTE },
    async () => {
      const openai = getOpenAI('chat');
      const r = await openai.chat.completions.create({
        model: resolveModel('gpt-4o', 'chat'),
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: sys },
          { role: 'user', content: content as any },
        ],
      });
      let out: any = {};
      try {
        out = JSON.parse(r.choices[0]?.message?.content || '{}');
      } catch {
        /* keep {} */
      }
      return {
        value: out,
        usage: { input_tokens: r.usage?.prompt_tokens, output_tokens: r.usage?.completion_tokens },
      };
    },
  );

  // parseMenu cleans + drops empties, handling {sections} or a bare array.
  return parseMenu(parsed?.menu ?? parsed);
}
