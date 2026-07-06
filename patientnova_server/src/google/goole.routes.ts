import { googleMeetService } from "./google-meet.service";
import { Router, type Request, type Response } from 'express';
import { ok } from '../utils/apiUtils.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { logger } from '../utils/logger.js';

export const googleRouter = Router();

googleRouter.get('/meet', asyncHandler(async (_req: Request, res: Response) => {
    try {
        const result = await googleMeetService.createMeetingSpace();
        ok(res, result);
    } catch (error) {
        logger.error({ err: error }, 'Google Meet creation failed');
        res.error('Failed to create Google Meet space', 500);
    }
}));
