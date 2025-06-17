export type HandlerMap = {
  GET?: (req: Request) => Promise<Response>;
  POST?: (req: Request) => Promise<Response>;
  PUT?: (req: Request) => Promise<Response>;
  DELETE?: (req: Request) => Promise<Response>;
  PATCH?: (req: Request) => Promise<Response>;
};

export type WithMethodOptions = {
  beforeEach?: (req: Request) => Promise<Response | void>; // optional middleware
};

export function withMethod(
  handlers: HandlerMap,
  options: WithMethodOptions = {}
): (req: Request) => Promise<Response> {
  return async function handler(req: Request): Promise<Response> {
    const method = req.method.toUpperCase() as keyof HandlerMap;

    // 🔒 Middleware check (e.g. auth guard)
    if (options.beforeEach) {
      const result = await options.beforeEach(req);
      if (result instanceof Response) return result;
    }

    // Route to matching method
    if (handlers[method]) {
      return handlers[method]!(req);
    }

    return new Response('Method Not Allowed', {
      status: 405,
      headers: { Allow: Object.keys(handlers).join(', ') },
    });
  };
}
