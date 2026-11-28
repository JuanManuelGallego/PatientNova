import { prisma, type TransactionClient } from '../utils/prisma/prisma-client.js';
import { type Prisma } from '../../generated/prisma/client.ts';
import { PatientNotFoundError } from '../utils/errors/errors.js';
import { MedicalRecordNotFoundError, MedicalRecordAlreadyExistsError } from './medical-record.errors.js';
import { buildPaginatedResult, type Paginated } from '../utils/api/pagination.js';
import { buildUpdateData } from '../utils/prisma/build-update-data.js';
import { emptyToNull } from '../utils/prisma/empty-to-null.js';
import { applyDataChanges, checkDataChanges, lockPatientType, lockRecord, mergeRecordData } from './record-data.js';
import { parseStoredTemplate } from '../patient-types/record-template.js';
import { recordInclude, toRecordDto, type MedicalRecordDto } from './medical-record.dto.js';
import type { CreateMedicalRecordDto, ListMedicalRecordsQuery, UpdateMedicalRecordDto } from './medical-record.schemas.js';
import { MATCH_NOTHING, medicalRecordNameWhere } from '../utils/encryption/pii-search.js';

const subsystemRelationData = (medicalRecordId: string, relations: NonNullable<CreateMedicalRecordDto[ 'subsystemRelations' ]>) =>
  relations.map(({ subsystem, status, observation }) => ({
    medicalRecordId,
    subsystem,
    status,
    observation: observation ?? null,
  }));

const IDENTITY_FIELDS = [ 'name', 'nationalId', 'sex', 'birthDate', 'birthPlace' ] as const;

