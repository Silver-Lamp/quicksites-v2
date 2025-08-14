import React from "react";
import "@/lib/blocks"; // ensure blocks register
import BlockRenderer from "@/lib/blocks/_likely-remove_BlockRenderer";

export default async function Page() {
  const blocks = [
    {
      id: 'b1',
      type: 'meals_grid',
      version: 1,
      props: { siteSlug: 'delivered-menu', columns: 3, limit: 12, sort: 'recent', tag: 'featured', ctaText: 'View meal' }
    }
  ];
  return (
    <div className="mx-auto max-w-6xl p-6">
      <h1 className="text-2xl font-semibold mb-3">Blocks demo</h1>
      {/* SSR-rendered blocks */}
      {/* // @ts-expect-error Async Server Component */}
      <BlockRenderer blocks={blocks} />
    </div>
  );
}