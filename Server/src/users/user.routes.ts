import { Router, type Request, type Response } from 'express';
import {
    createUserSchema,
    updateUserSchema,
    superAdminUpdateUserSchema,
} from './user.schemas.js';
import { userService } from './user.service.js';
import { authenticate, requireSuperAdmin } from '../middlewares/authenticate.js';
import { validateBody } from '../middlewares/validate.js';
import { ok } from '../utils/api/api-utils.js';
import { asyncHandler } from '../utils/api/async-handler.js';
import { consentDocumentRouter } from '../consent-documents/consent-document.routes.js';

export const userRouter = Router();

/**
 * POST /users
 * Create a new user (super admin only).
 */
userRouter.post(
    '/',
    authenticate,
    requireSuperAdmin,
    validateBody(createUserSchema),
    asyncHandler(async (req: Request, res: Response) => {
        const user = await userService.create(req.body);
        ok(res, user, 201);
    })
);

/**
 * GET /users
 * List all users (super admin only). Optionally includes soft-deleted users.
 */
userRouter.get(
    '/',
    authenticate,
    requireSuperAdmin,
    asyncHandler(async (req: Request, res: Response) => {
        const query = req.query as { includeDeleted?: string };
        const includeDeleted = query.includeDeleted === 'true';
        ok(res, await userService.findMany({ includeDeleted }));
    })
);

/**
 * GET /users/me
 * Get the current authenticated user's profile.
 */
userRouter.get(
    '/me',
    authenticate,
    asyncHandler(async (req: Request, res: Response) => {
        ok(res, await userService.findById(req.user!.id));
    })
);

/**
 * GET /users/:id
 * Get a user by UUID (super admin only).
 */
userRouter.get(
    '/:id',
    authenticate,
    requireSuperAdmin,
    asyncHandler(async (req: Request, res: Response) => {
        ok(res, await userService.findById(req.params.id as string));
    })
);

/**
 * PATCH /users/me
 * Update the current authenticated user's profile.
 */
userRouter.patch(
    '/me',
    authenticate,
    validateBody(updateUserSchema),
    asyncHandler(async (req: Request, res: Response) => {
        const user = await userService.update(req.user!.id, req.body);
        ok(res, user);
    })
);

userRouter.use('/me/consent-document', consentDocumentRouter);

/**
 * PATCH /users/:id
 * Update a user (super admin only).
 */
userRouter.patch(
    '/:id',
    authenticate,
    requireSuperAdmin,
    validateBody(superAdminUpdateUserSchema),
    asyncHandler(async (req: Request, res: Response) => {
        const user = await userService.update(req.params.id as string, req.body);
        ok(res, user);
    })
);

/**
 * PATCH /users/:id/delete
 * Soft-delete a user (super admin only, sets isDeleted=true).
 */
userRouter.patch(
    '/:id/delete',
    authenticate,
    requireSuperAdmin,
    asyncHandler(async (req: Request, res: Response) => {
        const user = await userService.delete(req.params.id as string);
        ok(res, user);
    })
);

/**
 * PATCH /users/:id/restore
 * Restore a soft-deleted user (super admin only, sets isDeleted=false).
 */
userRouter.patch(
    '/:id/restore',
    authenticate,
    requireSuperAdmin,
    asyncHandler(async (req: Request, res: Response) => {
        const user = await userService.restore(req.params.id as string);
        ok(res, user);
    })
);
