import * as React from 'react';
import { FOOD_ICONS, matchFoodIcon, type MenuIconSet } from '@/lib/menu/foodIcons';

/**
 * The icon in front of a menu item.
 *
 * ⚠️ RENDERS NOTHING WHEN NOTHING FITS, and that is the feature. An unmatched dish gets no
 * icon, no placeholder, no question mark — the row simply looks like it did before. A
 * placeholder would be a visible admission of ignorance on a page presenting as the business's
 * own, and a wrong icon would be a small false claim about their food. Both are worse than a
 * plain row. (Same rule as an ungenerated backdrop painting no layer at all.)
 *
 * Decorative by definition, so `aria-hidden`: the dish's name is right beside it and already
 * says everything the icon does. Announcing "pizza, Margherita Pizza" is noise.
 */
export default function FoodIcon({
  name,
  tags,
  set,
  prefer,
  className = '',
}: {
  name?: string | null;
  tags?: string[] | null;
  set: MenuIconSet;
  /** 'ingredient' for add-ons, where the modifier carries the information, not the dish. */
  prefer?: 'dish' | 'ingredient';
  className?: string;
}) {
  if (set === 'none') return null;

  const key = matchFoodIcon(name, tags, { prefer });
  if (!key) return null;

  const icon = FOOD_ICONS[key];
  if (!icon) return null;

  if (set === 'emoji') {
    return (
      <span aria-hidden="true" className={`shrink-0 leading-none ${className}`}>
        {icon.emoji}
      </span>
    );
  }

  const svg = (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      aria-hidden="true"
      focusable="false"
      className="shrink-0"
      dangerouslySetInnerHTML={{ __html: icon.path }}
    />
  );

  if (set === 'badge') {
    // A tinted chip built from the site's own accent — no fixed colour, so it reads on either
    // theme and tracks a theme change for free.
    return (
      <span
        aria-hidden="true"
        className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ${className}`}
      >
        {svg}
      </span>
    );
  }

  return (
    <span aria-hidden="true" className={`inline-flex shrink-0 text-muted-foreground ${className}`}>
      {svg}
    </span>
  );
}
