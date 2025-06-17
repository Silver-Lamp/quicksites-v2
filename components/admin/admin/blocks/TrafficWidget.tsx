// ✅ FILE: /components/admin/blocks/TrafficWidget.tsx
'use client';

export default function TrafficWidget({
  settings = {},
}: {
  settings?: Record<string, any>;
}) {
  return (
    <div className="text-sm text-gray-700 dark:text-gray-200 space-y-1">
      <p>
        🚦 <strong>Traffic Widget</strong>
      </p>
      <p>Chart Type: {settings.chartType ?? 'line'}</p>
      <p>Max Data Points: {settings.maxDataPoints ?? 30}</p>
    </div>
  );
}
