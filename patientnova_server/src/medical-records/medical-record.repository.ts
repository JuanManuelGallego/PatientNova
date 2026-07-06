import { prisma } from '../prisma/prismaClient.js';
import { type Prisma } from '../../generated/prisma/client.ts';
import { PatientNotFoundError, MedicalRecordNotFoundError, MedicalRecordAlreadyExistsError } from '../utils/errors.js';
import { paginate } from '../utils/pagination.js';
import type { CreateMedicalRecordDto, ListMedicalRecordsQuery, UpdateMedicalRecordDto } from './medical-record.schemas.js';

const subsystemRelationData = (medicalRecordId: string, relations: NonNullable<CreateMedicalRecordDto[ 'subsystemRelations' ]>) =>
  relations.map(({ subsistema, estado, observacion }) => ({
    medicalRecordId,
    subsistema,
    estado,
    observacion: observacion ?? null,
  }));

const defaultInclude = {
  familyMembers: true,
  evolutionNotes: { orderBy: { date: 'desc' } },
  documents: { orderBy: { uploadedAt: 'desc' } },
  subsystemRelations: { orderBy: { subsistema: 'asc' } },
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
        age: dto.age ?? null,
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
        ressources: dto.ressources ?? null,
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
            create: dto.subsystemRelations.map(({ subsistema, estado, observacion }) => ({
              subsistema,
              estado,
              observacion: observacion ?? null,
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
        { consultationReason: { contains: search, mode: 'insensitive' } },
        { objective: { contains: search, mode: 'insensitive' } },
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

      return tx.medicalRecord.update({
        where: { id },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.nationalId !== undefined && { nationalId: dto.nationalId }),
          ...(dto.sex !== undefined && { sex: dto.sex }),
          ...(dto.age !== undefined && { age: dto.age }),
          ...(dto.birthDate !== undefined && { birthDate: dto.birthDate }),
          ...(dto.birthPlace !== undefined && { birthPlace: dto.birthPlace }),
          ...(dto.consultationReason !== undefined && { consultationReason: dto.consultationReason }),
          ...(dto.earlyDevelopment !== undefined && { earlyDevelopment: dto.earlyDevelopment }),
          ...(dto.schoolAndWork !== undefined && { schoolAndWork: dto.schoolAndWork }),
          ...(dto.lifestyleHabits !== undefined && { lifestyleHabits: dto.lifestyleHabits }),
          ...(dto.traumaticEvents !== undefined && { traumaticEvents: dto.traumaticEvents }),
          ...(dto.emotionalConsiderations !== undefined && { emotionalConsiderations: dto.emotionalConsiderations }),
          ...(dto.physicalConsiderations !== undefined && { physicalConsiderations: dto.physicalConsiderations }),
          ...(dto.mentalHistory !== undefined && { mentalHistory: dto.mentalHistory }),
          ...(dto.objective !== undefined && { objective: dto.objective }),
          ...(dto.familyObservations !== undefined && { familyObservations: dto.familyObservations }),
          ...(dto.isFamily !== undefined && { isFamily: dto.isFamily }),
          ...(dto.familyType !== undefined && { familyType: dto.familyType }),
          ...(dto.lifecycle !== undefined && { lifecycle: dto.lifecycle }),
          ...(dto.genogram !== undefined && { genogram: dto.genogram }),
          ...(dto.ressources !== undefined && { ressources: dto.ressources }),
          ...(dto.difficulties !== undefined && { difficulties: dto.difficulties }),
          ...(dto.communication !== undefined && { communication: dto.communication }),
          ...(dto.rule !== undefined && { rule: dto.rule }),
          ...(dto.limits !== undefined && { limits: dto.limits }),
          ...(dto.familyContext !== undefined && { familyContext: dto.familyContext }),
          ...(dto.expectations !== undefined && { expectations: dto.expectations }),
          ...(dto.flexibility !== undefined && { flexibility: dto.flexibility }),
        },
        include: defaultInclude,
      });
    });
  },

  async softDelete(id: string, userId: string) {
    await medicalRecordRepository.findById(id, userId);
    return prisma.medicalRecord.update({
      where: { id },
      data: { isDeleted: true, deletedAt: new Date() },
    });
  },

  async restore(id: string, userId: string) {
    await medicalRecordRepository.findById(id, userId);
    return prisma.medicalRecord.update({
      where: { id },
      data: { isDeleted: false, deletedAt: null },
    });
  },

  async delete(id: string, userId: string) {
    await medicalRecordRepository.findById(id, userId);
    return prisma.medicalRecord.delete({ where: { id } });
  },
};
