import { Router, type Request, type Response } from 'express';
import {
    createUserSchema,
    updateUserSchema,
    changePasswordSchema,
    superAdminUpdateUserSchema,
} from './user.schemas.js';
import { userService } from './user.service.js';
import { authenticate, requireSuperAdmin } from '../middlewares/authenticate.js';
import { validateBody } from '../middlewares/validate.js';
import { logger } from '../utils/logger.js';
import { ok } from '../utils/apiUtils.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { consentDocumentRouter } from '../consent-document/consent-document.routes.js';

export const userRouter = Router();

userRouter.post(
    '/',
    authenticate,
    requireSuperAdmin,
    validateBody(createUserSchema),
    asyncHandler(async (req: Request, res: Response) => {
        const user = await userService.create(req.body);
        logger.info({ userId: user.id, email: user.email }, 'User created');
        ok(res, user, 201);
    })
);

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

userRouter.get(
    '/me',
    authenticate,
    asyncHandler(async (req: Request, res: Response) => {
        ok(res, await userService.findById(req.user!.id));
    })
);

userRouter.get(
    '/:id',
    authenticate,
    requireSuperAdmin,
    asyncHandler(async (req: Request, res: Response) => {
        ok(res, await userService.findById(req.params.id as string));
    })
);

userRouter.patch(
    '/me',
    authenticate,
    validateBody(updateUserSchema),
    asyncHandler(async (req: Request, res: Response) => {
        const user = await userService.update(req.user!.id, req.body);
        logger.info({ userId: user.id }, 'User profile updated');
        ok(res, user);
    })
);

userRouter.patch(
    '/me/change-password',
    authenticate,
    validateBody(changePasswordSchema),
    asyncHandler(async (req: Request, res: Response) => {
        await userService.changePassword(req.user!.id, req.body.currentPassword, req.body.newPassword);
        logger.info({ userId: req.user!.id }, 'User password changed');
        ok(res, { message: 'Password changed successfully' });
    })
);

userRouter.use('/me/consent-document', consentDocumentRouter);

userRouter.patch(
    '/:id',
    authenticate,
    requireSuperAdmin,
    validateBody(superAdminUpdateUserSchema),
    asyncHandler(async (req: Request, res: Response) => {
        const user = await userService.update(req.params.id as string, req.body);
        logger.info({ userId: user.id }, 'User updated by super-admin');
        ok(res, user);
    })
);

userRouter.patch(
    '/:id/delete',
    authenticate,
    requireSuperAdmin,
    asyncHandler(async (req: Request, res: Response) => {
        const user = await userService.delete(req.params.id as string);
        logger.info({ userId: user.id }, 'User deleted by super-admin');
        ok(res, user);
    })
);

userRouter.patch(
    '/:id/restore',
    authenticate,
    requireSuperAdmin,
    asyncHandler(async (req: Request, res: Response) => {
        const user = await userService.restore(req.params.id as string);
        logger.info({ userId: user.id }, 'User restored by super-admin');
        ok(res, user);
    })
);
