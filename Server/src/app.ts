import express, { type Application, type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import { logger } from './utils/logger.js';
import { config } from './utils/config.js';
import { FIFTEEN_MINUTES_MS } from './utils/constants.js';
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
import { twilioWebhookRouter } from './twilio/twilio.webhook.routes.js';
import { apiError } from './utils/apiUtils.js';
import cookieParser from 'cookie-parser';
import { googleRouter } from './google/google.routes.js';
import { consentDocumentRouter } from './consent-document/consent-document.routes.js';
import { httpLogger } from './middlewares/httpLogger.js';

const app: Application = express();

app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use(helmet());
app.use(cors({
    origin: (origin, callback) => {
        if (!origin || config.allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            logger.warn({ origin }, 'CORS rejection');
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
}));
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));
app.use(cookieParser())
app.use(httpLogger);

app.use(
    rateLimit({
        windowMs: config.rateLimit.windowMs,
        max: config.rateLimit.maxRequests,
        standardHeaders: true,
        legacyHeaders: false,
        handler: (req, res) => {
            logger.warn({ ip: req.ip, url: req.originalUrl, method: req.method }, 'Rate limit exceeded');
            apiError(res, 'Too many requests — please slow down.', 429);
        }
    }));

// Strict rate limit scoped to login only — not /me or /refresh
const authWriteLimit = rateLimit({ windowMs: FIFTEEN_MINUTES_MS, max: 50, standardHeaders: true, legacyHeaders: false });
app.use('/v1/auth/login', authWriteLimit);

// Unversioned infra/external routes: health check (root router) and the public Twilio webhook.
app.use('/', router);
app.use('/webhooks/twilio', express.urlencoded({ extended: false }), twilioWebhookRouter);

// Versioned API — all application endpoints live under /v1.
const v1 = express.Router();

v1.use('/', router);
v1.use('/auth', authRouter);
v1.use('/consent-document', consentDocumentRouter);

v1.use('/users', authenticate, requireAdmin, userRouter);
v1.use('/notify', authenticate, requireAdmin, notifyRouter);
v1.use('/patients', authenticate, requireAdminForWrites, patientRouter);
v1.use('/reminders', authenticate, requireAdminForWrites, reminderRouter);
v1.use('/appointments', authenticate, requireAdminForWrites, appointmentRouter);
v1.use('/locations', authenticate, requireAdminForWrites, locationRouter);
v1.use('/appointment-types', authenticate, requireAdminForWrites, appointmentTypeRouter);
v1.use('/medical-records', authenticate, requireAdminForWrites, medicalRecordRouter);
v1.use('/google', authenticate, requireAdminForWrites, googleRouter);

app.use('/v1', v1);

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
