import { googleMeetService } from "./google-meet.service";
import { Router, type Request, type Response } from 'express';
import { ok } from '../utils/apiUtils.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { logger } from '../utils/logger.js';

export const googleRouter = Router();


googleRouter.get('/meet', asyncHandler(async (_: Request, res: Response) => {
    try {
        const result = await googleMeetService.createMeetingSpace();
        ok(res, result);
    } catch (error) {
        logger.error({ err: error }, 'Error creating Google Meet space');
        res.error('Failed to create Google Meet space', 500);
    }
}));