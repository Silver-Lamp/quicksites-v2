import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import webpack from 'webpack'; // needed for ProvidePlugin

const require = createRequire(import.meta.url); // ✅ ESM-safe require

/** ✅ Fix for __dirname in ESM */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  assetPrefix: '/',
  images: {
    domains: ['randomuser.me', 'kcwruliugwidsdgsrthy.supabase.co', 'cdn.sanity.io'],
  },

  webpack(config, { isServer }) {
    config.resolve.alias['@'] = path.resolve(__dirname);

    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push({
        nodemailer: 'commonjs nodemailer',
      });
    }

    // ✅ Polyfill for Buffer (node:buffer)
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
};

export default nextConfig;
