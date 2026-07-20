import { prisma } from '../../src/prisma/prismaClient.js';
import bcrypt from 'bcrypt';
import { config } from '../../src/utils/config.js';
import {
  Channel,
  PatientStatus,
  AdminRole,
  AdminStatus,
} from '../../generated/prisma/client.ts';

let seq = 0;
function unique(suffix: string): string {
  seq += 1;
  return `${suffix}-${Date.now()}-${seq}`;
}

export async function createTestUser(overrides: {
  email?: string;
  password?: string;
  role?: AdminRole;
  status?: AdminStatus;
} = {}) {
  const email = overrides.email ?? unique('user@test.local');
  const password = overrides.password ?? 'Password123!';
  const passwordHash = await bcrypt.hash(password, config.auth.bcryptRounds);
  return prisma.user.create({
    data: {
      email,
      passwordHash,
      role: overrides.role ?? AdminRole.ADMIN,
      status: overrides.status ?? AdminStatus.ACTIVE,
      firstName: 'Test',
      lastName: 'User',
      displayName: 'Test User',
      reminderActive: false,
      reminderChannel: Channel.WHATSAPP,
      timezone: config.defaults.timezone,
    },
  });
}

export async function createTestPatient(
  userId: string,
  overrides: { name?: string; lastName?: string; email?: string } = {},
) {
  return prisma.patient.create({
    data: {
      name: overrides.name ?? 'Maria',
      lastName: overrides.lastName ?? 'Garcia',
      email: (overrides.email ?? unique('patient@test.local')).toLowerCase(),
      status: PatientStatus.ACTIVE,
      userId,
    },
  });
}

export async function createTestLocation(userId: string, overrides: { name?: string; isVirtual?: boolean } = {}) {
  return prisma.appointmentLocation.create({
    data: {
      name: overrides.name ?? unique('Office'),
      isVirtual: overrides.isVirtual ?? false,
      userId,
    },
  });
}

export async function createTestAppointmentType(userId: string, overrides: { name?: string } = {}) {
  return prisma.appointmentType.create({
    data: {
      name: overrides.name ?? unique('Consult'),
      defaultDuration: 60,
      userId,
    },
  });
}

export function futureDate(offsetMinutes = 60): Date {
  return new Date(Date.now() + offsetMinutes * 60_000);
}

export function appointmentTimeRange(offsetMinutes = 60, durationMinutes = 30) {
  const start = futureDate(offsetMinutes);
  const end = new Date(start.getTime() + durationMinutes * 60_000);
  return { start, end };
}

export { unique };

// ---------------------------------------------------------------------------
// Minimal Express request/response doubles + route runner for route-layer
// integration tests. These exercise the full middleware stack (validateBody /
// validateQuery / validateParams + asyncHandler) against a real database.
// asyncHandler swallows thrown errors and writes them to `res` via handleError,
// so the runner polls microtasks until the response is settled (asyncHandler
// does not surface its promise).
// ---------------------------------------------------------------------------

export interface RouteReq {
  user?: { id: string; timezone?: string; [k: string]: unknown };
  body?: Record<string, unknown>;
  params?: Record<string, unknown>;
  query?: Record<string, unknown>;
  ip?: string;
  originalUrl?: string;
  [k: string]: unknown;
}

export function makeRes() {
  const res: any = {
    statusCode: 0,
    headers: {} as Record<string, unknown>,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
    set(field: string, value: unknown) {
      this.headers[field] = value;
      return this;
    },
    setHeader() {
      return this;
    },
    send(payload?: unknown) {
      if (payload !== undefined) this.body = payload;
      return this;
    },
  };
  return res;
}

export async function invokeRoute(
  router: { stack: any[] },
  method: string,
  path: string,
  req: RouteReq,
) {
  const segments = path.split('/').filter(Boolean);
  const layer: any = router.stack.find((l: any) => {
    const route = l.route;
    if (!route || !route.methods[method]) return false;
    const routeSegments = String(route.path).split('/').filter(Boolean);
    if (routeSegments.length !== segments.length) return false;
    return routeSegments.every(
      (seg: string, i: number) => seg.startsWith(':') || seg === segments[i],
    );
  });
  if (!layer) throw new Error(`No handler for ${method.toUpperCase()} ${path}`);

  const fullReq: any = {
    originalUrl: path,
    ...req,
    body: req.body ?? {},
    params: req.params ?? {},
    query: req.query ?? {},
  };
  const res = makeRes();
  const handlers = layer.route.stack as { handle: (req: any, res: any, next: any) => unknown }[];

  // Chain handlers like Express: a middleware calls next() to continue. If a
  // middleware responds (sets a status) and returns without calling next, the
  // chain stops — mimicking real short-circuiting (e.g. validation 400). Handlers
  // may return a promise (asyncHandler), so each is awaited before proceeding.
  await new Promise<void>((resolve) => {
    let i = 0;
    const next = async () => {
      if (res.statusCode !== 0) return resolve();
      if (i >= handlers.length) return resolve();
      const h = handlers[i++]!;
      try {
        await h.handle(fullReq, res, next);
      } catch {
        // asyncHandler swallows thrown errors itself; ignore any that surface.
      }
      if (res.statusCode !== 0) return resolve();
      if (i >= handlers.length) return resolve();
    };
    void next();
  });

  for (let i = 0; i < 50; i++) {
    await new Promise((r) => setTimeout(r, 10));
    if (res.statusCode !== 0) break;
  }
  return res;
}
