import type { Request, Response, NextFunction } from 'express';
import { loggedPath } from '../utils/api/request-context.js';
import { apiError, handleError } from '../utils/api/api-utils.js';
import { logger } from '../utils/api/logger.js';
import { prisma } from '../utils/prisma/prisma-client.js';

/**
 * Like requireSuperAdmin, but also re-reads the actor so a super admin who was
 * demoted, deactivated or deleted cannot use a still-valid access token.
 * Must be used after authenticate(). Kept apart from authenticate.ts so that
 * module stays free of the Prisma client.
 */
export async function requireActiveSuperAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  const deny = () => {
    logger.warn({ userId: req.user?.id, role: req.user?.role, method: req.method, url: loggedPath(req) }, 'Permission denied: requires SUPER_ADMIN');
    apiError(res, 'Insufficient permissions', 403);
  };
  if (req.user?.role !== 'SUPER_ADMIN') return deny();
  try {
    const actor = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { role: true, status: true, isDeleted: true },
    });
    if (!actor || actor.role !== 'SUPER_ADMIN' || actor.status !== 'ACTIVE' || actor.isDeleted) return deny();
  } catch (err) {
    handleError(res, err);
    return;
  }
  next();
}
