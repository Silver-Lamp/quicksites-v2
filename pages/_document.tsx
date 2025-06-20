import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        {/* OpenGraph */}
        <meta property="og:type" content="website" />
        <meta property="og:title" content="QuickSites" />
        <meta property="og:description" content="AI-powered local site generator and dashboard" />
        <meta property="og:image" content="/assets/opengraph-image.dark.safe.png" />
        <meta property="og:url" content="https://quicksites.ai" />

        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="QuickSites" />
        <meta name="twitter:description" content="AI-powered local site generator and dashboard" />
        <meta name="twitter:image" content="/assets/opengraph-image.dark.safe.png" />
        <meta name="twitter:site" content="@quicksites_ai" />

        <link rel="icon" href="/assets/favicon.ico" />
        <link rel="apple-touch-icon" href="/assets/apple-touch-icon.png" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
