import { useDomainPreview } from '@/hooks/useDomainPreview';

export function DomainWithStatus({
  domain,
  status,
}: {
  domain: string;
  status: string;
}) {
  const { imageUrl, loading } = useDomainPreview(domain);
  return (
    <div className="flex items-center gap-4 border-b border-zinc-800 py-2 text-white">
      <div className="w-32 h-20 bg-zinc-900 rounded overflow-hidden">
        {loading ? (
          <div className="text-xs p-2 text-zinc-400">Loading…</div>
        ) : imageUrl ? (
          <img
            src={imageUrl.replace('.png', '.thumb.png')}
            alt={domain}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="text-xs p-2 text-yellow-400">No preview</div>
        )}
      </div>
      <div className="flex-1">
        <div className="text-sm font-medium">{domain}</div>
        <div
          className={`text-xs ${status === 'failed' ? 'text-red-400' : 'text-zinc-400'}`}
        >
          Status: {status}
        </div>
      </div>
    </div>
  );
}
