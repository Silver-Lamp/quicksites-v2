export default {
    async fetch(req) {
      const u = new URL(req.url);
      const target = u.searchParams.get('url');
      if (!target) return new Response('Missing url', { status: 400 });
  
      // Browser-y headers help avoid bot walls
      const headers = {
        'user-agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'accept-language': 'en-US,en;q=0.9',
        'upgrade-insecure-requests': '1',
        'cache-control': 'no-cache',
        'pragma': 'no-cache',
        'referer': 'https://www.yelp.com/',
      };
  
      if (u.pathname === '/health') {
        return new Response('ok', { status: 200, headers: { 'access-control-allow-origin': '*' } });
      }
  
      // Preflight
      if (req.method === 'OPTIONS') {
        return new Response(null, {
          status: 204,
          headers: {
            'access-control-allow-origin': '*',
            'access-control-allow-methods': 'GET,OPTIONS',
            'access-control-allow-headers': 'content-type',
            'access-control-max-age': '86400',
          },
        });
      }
  
      const r = await fetch(target, { headers, cf: { cacheTtl: 0 } });
      const text = await r.text();
      const res = new Response(text, { status: r.status });
      res.headers.set('content-type', r.headers.get('content-type') || 'text/html; charset=utf-8');
      res.headers.set('access-control-allow-origin', '*');
      res.headers.set('cache-control', 'no-store');
      return res;
    },
  };
  