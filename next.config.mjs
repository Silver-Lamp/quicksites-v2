import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import webpack from 'webpack';

const require = createRequire(import.meta.url);

/** ✅ Fix for __dirname in ESM */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  assetPrefix: '/',
  experimental: {
    serverActions: {
      bodySizeLimit: '8mb',
    },
  },
  images: {
    domains: [
      'randomuser.me',
      'kcwruliugwidsdgsrthy.supabase.co',
      'cdn.sanity.io',
      'image.thum.io',
      'placebear.com',
      'placekitten.com',
      'placehold.co',
      'api.dicebear.com',
    ],
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },

  webpack(config, { isServer, dev }) {
    // ✅ Aliases
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      '@': path.resolve(__dirname),
      '~': path.resolve(__dirname),
      '@/components': path.resolve(__dirname, 'components'),
      '@/admin': path.resolve(__dirname, 'admin'),
      '@/lib': path.resolve(__dirname, 'lib'),
      '@/pages': path.resolve(__dirname, 'pages'),
      '@/hooks': path.resolve(__dirname, 'hooks'),
      '@/types': path.resolve(__dirname, 'types'),
    };

    // ✅ Don’t override devtool in dev (stops the Next.js warning)
    if (!isServer) {
      if (dev) {
        delete config.devtool; // let Next pick the optimal dev setting
      } else {
        // Optional: if you need client sourcemaps in prod (e.g., Sentry), uncomment:
        // config.devtool = 'hidden-source-map';
      }
    }

    // ✅ Quiet infra-level cache serialization warnings in dev
    if (dev) {
      config.infrastructureLogging = { level: 'error' };
      // If you ever want to silence *only* specific infra warnings, you can keep level 'warn'
      // and add filters via environment flags, but 'error' is the simplest.
    }

    // ✅ Avoid bundling heavy server-only deps on the client
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push({ nodemailer: 'commonjs nodemailer' });
    }

    // ✅ Buffer polyfill for client
    config.resolve.fallback = {
      ...config.resolve.fallback,
      buffer: require.resolve('buffer/'),
    };
    config.plugins.push(
      new webpack.ProvidePlugin({
        Buffer: ['buffer', 'Buffer'],
      })
    );

    // ✅ Relax dynamic import context warnings
    config.module.exprContextCritical = false;

    return config;
  },

  eslint: {
    ignoreDuringBuilds: true,
  },

  serverExternalPackages: ['nodemailer', 'playwright', 'fs'],

  async rewrites() {
    return [
      { source: '/@/:handle', destination: '/creator/:handle' },
      { source: '/admin/dashboard', destination: '/admin/sites/dashboard' },
      { source: '/admin/sites/:slug', destination: '/sites/:slug' },
      { source: '/admin/sites', destination: '/sites' },
    ];
  },

  async redirects() {
    const isLocal = process.env.NODE_ENV === 'development';
    // Canonicalize ONLY the bare marketing apex to www. This rule was previously a
    // catch-all (`^(?!www\.).*` → `www.:host`) that force-prepended www to EVERY
    // non-www host — which broke every bare tenant subdomain (`<slug>.quicksites.ai`
    // → `www.<slug>.quicksites.ai`, uncovered by the one-label `*.quicksites.ai`
    // wildcard cert + unserved) plus custom + delivered.menu hosts. Scope it to the
    // apex so `*.quicksites.ai` and custom domains are served as-is. (Vercel also has
    // a domain-level `quicksites.ai → www.quicksites.ai` redirect; this is belt-and-
    // suspenders and matches that intent.)
    // Auth aliases. /login is the only auth surface, but /signup, /sign-up, /register and
    // /sign-in are all URLs people type and code links to — three of them WERE linked from
    // upgrade prompts and every one 404'd, so a visitor trying to pay us hit a dead end.
    // Applied in every environment: a 404 in dev is the same bug found later.
    const authAliases = [
      { source: '/signup', destination: '/login?intent=signup', permanent: false },
      { source: '/sign-up', destination: '/login?intent=signup', permanent: false },
      { source: '/register', destination: '/login?intent=signup', permanent: false },
      { source: '/sign-in', destination: '/login', permanent: false },
    ];

    return isLocal
      ? authAliases
      : [
          ...authAliases,
          {
            source: '/:path*',
            has: [{ type: 'host', value: '^quicksites\\.ai$' }],
            destination: 'https://www.quicksites.ai/:path*',
            permanent: true,
          },
        ];
  },
};

export default nextConfig;
