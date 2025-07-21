'use client';

export default function SeoPreviewTestLinks({ url }: { url: string }) {
  return (
    <div className="mt-4 space-y-2 text-sm text-white/80">
      <div className="font-medium">Test SEO Preview:</div>
      <ul className="space-y-1">
        <li>
          <a
            href={`https://www.facebook.com/debug/?q=${encodeURIComponent(url)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:underline"
          >
            Facebook Sharing Debugger
          </a>
        </li>
        <li>
          <a
            href={`https://www.linkedin.com/post-inspector/inspect/${encodeURIComponent(url)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:underline"
          >
            LinkedIn Post Inspector
          </a>
        </li>
        <li>
          <a
            href={`https://cards-dev.twitter.com/validator`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:underline"
          >
            Twitter Card Validator
          </a>
        </li>
      </ul>
    </div>
  );
}
