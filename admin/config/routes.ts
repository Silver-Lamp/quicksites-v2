// components/admin/config/routes.ts

export const smartLinkRoutes = [
  {
    path: '/admin/smartlinks',
    label: 'Overview',
  },
  {
    path: '/admin/smartlinks/gallery',
    label: 'Gallery',
  },
  {
    path: '/admin/smartlinks/debug',
    label: 'Debug Panel',
  },
  {
    path: '/admin/smartlinks/grid',
    label: 'Grid (WIP)',
  },
];

// 👇 Wrap in a group with default icons and roles
const routeGroups = [
  {
    label: 'Smart Links',
    collapsible: true,
    routes: smartLinkRoutes.map(route => ({
      ...route,
      icon: getIconForLabel(route.label),
      roles: ['admin'], // adjust as needed per your role system
    })),
  },
];

function getIconForLabel(label: string) {
  const iconMap: Record<string, string> = {
    'Overview': '🧠',
    'Gallery': '🖼️',
    'Debug Panel': '🐞',
    'Grid (WIP)': '🗺️',
  };
  return iconMap[label] || '📄';
}

export default routeGroups;
