import { type Patient, type Prisma } from '../../generated/prisma/client.ts';
import { prisma } from '../utils/prisma/prisma-client.js';
import { PatientNotFoundError } from '../utils/errors/errors.js';
import { PatientEmailConflictError } from './patient.errors.js';
import { paginate, type Paginated } from '../utils/api/pagination.js';
import { isPrismaUniqueConstraintError } from '../utils/errors/prisma-errors.js';
import { logger } from '../utils/api/logger.js';
import { buildUpdateData } from '../utils/prisma/build-update-data.js';
import { softDelete, restore } from '../utils/prisma/softDelete.js';
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
      const data = buildUpdateData(
        dto,
        [ 'name', 'lastName', 'whatsappNumber', 'smsNumber', 'email', 'notes', 'status', 'appointmentTypeId' ],
        {
          whatsappNumber: (v: string | null) => v || null,
          smsNumber: (v: string | null) => v || null,
          email: (v: string | null) => v?.toLowerCase() || null,
          notes: (v: string | null) => v || null,
          appointmentTypeId: (v: string | null) => v || null,
        },
      );

      return await prisma.patient.update({
        where: { id },
        data,
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
    return softDelete(prisma.patient, id, userId);
  },

  async restore(id: string, userId: string): Promise<Patient> {
    await patientRepository.findById(id, userId);
    return restore(prisma.patient, id, userId);
  },
};
