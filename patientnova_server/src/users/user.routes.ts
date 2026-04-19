import { Router, type Request, type Response } from 'express';
import {
    createUserSchema,
    updateUserSchema,
    changePasswordSchema,
    superAdminUpdateUserSchema,
} from './user.schemas.js';
import { userRepository } from './user.repository.js';
import { authenticate, requireSuperAdmin } from '../middlewares/authenticate.js';
import { validateBody } from '../middlewares/validate.js';
import { logger } from '../utils/logger.js';
import { ok } from '../utils/apiUtils.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const userRouter = Router();

/**
 * POST /users
 * Super-admin only. Creates a new user with a hashed password.
 */
userRouter.post(
    '/',
    authenticate,
    requireSuperAdmin,
    validateBody(createUserSchema),
    asyncHandler(async (req: Request, res: Response) => {
        const user = await userRepository.create(req.body);
        logger.info({ userId: user.id, email: user.email }, 'User created');
        ok(res, user, 201);
    })
);

/**
 * GET /users
 * Super-admin only. Lists all users.
 */
userRouter.get(
    '/',
    authenticate,
    requireSuperAdmin,
    asyncHandler(async (_req: Request, res: Response) => {
        ok(res, await userRepository.findMany());
    })
);

/**
 * GET /users/me
 * Returns info about the authenticated user.
 */
userRouter.get(
    '/me',
    authenticate,
    asyncHandler(async (req: Request, res: Response) => {
        ok(res, await userRepository.findById(req.user!.id));
    })
);

/**
 * GET /users/:id
 * Super-admin only. Get a user by ID.
 */
userRouter.get(
    '/:id',
    authenticate,
    requireSuperAdmin,
    asyncHandler(async (req: Request, res: Response) => {
        ok(res, await userRepository.findById(req.params.id as string));
    })
);

/**
 * PATCH /users/me
 * Updates the authenticated user's profile fields.
 */
userRouter.patch(
    '/me',
    authenticate,
    validateBody(updateUserSchema),
    asyncHandler(async (req: Request, res: Response) => {
        const user = await userRepository.update(req.user!.id, req.body);
        logger.info({ userId: user.id }, 'User profile updated');
        ok(res, user);
    })
);

/**
 * PATCH /users/me/change-password
 * Verifies current password then updates to the new hashed password.
 * Increments refreshTokenVersion to invalidate all existing sessions.
 */
userRouter.patch(
    '/me/change-password',
    authenticate,
    validateBody(changePasswordSchema),
    asyncHandler(async (req: Request, res: Response) => {
        await userRepository.changePassword(req.user!.id, req.body.currentPassword, req.body.newPassword);
        logger.info({ userId: req.user!.id }, 'User password changed');
        ok(res, { message: 'Password changed successfully' });
    })
);

/**
 * PATCH /users/:id
 * Super-admin only. Updates another user's profile fields, role, or status.
 * Does not allow changing the password.
 */
userRouter.patch(
    '/:id',
    authenticate,
    requireSuperAdmin,
    validateBody(superAdminUpdateUserSchema),
    asyncHandler(async (req: Request, res: Response) => {
        const user = await userRepository.update(req.params.id as string, req.body);
        logger.info({ userId: user.id }, 'User updated by super-admin');
        ok(res, user);
    })
);