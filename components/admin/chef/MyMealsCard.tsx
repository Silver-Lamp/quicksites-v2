// components/admin/chef/MyMealsCard.tsx
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import MealsTableEditable from '@/components/admin/chef/meals-table-editable';

export default function MyMealsCard({ siteId }: { siteId: string }) {
  const [reloadKey, setReloadKey] = useState(0);

  return (
    <div className="rounded-2xl border p-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-base font-semibold">My Meals</h2>
        <Button variant="outline" onClick={() => setReloadKey((n) => n + 1)}>Refresh</Button>
      </div>
      {!siteId ? (
        <p className="text-sm text-muted-foreground">Enter a Site ID above.</p>
      ) : (
        <MealsTableEditable siteId={siteId} reloadKey={reloadKey} />
      )}
    </div>
  );
}
