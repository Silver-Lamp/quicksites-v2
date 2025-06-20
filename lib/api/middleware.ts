const rateLimitMap = new Map<string, { count: number; last: number }>();

export async function requireHeader(req: Request, key: string): Promise<Response | void> {
  const value = req.headers.get(key);
  if (!value) {
    return new Response(`Missing header: ${key}`, { status: 401 });
  }
}

export async function requireApiKey(req: Request): Promise<Response | void> {
  const token = req.headers.get('x-api-key');
  if (token !== process.env.INTERNAL_API_KEY) {
    return new Response('Unauthorized (bad API key)', { status: 401 });
  }
}

export function withRateLimit(limit: number, windowMs: number = 60_000) {
  return async (req: Request): Promise<Response | void> => {
    const ip = req.headers.get('x-forwarded-for') || 'local';
    const now = Date.now();

    const record = rateLimitMap.get(ip) || { count: 0, last: now };
    if (now - record.last > windowMs) {
      rateLimitMap.set(ip, { count: 1, last: now });
    } else {
      record.count++;
      record.last = now;
      rateLimitMap.set(ip, record);

      if (record.count > limit) {
        return new Response('Too Many Requests', { status: 429 });
      }
    }
  };
}

export function withCors(
  handler: (req: Request) => Promise<Response>,
  options: {
    origin?: string;
    methods?: string[];
    allowHeaders?: string[];
    maxAge?: number;
  } = {}
) {
  const {
    origin = '*',
    methods = ['GET', 'POST', 'OPTIONS'],
    allowHeaders = ['Content-Type', 'Authorization'],
    maxAge = 600,
  } = options;

  return async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': origin,
          'Access-Control-Allow-Methods': methods.join(','),
          'Access-Control-Allow-Headers': allowHeaders.join(','),
          'Access-Control-Max-Age': maxAge.toString(),
        },
      });
    }

    const res = await handler(req);
    const headers = new Headers(res.headers);
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Access-Control-Allow-Methods', methods.join(','));
    headers.set('Access-Control-Allow-Headers', allowHeaders.join(','));

    return new Response(res.body, {
      status: res.status,
      headers,
    });
  };
}
