export const config = {
  appName: 'QuickSites Admin',
  logo: '/logo.png',
  roles: ['admin', 'reseller', 'viewer'],
  routes: [
    {
      path: '/admin/dashboard',
      label: 'Dashboard',
      roles: ['admin', 'reseller'],
    },
    { path: '/admin/leads', label: 'Leads', roles: ['admin', 'reseller'] },
    { path: '/admin/queue', label: 'Queue', roles: ['admin'] },
    { path: '/admin/analytics', label: 'Analytics', roles: ['admin'] },
    { path: '/admin/heatmap', label: 'Heatmap', roles: ['admin'] },
    { path: '/admin/users', label: 'Users', roles: ['admin'] },
  ],
};
