import { prisma } from '../prisma/prismaClient.js';
import { PatientNotFoundError, MedicalRecordNotFoundError, MedicalRecordAlreadyExistsError } from '../utils/errors.js';
import type { CreateMedicalRecordDto, ListMedicalRecordsQuery, UpdateMedicalRecordDto } from './medical-record.schemas.js';

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
      },
      include: {
        familyMembers: true,
        evolutionNotes: true,
      },
    });
  },

  async findById(id: string, userId: string) {
    const rec = await prisma.medicalRecord.findFirst({
      where: { id, patient: { userId } },
      include: {
        patient: true,
        familyMembers: true,
        evolutionNotes: { orderBy: { date: 'desc' } },
      },
    });
    if (!rec) throw new MedicalRecordNotFoundError(id);
    return rec;
  },

  async findByPatientId(patientId: string, userId: string) {
    const rec = await prisma.medicalRecord.findFirst({
      where: { patientId, patient: { userId } },
      include: {
        familyMembers: true,
        evolutionNotes: { orderBy: { date: 'desc' } },
      },
    });
    if (!rec) throw new MedicalRecordNotFoundError(patientId);
    return rec;
  },

  async findMany(query: ListMedicalRecordsQuery, userId: string) {
    const { patientId, search, page, pageSize, orderBy, order } = query;
    const skip = (page - 1) * pageSize;

    const where: any = { patient: { userId } };
    if (patientId) where.patientId = patientId;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { consultationReason: { contains: search, mode: 'insensitive' } },
        { objective: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [ data, total ] = await prisma.$transaction([
      prisma.medicalRecord.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { [ orderBy ]: order },
        include: {
          familyMembers: true,
          evolutionNotes: { orderBy: { date: 'desc' } },
        },
      }),
      prisma.medicalRecord.count({ where }),
    ]);

    return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  },

  async update(id: string, dto: UpdateMedicalRecordDto, userId: string) {
    await medicalRecordRepository.findById(id, userId);

    console.log('Updating medical record with data:', dto);

    return prisma.medicalRecord.update({
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
        ...(dto.lifestyleHabits !== undefined && { lifestyleHabits: dto.lifestyleHabits }),
        ...(dto.traumaticEvents !== undefined && { traumaticEvents: dto.traumaticEvents }),
        ...(dto.emotionalConsiderations !== undefined && { emotionalConsiderations: dto.emotionalConsiderations }),
        ...(dto.physicalConsiderations !== undefined && { physicalConsiderations: dto.physicalConsiderations }),
        ...(dto.mentalHistory !== undefined && { mentalHistory: dto.mentalHistory }),
        ...(dto.objective !== undefined && { objective: dto.objective }),
        ...(dto.familyMembers?.length && {
          familyMembers: {
            deleteMany: {},
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
            deleteMany: {},
            create: dto.evolutionNotes.map(({ date, text }) => ({ date, text: text ?? null })),
          },
        }),
      },
      include: {
        familyMembers: true,
        evolutionNotes: { orderBy: { date: 'desc' } },
      },
    });
  },

  async delete(id: string, userId: string) {
    await medicalRecordRepository.findById(id, userId);
    return prisma.medicalRecord.delete({ where: { id } });
  },
};