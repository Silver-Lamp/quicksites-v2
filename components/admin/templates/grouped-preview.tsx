export function GroupedPreview({
  branding,
  snapshotId,
  label,
  createdAt,
}: {
  branding: any;
  snapshotId: string;
  label: string;
  createdAt: string;
}) {
  return (
    <div>
      <div className="text-sm text-gray-100">
        Snapshot: <code>{snapshotId}</code>
      </div>
      <div className="text-xs text-gray-400">Label: {label || 'No label'}</div>
      <div className="text-xs text-gray-500">Published: {new Date(createdAt).toLocaleString()}</div>
      <div className="text-xs mt-1" style={{ fontFamily: branding?.font_family || 'sans-serif' }}>
        Heading Preview in {branding?.font_family || 'Default'}
      </div>
      <div className="flex gap-2 mt-1 items-center">
        {branding?.primary_color && (
          <span
            className="inline-block w-4 h-4 rounded-full"
            style={{ backgroundColor: branding.primary_color }}
            title={`Primary: ${branding.primary_color}`}
          ></span>
        )}
        {branding?.secondary_color && (
          <span
            className="inline-block w-4 h-4 rounded-full"
            style={{ backgroundColor: branding.secondary_color }}
            title={`Secondary: ${branding.secondary_color}`}
          ></span>
        )}
        {branding?.id && (
          <a href={`/branding/${branding.id}`} target="_blank" rel="noopener noreferrer">
            <img
              src={`https://your-project-id.supabase.co/storage/v1/object/public/branding-logos/${branding.id}.png`}
              alt="Logo preview"
              className="h-8 rounded shadow border"
              onError={(e) => (e.currentTarget.style.display = 'none')}
            />
          </a>
        )}
      </div>
    </div>
  );
}
