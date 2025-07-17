import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** ✅ Fix for __dirname in ESM */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  // ✅ Fix subdomain asset loading
  assetPrefix: '/',
  images: {
    domains: ['randomuser.me', 'your-supabase-project.supabase.co', 'cdn.sanity.io'],
  },
  // ⚠ Removed deprecated option
  // devIndicators: { buildActivity: false },

  webpack(config, { isServer }) {
    config.resolve.alias['@'] = path.resolve(__dirname);

    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push({
        nodemailer: 'commonjs nodemailer',
      });
    }

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
