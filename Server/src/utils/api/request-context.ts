import { AsyncLocalStorage } from 'node:async_hooks';
import type { Request } from 'express';

interface RequestContext {
  requestId: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

export function runInRequestContext<T>(ctx: RequestContext, fn: () => T): T {
  return storage.run(ctx, fn);
}

export function getRequestId(): string | undefined {
  return storage.getStore()?.requestId;
}

export function loggedPath(req: Pick<Request, 'originalUrl'>): string {
  const url = req.originalUrl ?? '';
  const i = url.indexOf('?');
  return i === -1 ? url : url.slice(0, i);
}
