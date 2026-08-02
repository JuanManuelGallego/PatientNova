import { Router, type Request, type Response } from 'express';
import type { ParamsDictionary } from 'express-serve-static-core';
import type { ParsedQs } from 'qs';
import { listAuditLogsSchema, type ListAuditLogsQuery } from './audit-log.schemas.js';
import { auditLogService } from './audit-log.service.js';
import { validateQuery, validateParams } from '../middlewares/validate.js';
import { ok } from '../utils/api/api-utils.js';
import { asyncHandler } from '../utils/api/async-handler.js';
import { uuidParamSchema } from '../utils/validation/schemas.js';

export const auditLogRouter = Router();

/**
 * GET /audit-logs
 * List audit logs with optional filters and pagination.
 */
auditLogRouter.get<ParamsDictionary, unknown, unknown, ListAuditLogsQuery & ParsedQs>(
  '/',
  validateQuery(listAuditLogsSchema),
  asyncHandler(async (req: Request<ParamsDictionary, unknown, unknown, ListAuditLogsQuery & ParsedQs>, res: Response) => {
    ok(res, await auditLogService.findMany(req.user!.id, req.query));
  })
);

/**
 * GET /audit-logs/:id
 * Get a single audit log by UUID.
 */
auditLogRouter.get(
  '/:id',
  validateParams(uuidParamSchema),
  asyncHandler(async (req: Request, res: Response) => {
    ok(res, await auditLogService.findById(req.params.id as string, req.user!.id));
  })
);
