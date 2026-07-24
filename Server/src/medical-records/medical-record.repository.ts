import { prisma } from '../utils/prisma/prisma-client.js';
import { type Prisma } from '../../generated/prisma/client.ts';
import { PatientNotFoundError } from '../utils/errors/errors.js';
import { MedicalRecordNotFoundError, MedicalRecordAlreadyExistsError } from './medical-record.errors.js';
import { paginate } from '../utils/api/pagination.js';
import { buildUpdateData } from '../utils/prisma/build-update-data.js';
import { softDelete, restore } from '../utils/prisma/softDelete.js';
import type { CreateMedicalRecordDto, ListMedicalRecordsQuery, UpdateMedicalRecordDto } from './medical-record.schemas.js';

const subsystemRelationData = (medicalRecordId: string, relations: NonNullable<CreateMedicalRecordDto[ 'subsystemRelations' ]>) =>
  relations.map(({ subsystem, status, observation }) => ({
    medicalRecordId,
    subsystem,
    status,
    observation: observation ?? null,
  }));

const defaultInclude = {
  familyMembers: true,
  evolutionNotes: { orderBy: { date: 'desc' } },
  documents: { orderBy: { uploadedAt: 'desc' } },
  subsystemRelations: { orderBy: { subsystem: 'asc' } },
} satisfies Prisma.MedicalRecordInclude;

export const medicalRecordRepository = {
  async create(dto: CreateMedicalRecordDto, userId: string) {
    const patient = await prisma.patient.findFirst({
      where: { id: dto.patientId, userId },
      include: { medicalRecord: true },
    });
    if (!patient) throw new PatientNotFoundError(dto.patientId);
    if (patient.medicalRecord) throw new MedicalRecordAlreadyExistsError(dto.patientId);

    return prisma.medicalRecord.create({
      data: {
        name: dto.name ?? null,
        nationalId: dto.nationalId ?? null,
        sex: dto.sex ?? null,
        birthDate: dto.birthDate ?? null,
        birthPlace: dto.birthPlace ?? null,
        consultationReason: dto.consultationReason ?? null,
        earlyDevelopment: dto.earlyDevelopment ?? null,
        schoolAndWork: dto.schoolAndWork ?? null,
        lifestyleHabits: dto.lifestyleHabits ?? null,
        traumaticEvents: dto.traumaticEvents ?? null,
        emotionalConsiderations: dto.emotionalConsiderations ?? null,
        physicalConsiderations: dto.physicalConsiderations ?? null,
        mentalHistory: dto.mentalHistory ?? null,
        objective: dto.objective ?? null,
        familyObservations: dto.familyObservations ?? null,
        isFamily: dto.isFamily ?? false,
        familyType: dto.familyType ?? null,
        lifecycle: dto.lifecycle ?? null,
        genogram: dto.genogram ?? null,
        resources: dto.resources ?? null,
        difficulties: dto.difficulties ?? null,
        communication: dto.communication ?? null,
        rule: dto.rule ?? null,
        limits: dto.limits ?? null,
        familyContext: dto.familyContext ?? null,
        expectations: dto.expectations ?? null,
        flexibility: dto.flexibility ?? null,
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
      include: defaultInclude,
    });
  },

  async findById(id: string, userId: string) {
    const rec = await prisma.medicalRecord.findFirst({
      where: { id, patient: { userId } },
      include: { patient: true, ...defaultInclude },
    });
    if (!rec) throw new MedicalRecordNotFoundError(id);
    return rec;
  },

  async findByPatientId(patientId: string, userId: string) {
    const rec = await prisma.medicalRecord.findFirst({
      where: { patientId, patient: { userId } },
      include: defaultInclude,
    });
    if (!rec) throw new MedicalRecordNotFoundError(patientId);
    return rec;
  },

  async findMany(query: ListMedicalRecordsQuery, userId: string) {
    const { patientId, search, page, pageSize, orderBy, order, includeDeleted } = query;
    const skip = (page - 1) * pageSize;

    const where: Prisma.MedicalRecordWhereInput = { patient: { userId }, ...(includeDeleted ? {} : { isDeleted: false }) };
    if (patientId) where.patientId = patientId;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
      ];
    }

    return paginate(
      prisma.medicalRecord.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { [ orderBy ]: order },
        include: defaultInclude,
      }),
      prisma.medicalRecord.count({ where }),
      page,
      pageSize,
    );
  },

  async update(id: string, dto: UpdateMedicalRecordDto, userId: string) {
    await medicalRecordRepository.findById(id, userId);

    return prisma.$transaction(async (tx) => {
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

      const data = buildUpdateData(
        dto,
        [
          'name', 'nationalId', 'sex', 'birthDate', 'birthPlace',
          'consultationReason', 'earlyDevelopment', 'schoolAndWork', 'lifestyleHabits',
          'traumaticEvents', 'emotionalConsiderations', 'physicalConsiderations',
          'mentalHistory', 'objective', 'familyObservations', 'isFamily', 'familyType',
          'lifecycle', 'genogram', 'resources', 'difficulties', 'communication',
          'rule', 'limits', 'familyContext', 'expectations', 'flexibility',
        ],
      );

      return tx.medicalRecord.update({
        where: { id },
        data,
        include: defaultInclude,
      });
    });
  },

  async softDelete(id: string, userId: string) {
    await medicalRecordRepository.findById(id, userId);
    return softDelete(prisma.medicalRecord, id);
  },

  async restore(id: string, userId: string) {
    await medicalRecordRepository.findById(id, userId);
    return restore(prisma.medicalRecord, id);
  },

  async delete(id: string, userId: string) {
    await medicalRecordRepository.findById(id, userId);
    return prisma.medicalRecord.delete({ where: { id } });
  },
};
