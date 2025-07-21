'use client';

export default function SeoRescrapeButtons({ url }: { url: string }) {
  return (
    <div className="mt-4 space-y-2 text-sm text-white/80">
      <div className="font-medium">Force Rescrape:</div>
      <ul className="space-y-1">
        <li>
          <a
            href={`https://developers.facebook.com/tools/debug/?q=${encodeURIComponent(url)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:underline"
          >
            Facebook: Force Refresh OG Tags
          </a>
        </li>
        <li>
          <a
            href={`https://www.linkedin.com/post-inspector/inspect/${encodeURIComponent(url)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:underline"
          >
            LinkedIn: Trigger Scrape
          </a>
        </li>
        <li>
          <a
            href="https://cards-dev.twitter.com/validator"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:underline"
          >
            Twitter: Recheck Card Preview
          </a>
        </li>
      </ul>
    </div>
  );
}
