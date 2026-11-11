import type { Request } from 'express';
import type { ConsentRequestMeta } from '../../patient-consents/patient-consent.service.js';

export const requestMeta = (req: Request): ConsentRequestMeta => ({
  ipAddress: req.ip?.replace('::ffff:', ''),
  userAgent: req.get('user-agent'),
});
