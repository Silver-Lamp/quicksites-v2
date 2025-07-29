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
  images: {
    domains: [
      'randomuser.me',
      'kcwruliugwidsdgsrthy.supabase.co',
      'cdn.sanity.io',
      'image.thum.io',
    ],
  },

  webpack(config, { isServer }) {
    // ✅ Enable aliases
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

    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push({
        nodemailer: 'commonjs nodemailer',
      });
    } else {
      config.devtool = 'cheap-module-source-map';
    }

    // ✅ Buffer polyfill
    config.resolve.fallback = {
      ...config.resolve.fallback,
      buffer: require.resolve('buffer/'),
    };

    config.plugins.push(
      new webpack.ProvidePlugin({
        Buffer: ['buffer', 'Buffer'],
      })
    );

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
  
    return isLocal
      ? [] // ⛔ No redirect during local dev
      : [
          {
            source: '/:path*',
            has: [
              {
                type: 'host',
                value: '^(?!www\\.).*', // match non-www domains
              },
            ],
            destination: 'https://www.:host/:path*',
            permanent: true, // ✅ Permanent redirect 301
          },
        ];
  },
};

export default nextConfig;
