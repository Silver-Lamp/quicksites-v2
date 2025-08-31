// components/admin/dev/seeder/sections/DangerZoneSection.tsx
'use client';

export function DangerZoneSection({
  clearProductsFirst, setClearProductsFirst,
  clearMealsFirst, setClearMealsFirst,
}: {
  clearProductsFirst: boolean; setClearProductsFirst:(v:boolean)=>void;
  clearMealsFirst: boolean; setClearMealsFirst:(v:boolean)=>void;
}) {
  return (
    <div className="px-3 pb-3 pt-1 space-y-3">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-md border p-3">
          <div className="text-sm font-medium">Products</div>
          <label className="mt-2 inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={clearProductsFirst}
              onChange={(e)=>setClearProductsFirst(e.target.checked)}
            />
            Clear existing products first
          </label>
          <p className="mt-1 text-xs text-muted-foreground">
            Deletes current products for the target merchant before seeding.
          </p>
        </div>
        <div className="rounded-md border p-3">
          <div className="text-sm font-medium">Meals (legacy)</div>
          <label className="mt-2 inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={clearMealsFirst}
              onChange={(e)=>setClearMealsFirst(e.target.checked)}
            />
            Clear existing meals first
          </label>
          <p className="mt-1 text-xs text-muted-foreground">
            Removes legacy meal products (product_type=‘meal’) before seeding.
          </p>
        </div>
      </div>
    </div>
  );
}
