"use client";

import GridTemplateManager from '@/components/admin/templates/grid-template-manager';

export default function AdminPresetsPage() {
  return (
    <div className="max-w-5xl mx-auto py-8 space-y-6">
      <h1 className="text-2xl font-bold text-white">Grid Layout Templates</h1>
      <p className="text-sm text-muted-foreground">
        Browse, insert, export, or import reusable block layouts for your editor.
      </p>

      <GridTemplateManager showPreview />
    </div>
  );
}
