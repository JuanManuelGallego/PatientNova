import { consentDocumentRepository } from './consent-document.repository.js';
import { logger } from '../utils/api/logger.js';
import type { CreateConsentDocumentDto, UpdateConsentDocumentDto } from './consent-document.schemas.js';

export const consentDocumentService = {
  async findByUserIdOrNull(userId: string) {
    return consentDocumentRepository.findByUserIdOrNull(userId);
  },

  async create(dto: CreateConsentDocumentDto, userId: string) {
    const doc = await consentDocumentRepository.create(dto, userId);
    logger.info({ userId }, 'Consent document created');
    return doc;
  },

  async update(userId: string, dto: UpdateConsentDocumentDto) {
    const doc = await consentDocumentRepository.update(userId, dto);
    logger.info({ userId, fields: Object.keys(dto) }, 'Consent document updated');
    return doc;
  },

  async delete(userId: string) {
    const doc = await consentDocumentRepository.delete(userId);
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
