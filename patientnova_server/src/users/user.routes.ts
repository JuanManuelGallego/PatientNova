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
import { handleError, ok } from '../utils/apiUtils.js';

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
    async (req: Request, res: Response) => {
        try {
            const user = await userRepository.create(req.body);
            logger.info({ userId: user.id, email: user.email }, 'User created');
            ok(res, user, 201);
        } catch (err) { handleError(res, err); }
    }
);

/**
 * GET /users
 * Super-admin only. Lists all users.
 */
userRouter.get(
    '/',
    authenticate,
    requireSuperAdmin,
    async (_req: Request, res: Response) => {
        try {
            ok(res, await userRepository.findMany());
        } catch (err) { handleError(res, err); }
    }
);

/**
 * GET /users
 * Super-admin only. Get an user by ID.
 */
userRouter.get(
    '/:id',
    authenticate,
    requireSuperAdmin,
    async (req: Request, res: Response) => {
        try {
            ok(res, await userRepository.findById(req.params.id as string));
        } catch (err) { handleError(res, err); }
    }
);
/**
 * GET /users/me
 * Returns info about the authenticated user.
 */
userRouter.get(
    '/me',
    authenticate,
    async (req: Request, res: Response) => {
        try {
            ok(res, await userRepository.findById(req.user!.id));
        } catch (err) { handleError(res, err); }
    }
);

/**
 * PATCH /users/me
 * Updates the authenticated user's profile fields.
 */
userRouter.patch(
    '/me',
    authenticate,
    validateBody(updateUserSchema),
    async (req: Request, res: Response) => {
        try {
            const user = await userRepository.update(req.user!.id, req.body);
            logger.info({ userId: user.id }, 'User profile updated');
            ok(res, user);
        } catch (err) { handleError(res, err); }
    }
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
    async (req: Request, res: Response) => {
        try {
            await userRepository.changePassword(req.user!.id, req.body.currentPassword, req.body.newPassword);
            logger.info({ userId: req.user!.id }, 'User password changed');
            ok(res, { message: 'Password changed successfully' });
        } catch (err) { handleError(res, err); }
    }
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
    async (req: Request, res: Response) => {
        try {
            const user = await userRepository.update(req.params.id as string, req.body);
            logger.info({ userId: user.id }, 'User updated by super-admin');
            ok(res, user);
        } catch (err) { handleError(res, err); }
    }
);