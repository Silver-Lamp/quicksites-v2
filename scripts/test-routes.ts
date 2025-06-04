import fetch from 'node-fetch';

const routes = [
  '/',
  '/admin/dashboard',
  '/unauthorized'
];

async function testRoutes() {
  console.log('🔍 Testing routes...');
  for (const route of routes) {
    try {
      const res = await fetch('http://localhost:3000' + route);
      const status = res.status;
      console.log(`• ${route} -> ${status}`);
    } catch (err) {
      console.error(`× ${route} failed:`, err.message);
    }
  }
}

testRoutes();
