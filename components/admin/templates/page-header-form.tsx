// components/admin/templates/page-header-form.tsx
'use client';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import type { Page } from '@/types/template';

type Props = {
  page: Page;
  onChange: (field: keyof Page, value: string) => void;
};

export function PageHeaderForm({ page, onChange }: Props) {
  return (
    <div className="space-y-2">
      <Label>Title</Label>
      <Input
        value={page.title}
        onChange={(e) => onChange('title', e.target.value)}
      />

      <Label>Slug</Label>
      <Input
        value={page.slug}
        onChange={(e) => onChange('slug', e.target.value)}
      />
    </div>
  );
}
