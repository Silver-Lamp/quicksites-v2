// components/sites/restaurant-initials.tsx
//
// The tile shown when a restaurant has no photo.
//
// ⚠️ A 🍽️ EMOJI NEXT TO A REAL STOREFRONT PHOTO READS AS BROKEN, NOT AS SPARSE. On the Renton apex
// one card was a photograph of the building and the next was a plate glyph on a grey square — and
// the honest reading of that, for a diner deciding whether this site is real, is "the second one
// failed to load." A directory of local businesses cannot afford to look half-loaded.
//
// ⚠️ AND IT MUST NOT INVENT A PICTURE. The obvious "fix" is a generated food image, which on a
// page listing REAL NAMED restaurants would assert a photograph of a business that never gave us
// one — rule 9's logic (crosstalk/contracts/painterly-backdrop.md) one layer up, the same reason
// the apex hero is an abstract still life rather than a plated dish. So: their initials, on a tint
// derived from their own name. Deterministic, free, and asserting nothing that is not already true.

function initialsOf(name: string): string {
  const words = name
    .replace(/[^A-Za-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    // Drop leading articles so "The Local 907" reads "L9" rather than "TL".
    .filter((w, i) => !(i === 0 && /^(the|a|an|el|la|los|las)$/i.test(w)));
  if (!words.length) return '·';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

/** Stable hue from the name, so a restaurant's tile is always the same colour. */
function hueOf(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return h;
}

export default function RestaurantInitials({ name }: { name: string }) {
  const hue = hueOf(name);
  return (
    <div
      className="flex h-full w-full items-center justify-center"
      // Low-saturation tint + a readable ink of the same hue: legible on either theme without a
      // `dark:` variant, which is unreliable on tenant sites (the app chrome pins `.dark`).
      style={{ backgroundColor: `hsl(${hue} 45% 88%)`, color: `hsl(${hue} 55% 28%)` }}
      aria-hidden
    >
      <span className="text-3xl font-bold tracking-tight">{initialsOf(name)}</span>
    </div>
  );
}
