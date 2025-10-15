'use client';

import { useState, useTransition } from 'react';
import { Switch } from '@/components/ui/switch';
import { useRouter } from 'next/navigation';

export default function PlanToggle({
  slug,
  isPaid,
}: {
  slug: string;
  isPaid: boolean;
}) {
  const [checked, setChecked] = useState(isPaid);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  async function onChange(v: boolean) {
    setChecked(v);
    try {
      await fetch('/api/admin/candidate/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, is_paid: v }),
      });
    } finally {
      startTransition(() => router.refresh());
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Switch checked={checked} onCheckedChange={onChange} disabled={pending} />
      <span className="text-xs text-muted-foreground">{checked ? 'Paid' : 'Free'}</span>
    </div>
  );
}
