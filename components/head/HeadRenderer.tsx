'use client';

import Head from 'next/head';

export default function HeadRenderer({
  title = 'QuickSites',
  description = 'Fast, beautiful websites for local businesses.',
  ogImage,
  iconUrl = '/favicon-32x32.png',
  appleTouch,
  extraLinks,
  jsonLd,
}: {
  title?: string;
  description?: string;
  ogImage?: string;
  iconUrl?: string;
  appleTouch?: string;
  extraLinks?: string;
  jsonLd?: Record<string, any>;
}) {
  return (
    <Head>
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      {ogImage && <meta property="og:image" content={ogImage} />}
      <link rel="icon" type="image/png" sizes="32x32" href={iconUrl} />
      {appleTouch && <link rel="apple-touch-icon" sizes="180x180" href={appleTouch} />}
      {extraLinks && <div dangerouslySetInnerHTML={{ __html: extraLinks }} />}
      {jsonLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      )}
    </Head>
  );
}
