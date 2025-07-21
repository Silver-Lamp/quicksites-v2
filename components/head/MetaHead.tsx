'use client';

type MetaProps = {
  title: string;
  description: string;
  ogImage?: string;
  faviconSizes?: Partial<Record<string, string>>;
  appleIcons?: Partial<Record<string, string>>;
};

export default function MetaHead({
  title,
  description,
  ogImage,
  faviconSizes = {},
  appleIcons = {},
}: MetaProps) {
  return (
    <>
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      {ogImage && <meta property="og:image" content={ogImage} />}
      {Object.entries(faviconSizes).map(([size, url]) => (
        <link
          key={size}
          rel="icon"
          type="image/png"
          sizes={`${size}x${size}`}
          href={url}
        />
      ))}
      {Object.entries(appleIcons).map(([size, url]) => (
        <link
          key={`apple-${size}`}
          rel="apple-touch-icon"
          sizes={`${size}x${size}`}
          href={url}
        />
      ))}
    </>
  );
}
