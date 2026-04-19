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
import { authRouter } from './auth/auth.routes.js';
import { userRouter } from './users/user.routes.js';
import { locationRouter } from './locations/location.routes.js';
import { appointmentTypeRouter } from './appointment-types/appointment-type.routes.js';
import { medicalRecordRouter } from './medical-records/medical-record.routes.js';
import { authenticate, requireAdmin, requireAdminForWrites } from './middlewares/authenticate.js';
import { apiError } from './utils/apiUtils.js';
import cookieParser from 'cookie-parser';

const app: Application = express();

app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use(helmet());
app.use(cors({
    origin: (origin, callback) => {
        if (!origin || config.allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
}));
app.use(express.json({ limit: '64kb' }));
app.use(cookieParser())

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

// Strict rate limit scoped to login only — not /me or /refresh
const authWriteLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 50, standardHeaders: true, legacyHeaders: false });
app.use('/auth/login', authWriteLimit);

app.use('/', router);
app.use('/auth', authRouter);
app.use('/users', authenticate, requireAdmin, userRouter);
app.use('/notify', authenticate, requireAdmin, notifyRouter);
app.use('/patients', authenticate, requireAdminForWrites, patientRouter);
app.use('/reminders', authenticate, requireAdminForWrites, reminderRouter);
app.use('/appointments', authenticate, requireAdminForWrites, appointmentRouter);
app.use('/locations', authenticate, requireAdminForWrites, locationRouter);
app.use('/appointment-types', authenticate, requireAdminForWrites, appointmentTypeRouter);
app.use('/medical-records', authenticate, requireAdminForWrites, medicalRecordRouter);

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
