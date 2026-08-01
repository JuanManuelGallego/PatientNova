import { consentDocumentRepository } from './consent-document.repository.js';
import { logger } from '../utils/api/logger.js';
import { logAudit, computeDiff } from '../audit-log/audit-log.utils.js';
import type { CreateConsentDocumentDto, UpdateConsentDocumentDto } from './consent-document.schemas.js';
import { updateConsentDocumentSchema } from './consent-document.schemas.js';
import { EntityType, ActionType } from '../../generated/prisma/enums.ts';
import { schemaKeys } from '../utils/validation/schema-keys.js';

const CONSENT_DIFF_FIELDS = schemaKeys(updateConsentDocumentSchema);

export const consentDocumentService = {
  async findByUserIdOrNull(userId: string) {
    return consentDocumentRepository.findByUserIdOrNull(userId);
  },

  async create(dto: CreateConsentDocumentDto, userId: string) {
    const doc = await consentDocumentRepository.create(dto, userId);
    await logAudit({
      entityType: EntityType.CONSENT_DOCUMENT,
      entityId: userId,
      actionType: ActionType.CREATE,
      description: `Created consent document for user ${userId}`,
      affectedFields: Object.keys(dto),
      fieldsAfter: {
        name: doc.name,
        mimeType: doc.mimeType,
        sizeBytes: doc.sizeBytes,
        checksum: doc.checksum,
      },
    });
    logger.info({ userId }, 'Consent document created');
    return doc;
  },

  async update(userId: string, dto: UpdateConsentDocumentDto) {
    const before = await consentDocumentRepository.findByUserIdOrNull(userId);
    const doc = await consentDocumentRepository.update(userId, dto);
    const diff = before
      ? computeDiff(before as unknown as Record<string, unknown>, doc as unknown as Record<string, unknown>, CONSENT_DIFF_FIELDS)
      : { affectedFields: Object.keys(dto), fieldsBefore: null, fieldsAfter: dto as Record<string, unknown> };
    await logAudit({
      entityType: EntityType.CONSENT_DOCUMENT,
      entityId: userId,
      actionType: ActionType.UPDATE,
      description: `Updated consent document for user ${userId}`,
      ...diff,
    });
    logger.info({ userId, fields: Object.keys(dto) }, 'Consent document updated');
    return doc;
  },

  async delete(userId: string) {
    const doc = await consentDocumentRepository.delete(userId);
    await logAudit({
      entityType: EntityType.CONSENT_DOCUMENT,
      entityId: userId,
      actionType: ActionType.DELETE,
      description: `Deleted consent document for user ${userId}`,
    });
    logger.info({ userId }, 'Consent document deleted');
    return doc;
  },

  async getContent(userId: string) {
    return consentDocumentRepository.getContent(userId);
  },

  async getContentByUserId(userId: string) {
    return consentDocumentRepository.getContentByUserId(userId);
  },
};
