// next.config.js rewrite suggestions

module.exports = {
  async rewrites() {
    return [
      { source: '/admin/dashboard', destination: '/admin/sites/dashboard' },
      { source: '/admin/sites/:slug', destination: '/sites/:slug' },
      { source: '/admin/sites', destination: '/sites' },
    ];
  },
};