export const medicalRecordRepository = {
  async create(dto: CreateMedicalRecordDto, userId: string, tx?: TransactionClient): Promise<MedicalRecordDto> {
    if (!tx) return prisma.$transaction((t) => medicalRecordRepository.create(dto, userId, t));

    await lockPatientType(tx, dto.patientId);
    const patient = await tx.patient.findFirst({
      where: { id: dto.patientId, userId },
      select: { medicalRecord: { select: { id: true } }, patientType: { select: { template: true } } },
    });
    if (!patient) throw new PatientNotFoundError(dto.patientId);
    if (patient.medicalRecord) throw new MedicalRecordAlreadyExistsError(dto.patientId);
    const changes = dto.data ?? {};
    checkDataChanges(parseStoredTemplate(patient.patientType.template), changes);

    const row = await tx.medicalRecord.create({
      data: {
        name: dto.name ?? null,
        nationalId: dto.nationalId ?? null,
        sex: dto.sex ?? null,
        birthDate: dto.birthDate ?? null,
        birthPlace: dto.birthPlace ?? null,
        data: JSON.stringify(applyDataChanges({}, changes)),
        patientId: dto.patientId,
        ...(dto.familyMembers?.length && {
          familyMembers: {
            create: dto.familyMembers.map(({ name, sex, age, relationship, relation }) => ({
              name: name ?? null,
              age: age ?? null,
              relation: relation ?? null,
              sex: sex ?? null,
              relationship: relationship ?? null,
            })),
          },
        }),
        ...(dto.evolutionNotes?.length && {
          evolutionNotes: {
            create: dto.evolutionNotes.map(({ date, text }) => ({ date, text: text ?? null })),
          },
        }),
        ...(dto.documents?.length && {
          documents: {
            create: dto.documents.map(({ id, name, mimeType, sizeBytes, data, uploadedAt }) => ({
              id, name, mimeType, sizeBytes, data,
              uploadedAt: new Date(uploadedAt),
            })),
          },
        }),
        ...(dto.subsystemRelations?.length && {
          subsystemRelations: {
            create: dto.subsystemRelations.map(({ subsystem, status, observation }) => ({
              subsystem,
              status,
              observation: observation ?? null,
            })),
          },
        }),
      },
      include: recordInclude,
    });
    return toRecordDto(row);
  },

  async findById(id: string, userId: string, tx: TransactionClient = prisma): Promise<MedicalRecordDto> {
    const rec = await tx.medicalRecord.findFirst({ where: { id, patient: { userId } }, include: recordInclude });
    if (!rec) throw new MedicalRecordNotFoundError(id);
    return toRecordDto(rec);
  },

  async findByPatientId(patientId: string, userId: string): Promise<MedicalRecordDto> {
    const rec = await prisma.medicalRecord.findFirst({ where: { patientId, patient: { userId } }, include: recordInclude });
    if (!rec) throw new MedicalRecordNotFoundError(patientId);
    return toRecordDto(rec);
  },

  async findMany(query: ListMedicalRecordsQuery, userId: string): Promise<Paginated<MedicalRecordDto>> {
    const { patientId, search, page, pageSize, orderBy, order, includeDeleted } = query;
    const skip = (page - 1) * pageSize;

    const where: Prisma.MedicalRecordWhereInput = { patient: { userId }, ...(includeDeleted ? {} : { isDeleted: false }) };
    if (patientId) where.patientId = patientId;
    if (search) {
      where.AND = [ medicalRecordNameWhere(search) ?? MATCH_NOTHING ];
    }

    const [ rows, total ] = await Promise.all([
      prisma.medicalRecord.findMany({ where, skip, take: pageSize, orderBy: { [ orderBy ]: order }, include: recordInclude }),
      prisma.medicalRecord.count({ where }),
    ]);
    return buildPaginatedResult(rows.map(toRecordDto), total, page, pageSize);
  },

  /** Merges `dto.data` into the payload (only the keys sent), replaces any relation sent, updates identity fields. */
  async update(id: string, dto: UpdateMedicalRecordDto, userId: string, tx?: TransactionClient): Promise<MedicalRecordDto> {
    if (!tx) return prisma.$transaction((t) => medicalRecordRepository.update(id, dto, userId, t));

    await medicalRecordRepository.findById(id, userId, tx);
    if (dto.data !== undefined) await mergeRecordData(tx, id, dto.data);
    else await lockRecord(tx, id);

    if (dto.familyMembers !== undefined) {
      await tx.familyMember.deleteMany({ where: { medicalRecordId: id } });
      if (dto.familyMembers.length > 0) {
        await tx.familyMember.createMany({
          data: dto.familyMembers.map(({ name, sex, age, relationship, relation }) => ({
            medicalRecordId: id,
            name: name ?? null,
            age: age ?? null,
            relation: relation ?? null,
            sex: sex ?? null,
            relationship: relationship ?? null,
          })),
        });
      }
    }

    if (dto.evolutionNotes !== undefined) {
      await tx.evolutionNote.deleteMany({ where: { medicalRecordId: id } });
      if (dto.evolutionNotes.length > 0) {
        await tx.evolutionNote.createMany({
          data: dto.evolutionNotes.map(({ date, text }) => ({
            medicalRecordId: id,
            date,
            text: text ?? null,
          })),
        });
      }
    }

    if (dto.documents !== undefined) {
      await tx.medicalDocument.deleteMany({ where: { medicalRecordId: id } });
      if (dto.documents.length > 0) {
        await tx.medicalDocument.createMany({
          data: dto.documents.map(({ id: docId, name, mimeType, sizeBytes, data, uploadedAt }) => ({
            id: docId,
            medicalRecordId: id,
            name, mimeType, sizeBytes, data,
            uploadedAt: new Date(uploadedAt),
          })),
        });
      }
    }

    if (dto.subsystemRelations !== undefined) {
      await tx.subsystemRelation.deleteMany({ where: { medicalRecordId: id } });
      if (dto.subsystemRelations.length > 0) {
        await tx.subsystemRelation.createMany({
          data: subsystemRelationData(id, dto.subsystemRelations),
        });
      }
    }

    const identity = buildUpdateData(dto, [ ...IDENTITY_FIELDS ], {
      name: emptyToNull,
      nationalId: emptyToNull,
      birthPlace: emptyToNull,
    });
    await tx.medicalRecord.update({ where: { id }, data: identity, select: { id: true } });
    return medicalRecordRepository.findById(id, userId, tx);
  },

  async delete(id: string, userId: string): Promise<MedicalRecordDto> {
    await medicalRecordRepository.findById(id, userId);
    await prisma.medicalRecord.update({ where: { id }, data: { isDeleted: true, deletedAt: new Date() }, select: { id: true } });
    return medicalRecordRepository.findById(id, userId);
  },

  async restore(id: string, userId: string): Promise<MedicalRecordDto> {
    await medicalRecordRepository.findById(id, userId);
    await prisma.medicalRecord.update({ where: { id }, data: { isDeleted: false, deletedAt: null }, select: { id: true } });
    return medicalRecordRepository.findById(id, userId);
  },
};
