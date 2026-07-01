import { consentDocumentRepository } from './consent-document.repository.js';
import type { CreateConsentDocumentDto, UpdateConsentDocumentDto } from './consent-document.schemas.js';

export const consentDocumentService = {
  async findByUserIdOrNull(userId: string) {
    return consentDocumentRepository.findByUserIdOrNull(userId);
  },

  async create(dto: CreateConsentDocumentDto, userId: string) {
    return consentDocumentRepository.create(dto, userId);
  },

  async update(userId: string, dto: UpdateConsentDocumentDto) {
    return consentDocumentRepository.update(userId, dto);
  },

  async delete(userId: string) {
    return consentDocumentRepository.delete(userId);
  },

  async getContent(userId: string) {
    return consentDocumentRepository.getContent(userId);
  },

  async getContentByUserId(userId: string) {
    return consentDocumentRepository.getContentByUserId(userId);
  },
};
