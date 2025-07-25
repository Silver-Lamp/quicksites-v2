export function GET(_: Request, { params }: { params: { domain: string } }) {
    const domain = params.domain;
    const body = `User-agent: *
  Sitemap: https://${domain}/sitemap.xml
  Disallow:
  `;
  
    return new Response(body, {
      headers: {
        'Content-Type': 'text/plain',
      },
    });
  }
  