import * as React from 'react';
import FoodIcon from '@/components/sites/food-icon';
import type { MenuIconSet } from '@/lib/menu/foodIcons';

/**
 * The little square beside a line item, in the cart, checkout and receipt.
 *
 * Most menu items have no photograph — a lemonade stand is not going to shoot its cups — so the
 * square was an empty grey box on every row. That reads as a broken image rather than as an
 * absence, which is the worst of both: it occupies the space of information while carrying none.
 *
 * When the site has adopted an icon set and the dish is one we recognise, draw that instead. The
 * fallback order is deliberate and each step is honest about what it knows:
 *
 *   1. the owner's own photograph — always wins, it is the real thing
 *   2. the matched icon — true about the dish, drawn by us
 *   3. an empty tile — we know nothing, and say nothing
 *
 * Never a placeholder glyph or a "no image" icon: those assert that something is missing, which
 * is a statement about the seller's page rather than about their food.
 */
export default function ItemThumb({
  imageUrl,
  title,
  iconSet = 'none',
  className = '',
}: {
  imageUrl?: string | null;
  title?: string | null;
  /** The site's chosen set; 'none' (the default) means icons are off and the tile stays empty. */
  iconSet?: MenuIconSet;
  className?: string;
}) {
  const base = `h-10 w-10 shrink-0 overflow-hidden rounded bg-muted ${className}`;

  if (imageUrl) {
    return (
      <div className={base}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt="" className="h-full w-full object-cover" />
      </div>
    );
  }

  return (
    <div className={`${base} flex items-center justify-center text-muted-foreground`}>
      {/* Renders nothing when the set is 'none' or the dish is unrecognised — leaving the plain
          tile, which is the correct output rather than a failure. */}
      <FoodIcon name={title} set={iconSet} />
    </div>
  );
}
