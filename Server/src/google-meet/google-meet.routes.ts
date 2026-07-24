import { googleMeetService } from "./google-meet.service.js";
import { Router, type Request, type Response } from 'express';
import { apiError, ok } from '../utils/api/api-utils.js';
import { asyncHandler } from '../utils/api/async-handler.js';
import { logger } from '../utils/api/logger.js';

export const googleRouter = Router();

googleRouter.get('/meet', asyncHandler(async (_req: Request, res: Response) => {
    try {
        const result = await googleMeetService.createMeetingSpace();
        ok(res, result);
    } catch (error) {
        logger.error({ err: error }, 'Google Meet creation failed');
        apiError(res, 'Failed to create Google Meet space', 500);
    }
}));
