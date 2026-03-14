import express, { type Application, type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { logger } from './logger.js';
import { config } from './config.js';
import type { ApiResponse } from './types.js';
import { router } from './routes.js';

const app: Application = express();

app.set('trust proxy', 1);
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '64kb' }));

function apiError(message: string): ApiResponse {
    return {
        success: false,
        error: message,
        timestamp: new Date().toISOString()
    };
}

const limiter = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.maxRequests,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => {
        const body: ApiResponse = apiError('Too many requests — please slow down.');
        res.status(429).json(body);
    },
});

app.use('/notify', limiter);

app.use((req: Request, _res: Response, next: NextFunction) => {
    logger.info({ method: req.method, url: req.url, ip: req.ip }, 'Incoming request');
    next();
});

app.use('/', router);

app.use((_req: Request, res: Response) => {
    const body: ApiResponse = apiError('Route not found');
    res.status(404).json(body);
});

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    logger.error({ err }, 'Unhandled error');
    const body: ApiResponse = apiError(process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message);
    res.status(500).json(body);
});

export default app;
