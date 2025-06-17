// ✅ FILE: /components/admin/blocks/RetentionWidget.tsx
'use client';

export default function RetentionWidget({
  settings = {},
}: {
  settings?: Record<string, any>;
}) {
  return (
    <div className="text-sm text-gray-700 dark:text-gray-200 space-y-1">
      <p>
        📊 <strong>Retention Widget</strong>
      </p>
      <p>Granularity: {settings.granularity ?? 'weekly'}</p>
      <p>Show Chart: {settings.showChart ? 'Yes' : 'No'}</p>
    </div>
  );
}
