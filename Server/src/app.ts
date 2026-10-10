import express, { type Application, type Request, type Response } from 'express';
import { loggedPath } from './utils/api/request-context.js';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import { logger } from './utils/api/logger.js';
import { config } from './utils/config/config.js';
import { FIFTEEN_MINUTES_MS } from './utils/config/constants.js';
import { router } from './health.routes.js';
import { patientRouter } from './patients/patient.routes.js';
import { appointmentRouter } from './appointments/appointment.routes.js';
import { reminderRouter } from './reminders/reminder.routes.js';
import { notifyRouter } from './twilio/notify-sender.routes.js';
import { authRouter } from './auth/auth.routes.js';
import { userRouter } from './users/user.routes.js';
import { locationRouter } from './locations/location.routes.js';
import { appointmentTypeRouter } from './appointment-types/appointment-type.routes.js';
import { medicalRecordRouter } from './medical-records/medical-record.routes.js';
import { authenticate, requireAdmin, requireAdminForWrites } from './middlewares/authenticate.js';
import { twilioWebhookRouter } from './twilio/webhook.routes.js';
import { brevoWebhookRouter } from './brevo/brevo-webhook.routes.js';
import { apiError } from './utils/api/api-utils.js';
import cookieParser from 'cookie-parser';

import { consentDocumentRouter } from './consent-documents/consent-document.routes.js';
import { blockedTimeRouter } from './blocked-time/blocked-time.routes.js';
import { auditLogRouter } from './audit-log/audit-log.routes.js';
import { googleRouter } from './google/google.routes.js';
import { httpLogger } from './middlewares/http-logger.js';
import { requestId } from './middlewares/request-id.js';
import { errorHandler, CorsRejectionError } from './middlewares/error-handler.js';

const DEFAULT_BODY_LIMIT = '100kb';
const LARGE_BODY_LIMITS = { users: '2mb', files: '15mb', webhooks: '1mb' } as const;

const app: Application = express();

app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use(requestId);
app.use(helmet());
app.use(cors({
    origin: (origin, callback) => {
        if (!origin || config.allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            logger.warn({ origin }, 'CORS rejection');
            callback(new CorsRejectionError());
        }
    },
    credentials: true,
}));
// Rate limits run before body parsing so throttled clients never get their payloads read.
app.use(
    rateLimit({
        windowMs: config.rateLimit.windowMs,
        max: config.rateLimit.maxRequests,
        standardHeaders: true,
        legacyHeaders: false,
        handler: (req, res) => {
            logger.warn({ ip: req.ip, url: loggedPath(req), method: req.method }, 'Rate limit exceeded');
            apiError(res, 'Too many requests — please slow down.', 429);
        }
    }));

// Strict rate limit scoped to login only — not /me or /refresh
const authWriteLimit = rateLimit({ windowMs: FIFTEEN_MINUTES_MS, max: 50, standardHeaders: true, legacyHeaders: false });
app.use('/v1/auth/login', authWriteLimit);

// Small default body limit; only routes that accept base64 files (avatars/logos, consent
// documents, medical-record attachments) and batched Brevo webhooks get a larger one. The first parser to run wins.
app.use('/v1/users', express.json({ limit: LARGE_BODY_LIMITS.users }));
app.use([ '/v1/consent-document', '/v1/medical-records' ], express.json({ limit: LARGE_BODY_LIMITS.files }));
app.use('/webhooks/brevo', express.json({ limit: LARGE_BODY_LIMITS.webhooks })); // batched events
app.use(express.json({ limit: DEFAULT_BODY_LIMIT }));
app.use(express.urlencoded({ extended: true, limit: DEFAULT_BODY_LIMIT }));
app.use(cookieParser())
app.use(httpLogger);

// Unversioned infra/external routes: health check (root router) and the public webhooks.
app.use('/', router);
app.use('/webhooks/twilio', express.urlencoded({ extended: false }), twilioWebhookRouter);
app.use('/webhooks/brevo', brevoWebhookRouter);

// Versioned API — all application endpoints live under /v1.
const v1 = express.Router();

v1.use('/', router);

// Public (no auth)
v1.use('/auth', authRouter);
v1.use('/consent-document', consentDocumentRouter);
// Public Google OAuth callback (authenticated via one-time state)
v1.use('/google', googleRouter);

// Admin-only (read)
v1.use('/users', authenticate, requireAdmin, userRouter);
v1.use('/notify', authenticate, requireAdmin, notifyRouter);

// Admin (read + write)
v1.use('/patients', authenticate, requireAdminForWrites, patientRouter);
v1.use('/reminders', authenticate, requireAdminForWrites, reminderRouter);
v1.use('/appointments', authenticate, requireAdminForWrites, appointmentRouter);
v1.use('/locations', authenticate, requireAdminForWrites, locationRouter);
v1.use('/appointment-types', authenticate, requireAdminForWrites, appointmentTypeRouter);
v1.use('/medical-records', authenticate, requireAdminForWrites, medicalRecordRouter);
v1.use('/blocked-time', authenticate, requireAdminForWrites, blockedTimeRouter);

v1.use('/audit-logs', authenticate, requireAdminForWrites, auditLogRouter);

app.use('/v1', v1);

app.use((req: Request, res: Response) => {
    logger.debug(
        {
            method: req.method,
            url: loggedPath(req),
            contentType: req.headers['content-type'],
            userAgent: req.headers['user-agent'],
        },
        'Route not found'
    );
    apiError(res, 'Route not found', 404);
});

app.use(errorHandler);

export default app;
