import { prisma } from '../prisma/prismaClient.js';
import type { CreateConsentDocumentDto, UpdateConsentDocumentDto } from './consent-document.schemas.js';
import { ConsentDocumentNotFoundError, ConsentDocumentAlreadyExistsError } from '../utils/errors.js';

export const consentDocumentRepository = {
    async create(dto: CreateConsentDocumentDto, userId: string) {
        const existing = await prisma.document.findFirst({
            where: { userId },
        });
        if (existing) {
            throw new ConsentDocumentAlreadyExistsError(userId);
        }

        return prisma.document.create({
            data: {
                userId,
                name: dto.name,
                content: Buffer.from(dto.content, 'base64'),
                mimeType: dto.mimeType,
                sizeBytes: Buffer.byteLength(dto.content, 'base64'),
            },
        });
    },

    async findByUserId(userId: string) {
        const document = await prisma.document.findFirst({
            where: { userId },
        });
        if (!document) {
            throw new ConsentDocumentNotFoundError(userId);
        }
        return document;
    },

    async findByUserIdOrNull(userId: string) {
        return prisma.document.findFirst({
            where: { userId },
        });
    },

    async update(userId: string, dto: UpdateConsentDocumentDto) {
        const existing = await prisma.document.findFirst({
            where: { userId },
        });
        if (!existing) {
            throw new ConsentDocumentNotFoundError(userId);
        }

        const data: any = {};
        if (dto.name !== undefined) data.name = dto.name;
        if (dto.mimeType !== undefined) data.mimeType = dto.mimeType;
        if (dto.content !== undefined) {
            data.content = Buffer.from(dto.content, 'base64');
            data.sizeBytes = Buffer.byteLength(dto.content, 'base64');
        }

        return prisma.document.update({
            where: { id: existing.id },
            data,
        });
    },

    async delete(userId: string) {
        const existing = await prisma.document.findFirst({
            where: { userId },
        });
        if (!existing) {
            throw new ConsentDocumentNotFoundError(userId);
        }

        return prisma.document.delete({
            where: { id: existing.id },
        });
    },

    async getContent(userId: string) {
        const document = await prisma.document.findFirst({
            where: { userId },
        });
        if (!document) {
            throw new ConsentDocumentNotFoundError(userId);
        }

        return {
            id: document.id,
            name: document.name,
            mimeType: document.mimeType,
            content: document.content.toString(),
            sizeBytes: document.sizeBytes,
            createdAt: document.createdAt,
            updatedAt: document.updatedAt,
        };
    },

    async getContentByUserId(userId: string) {
        const document = await prisma.document.findUnique({
            where: { userId },
        });
        if (!document) {
            throw new ConsentDocumentNotFoundError(userId);
        }

        return {
            id: document.id,
            name: document.name,
            mimeType: document.mimeType,
            content: document.content,
            sizeBytes: document.sizeBytes,
            createdAt: document.createdAt,
            updatedAt: document.updatedAt,
        };
    },
};
