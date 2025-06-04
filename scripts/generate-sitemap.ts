import fs from 'fs';
import path from 'path';
import glob from 'glob';

const BASE_URL = 'https://quicksites.ai';
const pagesDir = path.join(process.cwd(), 'pages');

function getRoutes() {
  const files = glob.sync('**/*.tsx', { cwd: pagesDir, nodir: true });
  const routes = files
    .filter(f => !f.startsWith('_') && !f.includes('404') && !f.includes('api/'))
    .map(f => {
      const route = f
        .replace(/\/index\.tsx$/, '/')
        .replace(/\.tsx$/, '')
        .replace(/^index$/, '');
      return '/' + route.replace(/\\/g, '/');
    });
  return Array.from(new Set(routes));
}

const routes = getRoutes();

const xml = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
];

routes.forEach(route => {
  xml.push(
    `<url><loc>${BASE_URL}${route}</loc><changefreq>weekly</changefreq><priority>0.7</priority></url>`
  );
});

xml.push('</urlset>');

const outputPath = path.join(process.cwd(), 'public', 'sitemap.xml');
fs.writeFileSync(outputPath, xml.join('\n'));
console.log(`✅ Sitemap with ${routes.length} routes written to public/sitemap.xml`);
