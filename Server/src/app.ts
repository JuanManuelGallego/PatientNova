import express, { type Application, type Request, type Response } from 'express';
import { loggedPath } from './utils/api/request-context.js';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import { logger } from './utils/api/logger.js';
import { config } from './utils/config/config.js';
import { FIFTEEN_MINUTES_MS } from './utils/config/constants.js';
import { router } from './health.routes.js';
import { messageStatusRouter } from './twilio/message-status.routes.js';
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
import { providerCors } from './middlewares/cors.js';
import { createPortalSessionRouter, createPublicApiRouter, portalNotFound } from './portal/portal-routers.js';
import { errorHandler } from './middlewares/error-handler.js';

const app: Application = express();

app.disable('x-powered-by');
// Exactly ONE trusted proxy hop (the platform load balancer in front of the API), so req.ip is the
// real client address that rate limits key on. Adding another proxy/CDN layer requires updating this.
app.set('trust proxy', 1);

app.use(requestId);
app.use(helmet());
app.use(httpLogger);
// Public patient-portal API classes are mounted BEFORE the provider CORS / 15mb parsers / global
// rate limiter: each class carries its own CORS policy, tiny body limit and shared-store limits.
// They are dark unless ENABLE_PORTAL=true (then unknown paths fall through like any other 404).
// Routes are added in Phase 2/3; unmatched paths end in a JSON 404 so they never reach the
// provider stack.
if (config.portal.patientEnabled) {
    app.use('/v1/public', createPublicApiRouter(), portalNotFound);
    app.use('/v1/portal', createPortalSessionRouter(), portalNotFound);
}

// Provider (admin) API CORS: credentialed, exact allow-list.
app.use(providerCors);
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true, limit: "15mb" }));
app.use(cookieParser())

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

// Unversioned infra/external routes: health check (root router), message status, and the public Twilio webhook.
app.use('/', router);
app.use('/', messageStatusRouter);
app.use('/webhooks/twilio', express.urlencoded({ extended: false }), twilioWebhookRouter);
app.use('/webhooks/brevo', brevoWebhookRouter);

// Versioned API — all application endpoints live under /v1.
const v1 = express.Router();

v1.use('/', router);
v1.use('/', messageStatusRouter);

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
