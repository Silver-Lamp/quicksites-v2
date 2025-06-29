import { getRequestContext } from '@/lib/request/getRequestContext';

type LogTraceOptions = {
  level?: 'info' | 'warn' | 'error';
  debugOnly?: boolean;
  context?: Record<string, any>;
};

/**
 * Logs a message with traceId and optional context.
 * Returns the formatted trace string (for DB or header use).
 */
export async function logTrace(
  message: string,
  options: LogTraceOptions = {}
): Promise<string> {
  const { traceId, userId, role, ip, sessionId } = await getRequestContext();

  const trace = `[trace:${traceId}]`;
  const roleInfo = role ? ` (${role})` : '';
  const prefix = `[${options.level?.toUpperCase() ?? 'INFO'}]${roleInfo}`;

  const fullMessage = `${prefix} ${trace} ${message}`;

  if (!options.debugOnly || process.env.NODE_ENV === 'development') {
    const logFn =
      options.level === 'warn'
        ? console.warn
        : options.level === 'error'
        ? console.error
        : console.log;

    logFn(fullMessage);
    if (options.context) console.dir(options.context, { depth: 3 });
  }

  return trace;
}
