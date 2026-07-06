import { type Patient, type Prisma } from '../../generated/prisma/client.ts';
import { prisma } from '../prisma/prismaClient.js';
import { PatientEmailConflictError, PatientNotFoundError } from '../utils/errors.js';
import { paginate, type Paginated } from '../utils/pagination.js';
import { isPrismaUniqueConstraintError } from '../utils/prismaErrors.js';
import { logger } from '../utils/logger.js';
import type { CreatePatientDto, UpdatePatientDto, ListPatientsQuery, PatientStatsQuery } from './patient.schemas.js';

type PatientWithRelations = Patient & {
  appointments: { id: string }[];
  reminders: { id: string }[];
};

export const patientRepository = {
  async create(dto: CreatePatientDto, userId: string): Promise<Patient> {
    try {
      return await prisma.patient.create({
        data: {
          name: dto.name,
          lastName: dto.lastName,
          whatsappNumber: dto.whatsappNumber ?? null,
          smsNumber: dto.smsNumber ?? null,
          email: dto.email?.toLowerCase() ?? null,
          notes: dto.notes ?? null,
          status: dto.status,
          appointmentTypeId: dto.appointmentTypeId ?? null,
          userId,
        },
      });
    } catch (err) {
      if (isPrismaUniqueConstraintError(err) && dto.email) {
        logger.warn({ email: dto.email, operation: 'create' }, 'Patient email conflict');
        throw new PatientEmailConflictError(dto.email);
      }
      throw err;
    }
  },

  async getStats(userId: string, query?: PatientStatsQuery): Promise<{ total: number; byStatus: Record<string, number> }> {
    const includeDeleted = query?.includeDeleted ?? false;
    const counts = await prisma.patient.groupBy({
      by: [ 'status' ],
      _count: { _all: true },
      where: { userId, ...(includeDeleted ? {} : { isDeleted: false }) },
    });

    const byStatus: Record<string, number> = {};
    let total = 0;
    for (const row of counts) {
      if (!row.status) continue;
      byStatus[ row.status ] = row._count._all;
      total += row._count._all;
    }

    return { total, byStatus };
  },

  async findById(id: string, userId: string): Promise<Patient> {
    const patient = await prisma.patient.findFirst({ where: { id, userId } });
    if (!patient) throw new PatientNotFoundError(id);
    return patient;
  },

  async findByIdWithRelations(id: string, userId: string): Promise<PatientWithRelations> {
    const patient = await prisma.patient.findFirst({
      where: { id, userId },
      include: { appointments: true, reminders: true, medicalRecord: true },
    });
    if (!patient) throw new PatientNotFoundError(id);
    return patient;
  },

  async findMany(query: ListPatientsQuery, userId: string): Promise<Paginated<Patient>> {
    const { status, search, page, pageSize, orderBy, order, includeDeleted } = query;
    const skip = (page - 1) * pageSize;

    const where: Prisma.PatientWhereInput = {
      userId,
      ...(includeDeleted ? {} : { isDeleted: false }),
      ...(status && {
        status: Array.isArray(status) ? { in: status } : status
      }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { whatsappNumber: { contains: search, mode: 'insensitive' } },
          { smsNumber: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    return paginate(
      prisma.patient.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { [ orderBy ]: order },
      }),
      prisma.patient.count({ where }),
      page,
      pageSize,
    );
  },

  async update(id: string, dto: UpdatePatientDto, userId: string): Promise<Patient> {
    await patientRepository.findById(id, userId);

    try {
      return await prisma.patient.update({
        where: { id },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.lastName !== undefined && { lastName: dto.lastName }),
          ...(dto.whatsappNumber !== undefined && { whatsappNumber: dto.whatsappNumber || null }),
          ...(dto.smsNumber !== undefined && { smsNumber: dto.smsNumber || null }),
          ...(dto.email !== undefined && { email: dto.email?.toLowerCase() || null }),
          ...(dto.notes !== undefined && { notes: dto.notes || null }),
          ...(dto.status !== undefined && { status: dto.status }),
          ...(dto.appointmentTypeId !== undefined && { appointmentTypeId: dto.appointmentTypeId || null }),
        },
      });
    } catch (err) {
      if (isPrismaUniqueConstraintError(err)) {
        logger.warn({ email: dto.email, operation: 'update', patientId: id }, 'Patient email conflict');
        throw new PatientEmailConflictError(dto.email!);
      }
      throw err;
    }
  },

  async delete(id: string, userId: string): Promise<Patient> {
    await patientRepository.findById(id, userId);
    return prisma.patient.update({
      where: { id },
      data: { isDeleted: true, deletedAt: new Date() },
    });
  },

  async restore(id: string, userId: string): Promise<Patient> {
    await patientRepository.findById(id, userId);
    return prisma.patient.update({
      where: { id },
      data: { isDeleted: false, deletedAt: null },
    });
  },
};
