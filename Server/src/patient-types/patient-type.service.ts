import { ActionType, EntityType } from '../../generated/prisma/enums.ts';
import { logAudit } from '../audit-log/audit-log.utils.js';
import { logger } from '../utils/api/logger.js';
import { isPrismaUniqueConstraintError } from '../utils/errors/prisma-errors.js';
import { prisma, type TransactionClient } from '../utils/prisma/prisma-client.js';
import { withProviderLock } from '../utils/prisma/provider-lock.js';
import {
  ConsentVersionNotFoundError,
  ConsentVersionNotPdfError,
  ConsentVersionTooLargeError,
  PatientTypeInUseError,
  PatientTypeIsDefaultError,
  PatientTypeNameConflictError,
  PatientTypeNotFoundError,
} from './patient-type.errors.js';
import { DEFAULT_PATIENT_TYPE_NAME, patientTypeRepository } from './patient-type.repository.js';
import type { CreateConsentVersionDto, CreatePatientTypeDto, UpdatePatientTypeDto } from './patient-type.schemas.js';

export const CONSENT_PDF_MAX_BYTES = 10 * 1024 * 1024;
const PDF_MAGIC = Buffer.from('%PDF-');

type ListedType = Awaited<ReturnType<typeof patientTypeRepository.listWithMeta>>[ number ];

export interface ConsentVersionDto {
  id: string;
  version: number;
  name: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: Date;
}

export interface PatientTypeDto {
  id: string;
  name: string;
  isDefault: boolean;
  template: unknown;
  familyMembersEnabled: boolean;
  subsystemRelationsEnabled: boolean;
  patientCount: number;
  currentVersion: ConsentVersionDto | null;
  createdAt: Date;
  updatedAt: Date;
}

