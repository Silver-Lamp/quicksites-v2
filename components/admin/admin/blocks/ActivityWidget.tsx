// ✅ FILE: /components/admin/blocks/ActivityWidget.tsx

'use client';

export default function ActivityWidget({ settings = {} }: { settings?: Record<string, any> }) {
  const grouping = settings.grouping ?? 'daily';
  const colorize = settings.colorize ?? true;
  const sampleSize = settings.dataSampleSize ?? 50;

  return (
    <div className="text-sm text-gray-700 dark:text-gray-200 space-y-1">
      <p>
        📈 <strong>Activity Widget</strong>
      </p>
      <p>
        Grouping: <code>{grouping}</code>
      </p>
      <p>Color Zones: {colorize ? 'Enabled' : 'Disabled'}</p>
      <p>Sample Size: {sampleSize}</p>
    </div>
  );
}
