import { useDomainPreview } from '../hooks/useDomainPreview.jsx';

export default function DomainPreviewCard({ domain }: { domain: string }) {
  const { imageUrl, loading } = useDomainPreview(domain);

  return (
    <div className="bg-zinc-800 rounded shadow p-4 w-full max-w-md mx-auto text-white">
      <h3 className="text-lg font-bold mb-2">{domain}</h3>
      {loading ? (
        <p className="text-sm text-zinc-400">Checking preview...</p>
      ) : imageUrl ? (
        <img src={imageUrl} alt="Preview" className="rounded w-full" />
      ) : (
        <div className="text-sm text-yellow-400">
          No screenshot found.
          <br />
          <a
            href={`/api/screenshot?domain=${domain}`}
            className="text-blue-400 underline text-xs"
          >
            Generate now
          </a>
        </div>
      )}
    </div>
  );
}
