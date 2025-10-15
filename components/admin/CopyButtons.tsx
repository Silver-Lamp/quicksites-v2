// components/admin/CopyButtons.tsx
"use client";

export default function CopyButtons({ shortUrl, targetUrl }: { shortUrl: string; targetUrl: string }) {
  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // no-op
    }
  }
  return (
    <div className="inline-flex gap-2">
      <button
        onClick={() => copy(shortUrl)}
        className="rounded border px-2 py-1 hover:bg-gray-50"
        title="Copy short URL"
      >
        Copy Short
      </button>
      <button
        onClick={() => copy(targetUrl)}
        className="rounded border px-2 py-1 hover:bg-gray-50"
        title="Copy target URL"
      >
        Copy Target
      </button>
    </div>
  );
}
