'use client';

import { usePathname } from 'next/navigation';

type MetaProps = {
  title: string;
  description: string;
  ogImage?: string;
  faviconSizes?: Partial<Record<string, string>>;
  appleIcons?: Partial<Record<string, string>>;
  customDomain?: string;
  slug?: string;
  schemaLocalBusiness?: Record<string, any>;
};

export default function MetaHead({
  title,
  description,
  ogImage,
  faviconSizes = {},
  appleIcons = {},
  customDomain,
  slug,
  schemaLocalBusiness,
}: MetaProps) {
  const pathname = usePathname();

  const baseUrl = customDomain
    ? `https://${customDomain}`
    : slug
      ? `https://quicksites.ai/_sites/${slug}`
      : '';

  const canonicalUrl = baseUrl
    ? `${baseUrl}${pathname || ''}`.replace(/\/+$/, '')
    : '';

  return (
    <>
      <title>{title}</title>
      <meta name="description" content={description} />

      {/* Canonical & Open Graph */}
      {canonicalUrl && <link rel="canonical" href={canonicalUrl} />}
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      {ogImage && <meta property="og:image" content={ogImage} />}
      {canonicalUrl && <meta property="og:url" content={canonicalUrl} />}
      <meta property="og:type" content="website" />
      <meta name="twitter:card" content="summary_large_image" />

      {/* Favicon Icons */}
      {Object.entries(faviconSizes).map(([size, url]) => (
        <link
          key={size}
          rel="icon"
          type="image/png"
          sizes={`${size}x${size}`}
          href={url}
        />
      ))}

      {/* Apple Touch Icons */}
      {Object.entries(appleIcons).map(([size, url]) => (
        <link
          key={`apple-${size}`}
          rel="apple-touch-icon"
          sizes={`${size}x${size}`}
          href={url}
        />
      ))}

      {/* JSON-LD for LocalBusiness */}
      {schemaLocalBusiness && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(schemaLocalBusiness),
          }}
        />
      )}
    </>
  );
}
