import glob from 'glob';
import path from 'path';

const pagesDir = path.join(process.cwd(), 'pages');

const files = glob.sync('**/*.tsx', {
  cwd: pagesDir,
  nodir: true,
  ignore: ['_*.tsx', 'api/**', '404.tsx'],
});

function fileToRoute(file: string) {
  let route = file
    .replace(/\/index\.tsx$/, '/')
    .replace(/\.tsx$/, '')
    .replace(/^index$/, '')
    .replace(/\/g, '/');
  return '/' + route;
}

console.log('\n🧭 Route Tree');
console.log('='.repeat(40));
files.map(fileToRoute).sort().forEach((route) => {
  const indent = '  '.repeat(route.split('/').length - 2);
  console.log(indent + '• ' + route);
});
console.log('='.repeat(40));
