import express, { type Application, type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import { logger } from './utils/logger.js';
import { config } from './utils/config.js';
import { router } from './routes.js';
import { patientRouter } from './patients/patient.routes.js';
import { appointmentRouter } from './appointments/appointment.routes.js';
import { reminderRouter } from './reminders/reminder.routes.js';
import { notifyRouter } from './notify/notify.routes.js';
import { apiError } from './utils/apiUtils.js';

const app: Application = express();

app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '64kb' }));

app.use((req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    logger.info(`INCOMING  ${req.method} ${req.originalUrl} ${req?.ip?.replace('::ffff:', '')}`);

    res.on('finish', () => {
        logger.info(`COMPLETED ${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - start}ms`);
    });
    next();
});

app.use(
    rateLimit({
        windowMs: config.rateLimit.windowMs,
        max: config.rateLimit.maxRequests,
        standardHeaders: true,
        legacyHeaders: false,
        handler: (_req, res) => {
            apiError(res, 'Too many requests — please slow down.', 429);
        }
    }));

app.use('/', router);
app.use('/notify', notifyRouter);
app.use('/patients', patientRouter);
app.use('/reminders', reminderRouter);
app.use('/appointments', appointmentRouter);

app.use((_req: Request, res: Response) => {
    apiError(res, 'Route not found', 404);
});

app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
    logger.error(
        {
            err,
            method: req.method,
            url: req.originalUrl
        },
        'Unhandled error'
    );

    apiError(
        res,
        process.env.NODE_ENV === 'production'
            ? 'Internal server error'
            : err.message,
        500
    );
});

export default app;
