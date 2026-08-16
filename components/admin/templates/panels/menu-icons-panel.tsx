'use client';

import * as React from 'react';
import { MENU_ICON_SETS, readMenuIconSet, writeMenuIconSet, FOOD_ICONS, type MenuIconSet } from '@/lib/menu/foodIcons';
import FoodIcon from '@/components/sites/food-icon';

/** Three real dishes, so the preview shows matching rather than a row of decoration. */
const SAMPLE = ['Margherita Pizza', 'Garden Salad', 'Iced Coffee'];

/**
 * Pick an icon set for the menu. Shown on food sites only — an icon row on a plumber's services
 * list would be nonsense, and a setting that cannot apply is clutter that makes the panel it
 * lives in feel less trustworthy.
 */
export default function MenuIconsPanel({
  template,
  onPatch,
}: {
  template: any;
  onPatch: (patch: any) => void;
}) {
  const current = readMenuIconSet(template?.data);

  const choose = (set: MenuIconSet) => {
    // meta ONLY — never the whole data blob. See venmo-panel for what a full-blob patch from a
    // stale prop does to `pages`.
    const next = writeMenuIconSet(template?.data ?? {}, set);
    onPatch({ data: { meta: next.meta } });
  };

  return (
    <div className="rounded-md border border-border/60 bg-card/40 p-3 text-sm">
      <div className="font-medium text-foreground">Menu icons</div>
      <p className="mt-1 text-xs text-muted-foreground">
        A small icon in front of each dish. Items we can&apos;t confidently match stay plain —
        never a wrong icon.
      </p>

      <div className="mt-3 grid gap-2">
        {MENU_ICON_SETS.map((s) => {
          const active = current === s.key;
          return (
            <button
              key={s.key}
              onClick={() => choose(s.key)}
              aria-pressed={active}
              className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left transition ${
                active
                  ? 'border-primary/60 bg-primary/10'
                  : 'border-border hover:bg-muted'
              }`}
            >
              <span className="min-w-0">
                <span className="block font-medium text-foreground">{s.label}</span>
                <span className="block text-xs text-muted-foreground">{s.hint}</span>
              </span>

              {/* Live preview in the set being offered — the only honest way to choose one. */}
              <span className="flex shrink-0 items-center gap-1.5">
                {s.key === 'none'
                  ? <span className="text-xs text-muted-foreground">Aa</span>
                  : SAMPLE.map((n) => <FoodIcon key={n} name={n} set={s.key} />)}
              </span>
            </button>
          );
        })}
      </div>

      <p className="mt-2 text-xs text-muted-foreground">
        {Object.keys(FOOD_ICONS).length} icons — drinks, mains, sides and desserts.
      </p>
    </div>
  );
}