function toDto(row: ListedType, defaultId: string | null): PatientTypeDto {
  return {
    id: row.id,
    name: row.name,
    isDefault: row.id === defaultId,
    template: row.template,
    familyMembersEnabled: row.familyMembersEnabled,
    subsystemRelationsEnabled: row.subsystemRelationsEnabled,
    patientCount: row._count.patients,
    currentVersion: row.consentVersions[ 0 ] ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * The provider's default patient type, created ("General", empty template) when the provider has none yet: a new
 * account, or a user written before patient types. Call it under the provider lock, or in the transaction that
 * creates the user, so two callers cannot both create one.
 */
export async function ensureDefaultPatientType(tx: TransactionClient, userId: string): Promise<string> {
  const current = await patientTypeRepository.defaultIdOf(userId, tx);
  if (current) return current;
  const type = await tx.patientType.findFirst({ where: { userId, name: DEFAULT_PATIENT_TYPE_NAME }, select: { id: true } })
    ?? await tx.patientType.create({ data: { userId, name: DEFAULT_PATIENT_TYPE_NAME }, select: { id: true } });
  await tx.user.update({ where: { id: userId }, data: { defaultPatientTypeId: type.id } });
  return type.id;
}

/** The type a new patient gets: the one asked for (it must be the provider's), else the provider's default. */
export async function resolvePatientTypeId(tx: TransactionClient, userId: string, requested?: string | null): Promise<string> {
  if (!requested) return ensureDefaultPatientType(tx, userId);
  const type = await patientTypeRepository.findOwned(userId, requested, tx);
  if (!type) throw new PatientTypeNotFoundError();
  return type.id;
}

async function requireOwned(userId: string, id: string, tx: TransactionClient = prisma) {
  const type = await patientTypeRepository.findOwned(userId, id, tx);
  if (!type) throw new PatientTypeNotFoundError();
  return type;
}

async function findDto(userId: string, id: string, tx: TransactionClient = prisma): Promise<PatientTypeDto> {
  const [ rows, defaultId ] = await Promise.all([
    patientTypeRepository.listWithMeta(userId, tx),
    patientTypeRepository.defaultIdOf(userId, tx),
  ]);
  const row = rows.find((r) => r.id === id);
  if (!row) throw new PatientTypeNotFoundError();
  return toDto(row, defaultId);
}

function nameConflict<T>(promise: Promise<T>): Promise<T> {
  return promise.catch((err: unknown) => {
    if (isPrismaUniqueConstraintError(err)) throw new PatientTypeNameConflictError();
    throw err;
  });
}

/** Accepts plain base64 or a data URL; checks the bytes are a PDF, whatever the client declared. */
function decodePdf(content: string): Buffer {
  const base64 = content.startsWith('data:') ? content.slice(content.indexOf(',') + 1) : content;
  const bytes = Buffer.from(base64, 'base64');
  if (bytes.length > CONSENT_PDF_MAX_BYTES) throw new ConsentVersionTooLargeError(CONSENT_PDF_MAX_BYTES / (1024 * 1024));
  if (bytes.length < PDF_MAGIC.length || !bytes.subarray(0, PDF_MAGIC.length).equals(PDF_MAGIC)) {
    throw new ConsentVersionNotPdfError();
  }
  return bytes;
}

export const patientTypeService = {
  async list(userId: string): Promise<PatientTypeDto[]> {
    // A provider without a default (should not happen after the migration) gets one here, so the list always has one.
    const defaultId = await patientTypeRepository.defaultIdOf(userId) ?? await prisma.$transaction(async (tx) => {
      await withProviderLock(tx, userId);
      return ensureDefaultPatientType(tx, userId);
    });
    const rows = await patientTypeRepository.listWithMeta(userId);
    return rows.map((r) => toDto(r, defaultId));
  },

  async create(userId: string, dto: CreatePatientTypeDto): Promise<PatientTypeDto> {
    return prisma.$transaction(async (tx) => {
      await withProviderLock(tx, userId);
      const type = await nameConflict(tx.patientType.create({ data: { userId, name: dto.name } }));
      await logAudit({
        entityType: EntityType.PATIENT_TYPE,
        entityId: type.id,
        userId,
        actionType: ActionType.CREATE,
        description: `Tipo de paciente creado: ${type.name}`,
        affectedFields: [ 'name' ],
        fieldsAfter: { name: type.name, template: type.template },
        tx,
        required: true,
      });
      return findDto(userId, type.id, tx);
    });
  },

  async update(userId: string, id: string, dto: UpdatePatientTypeDto): Promise<PatientTypeDto> {
    return prisma.$transaction(async (tx) => {
      await withProviderLock(tx, userId);
      const before = await requireOwned(userId, id, tx);
      if (before.name !== dto.name) {
        await nameConflict(tx.patientType.update({ where: { id }, data: { name: dto.name } }));
        await logAudit({
          entityType: EntityType.PATIENT_TYPE,
          entityId: id,
          userId,
          actionType: ActionType.UPDATE,
          description: `Tipo de paciente renombrado: ${before.name} → ${dto.name}`,
          affectedFields: [ 'name' ],
          fieldsBefore: { name: before.name },
          fieldsAfter: { name: dto.name },
          tx,
          required: true,
        });
      }
      return findDto(userId, id, tx);
    });
  },

  async setDefault(userId: string, id: string): Promise<PatientTypeDto> {
    return prisma.$transaction(async (tx) => {
      await withProviderLock(tx, userId);
      const type = await requireOwned(userId, id, tx);
      const previous = await patientTypeRepository.defaultIdOf(userId, tx);
      if (previous !== id) {
        await tx.user.update({ where: { id: userId }, data: { defaultPatientTypeId: id } });
        await logAudit({
          entityType: EntityType.PATIENT_TYPE,
          entityId: id,
          userId,
          actionType: ActionType.UPDATE,
          description: `Tipo de paciente predeterminado: ${type.name}`,
          affectedFields: [ 'defaultPatientTypeId' ],
          fieldsBefore: { defaultPatientTypeId: previous },
          fieldsAfter: { defaultPatientTypeId: id },
          tx,
          required: true,
        });
      }
      return findDto(userId, id, tx);
    });
  },

  /** Refused for the default type and while any patient (soft-deleted ones included) uses it; versions go with it. */
  async delete(userId: string, id: string): Promise<{ id: string }> {
    return prisma.$transaction(async (tx) => {
      await withProviderLock(tx, userId);
      const type = await requireOwned(userId, id, tx);
      if (await patientTypeRepository.defaultIdOf(userId, tx) === id) throw new PatientTypeIsDefaultError();
      const patientCount = await patientTypeRepository.countPatients(id, tx);
      if (patientCount > 0) throw new PatientTypeInUseError(patientCount);
      await tx.patientType.delete({ where: { id } });
      await logAudit({
        entityType: EntityType.PATIENT_TYPE,
        entityId: id,
        userId,
        actionType: ActionType.DELETE,
        description: `Tipo de paciente eliminado: ${type.name}`,
        affectedFields: [ 'name' ],
        fieldsBefore: { name: type.name },
        tx,
        required: true,
      });
      logger.info({ userId, patientTypeId: id }, 'Patient type deleted');
      return { id };
    });
  },

  async listVersions(userId: string, id: string): Promise<ConsentVersionDto[]> {
    await requireOwned(userId, id);
    return patientTypeRepository.listVersions(id);
  },

  /** A new version, numbered after the last one. Versions are never updated or deleted on their own. */
  async addVersion(userId: string, id: string, dto: CreateConsentVersionDto): Promise<ConsentVersionDto> {
    const content = decodePdf(dto.content);
    return prisma.$transaction(async (tx) => {
      await withProviderLock(tx, userId);
      const type = await requireOwned(userId, id, tx);
      const version = await patientTypeRepository.lastVersionNumber(id, tx) + 1;
      const created = await tx.consentDocumentVersion.create({
        data: {
          patientTypeId: id,
          version,
          name: dto.name,
          content: new Uint8Array(content),
          mimeType: 'application/pdf',
          sizeBytes: content.length,
        },
        select: { id: true, version: true, name: true, mimeType: true, sizeBytes: true, createdAt: true },
      });
      await logAudit({
        entityType: EntityType.CONSENT_DOCUMENT,
        entityId: created.id,
        userId,
        actionType: ActionType.CREATE,
        description: `Formulario de consentimiento v${version} cargado para el tipo de paciente ${type.name}`,
        affectedFields: [ 'name', 'version' ],
        fieldsAfter: { patientTypeId: id, version, name: created.name, sizeBytes: created.sizeBytes },
        tx,
        required: true,
      });
      logger.info({ userId, patientTypeId: id, version }, 'Consent version uploaded');
      return created;
    });
  },

  async getVersionContent(userId: string, id: string, versionId: string) {
    await requireOwned(userId, id);
    const version = await patientTypeRepository.findVersionContent(id, versionId);
    if (!version) throw new ConsentVersionNotFoundError();
    return version;
  },

  /**
   * The document behind a public link: a version id (welcome messages since #144), or a provider's user id (messages
   * sent before), which serves the current version of that provider's default type. Both ids are cuids.
   */
  async findPublicDocument(id: string) {
    const version = await prisma.consentDocumentVersion.findUnique({ where: { id } });
    if (version) return version;
    const defaultId = await patientTypeRepository.defaultIdOf(id);
    if (!defaultId) return null;
    return prisma.consentDocumentVersion.findFirst({ where: { patientTypeId: defaultId }, orderBy: { version: 'desc' } });
  },
};
