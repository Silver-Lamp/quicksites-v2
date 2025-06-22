// ✅ FILE: next.config.mjs

import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Needed to support `__dirname` in ESM context */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack(config, { isServer }) {
    config.resolve.alias['@'] = path.resolve(__dirname);

    // Optionally exclude server-only packages like 'nodemailer' from the client bundle
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push({
        nodemailer: 'commonjs nodemailer',
      });
    }
    config.module.exprContextCritical = false; // suppress dynamic require warnings
    return config;
  },

  eslint: {
    ignoreDuringBuilds: true, // ✅ Prevent build blocking due to ESLint errors
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
