/** @type {import('next').NextConfig} */
const nextConfig = {
  // ✅ This should be top-level, not inside webpack()
  devIndicators: {
    buildActivity: false,
    autoPrerender: false,
  },

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
