import { AsyncLocalStorage } from 'node:async_hooks';
import type { Request } from 'express';

interface RequestContext {
  requestId: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

/** Runs `fn` with the request id available to every log line emitted inside it (see logger mixin). */
export function runInRequestContext<T>(ctx: RequestContext, fn: () => T): T {
  return storage.run(ctx, fn);
}

export function getRequestId(): string | undefined {
  return storage.getStore()?.requestId;
}

/**
 * Request path for logs: never includes the query string (it can carry emails, search terms
 * or tokens). Use this instead of `req.originalUrl` in any log statement.
 */
export function loggedPath(req: Pick<Request, 'originalUrl'>): string {
  const url = req.originalUrl ?? '';
  const i = url.indexOf('?');
  return i === -1 ? url : url.slice(0, i);
}
