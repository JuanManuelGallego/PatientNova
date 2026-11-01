import { logger } from '../../utils/api/logger.js';
import { portalOtpRepository } from '../../portal/portal-otp.repository.js';

export const PORTAL_OTP_RETENTION_MS = 24 * 60 * 60 * 1000;

export async function purgePortalOtpsWorker(): Promise<void> {
  const count = await portalOtpRepository.purgeSentBefore(new Date(Date.now() - PORTAL_OTP_RETENTION_MS));
  if (count > 0) logger.info({ count }, 'Purged stale portal OTP rows');
}
