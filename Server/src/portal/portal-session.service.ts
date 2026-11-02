import { prisma, type TransactionClient } from '../utils/prisma/prisma-client.js';
import { portalSecret } from '../auth/tokens.js';
import { createCsrfToken } from '../utils/security/csrf.js';
import { runInAuditContext } from '../audit-log/audit-log-context.js';
import { portalPatientAuditContext } from '../audit-log/audit-actors.js';
import { bookingSettingsRepository } from '../booking-settings/booking-settings.repository.js';
import { ensureCurrentConsent, hasCurrentConsent, type ConsentRequestMeta } from '../patient-consents/patient-consent.service.js';
import { resolvePortalPatient, type PortalPatientResolution } from './patient-resolution.js';
import { PRIVACY_POLICY_VERSION } from './privacy-policy.js';
import type { PortalSessionContext } from './portal-session.middleware.js';

export interface PortalSessionView {
  email: string;
  expiresAt: string;
  csrfToken: string;
  providerSlug: string;
  consentRequired: boolean;
}

/** False only for a resolved patient with an active consent at the current policy version. */
export async function isConsentRequired(resolution: PortalPatientResolution, tx?: TransactionClient): Promise<boolean> {
  return resolution.kind !== 'patient'
    || !(await hasCurrentConsent(resolution.patientId, PRIVACY_POLICY_VERSION, tx));
}

export const portalSessionService = {
  async getSession(session: PortalSessionContext): Promise<PortalSessionView> {
    const [ state, resolution ] = await Promise.all([
      bookingSettingsRepository.getBookingState(session.userId),
      resolvePortalPatient(session),
    ]);
    const consentRequired = await isConsentRequired(resolution);
    return {
      email: session.email,
      expiresAt: session.expiresAt.toISOString(),
      csrfToken: createCsrfToken(session.sid, portalSecret()),
      providerSlug: state?.bookingSlug ?? '',
      consentRequired,
    };
  },

  async acceptConsent(session: PortalSessionContext, meta: ConsentRequestMeta): Promise<void> {
    const auditContext = portalPatientAuditContext({
      userId: session.userId,
      email: session.email,
      ipAddress: meta.ipAddress,
    });
    await runInAuditContext(auditContext, () => prisma.$transaction(async (tx) => {
      const resolution = await resolvePortalPatient(session, tx);
      if (resolution.kind !== 'patient') return;
      await ensureCurrentConsent(tx, { patientId: resolution.patientId, userId: session.userId }, PRIVACY_POLICY_VERSION, meta);
    }));
  },
};
