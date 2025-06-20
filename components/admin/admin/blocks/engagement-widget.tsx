// ✅ FILE: /components/admin/blocks/EngagementWidget.tsx
'use client';

export default function EngagementWidget({ settings = {} }: { settings?: Record<string, any> }) {
  return (
    <div className="text-sm text-gray-700 dark:text-gray-200 space-y-1">
      <p>
        🔥 <strong>Engagement Widget</strong>
      </p>
      <p>Threshold: {settings.threshold ?? 75}</p>
      <p>Label Style: {settings.labelStyle ?? 'short'}</p>
    </div>
  );
}
