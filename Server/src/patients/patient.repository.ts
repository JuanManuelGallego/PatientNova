import { Channel, type Patient, type Prisma } from '../../generated/prisma/client.ts';
import { prisma, type TransactionClient } from '../utils/prisma/prisma-client.js';
import { PatientNotFoundError } from '../utils/errors/errors.js';
import { PatientEmailConflictError } from './patient.errors.js';
import { paginate, type Paginated } from '../utils/api/pagination.js';
import { isPrismaUniqueConstraintError } from '../utils/errors/prisma-errors.js';
import { logger, maskEmail } from '../utils/api/logger.js';
import { normalizeEmail } from '../utils/validation/normalize-email.js';
import { buildUpdateData } from '../utils/prisma/build-update-data.js';
import { softDelete, restore } from '../utils/prisma/softDelete.js';
import type { CreatePatientDto, UpdatePatientDto, ListPatientsQuery, PatientStatsQuery } from './patient.schemas.js';

type PatientWithRelations = Patient & {
  appointments: { id: string; startAt: Date }[];
  reminders: { id: string; sendAt: Date }[];
  medicalRecord: { id: string } | null;
  appointmentType: { id: string; name: string; defaultPrice: number | null } | null;
};

export const patientRepository = {
  async create(dto: CreatePatientDto, userId: string, tx?: TransactionClient): Promise<Patient> {
    try {
      return await (tx ?? prisma).patient.create({
        data: {
          name: dto.name,
          lastName: dto.lastName,
          whatsappNumber: dto.whatsappNumber ?? null,
          smsNumber: dto.smsNumber ?? null,
          email: dto.email ? normalizeEmail(dto.email) : null,
          reminderChannel: dto.reminderChannel ?? Channel.WHATSAPP,
          notes: dto.notes ?? null,
          status: dto.status,
          appointmentTypeId: dto.appointmentTypeId ?? null,
          userId,
        },
      });
    } catch (err) {
      if (isPrismaUniqueConstraintError(err) && dto.email) {
        logger.warn({ maskedEmail: maskEmail(dto.email), operation: 'create' }, 'Patient email conflict');
        throw new PatientEmailConflictError();
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

  async findByEmail(email: string, userId: string): Promise<Patient | null> {
    return prisma.patient.findFirst({
      where: { userId, isDeleted: false, email: normalizeEmail(email) },
    });
  },

  async findById(id: string, userId: string, tx?: TransactionClient): Promise<Patient> {
    const patient = await (tx ?? prisma).patient.findFirst({ where: { id, userId } });
    if (!patient) throw new PatientNotFoundError(id);
    return patient;
  },

  async findByIdWithRelations(
    id: string,
    userId: string,
    opts?: { take?: number },
  ): Promise<PatientWithRelations> {
    const take = opts?.take ?? 10;
    const patient = await prisma.patient.findFirst({
      where: { id, userId },
      include: {
        appointments: { take, orderBy: { startAt: 'desc' } },
        reminders: { take, orderBy: { sendAt: 'desc' } },
        medicalRecord: true,
        appointmentType: { select: { id: true, name: true, defaultPrice: true } },
      },
    });
    if (!patient) throw new PatientNotFoundError(id);
    return patient;
  },

  async findMany(query: ListPatientsQuery, userId: string): Promise<Paginated<Patient>> {
    const { status, search, page, pageSize, orderBy, order, includeDeleted } = query;
    const skip = (page - 1) * pageSize;
    const searchTerms = search?.trim().split(/\s+/).filter(Boolean) ?? [];

    const where: Prisma.PatientWhereInput = {
      userId,
      ...(includeDeleted ? {} : { isDeleted: false }),
      ...(status && {
        status: Array.isArray(status) ? { in: status } : status
      }),
      ...(searchTerms.length > 0 && {
        AND: searchTerms.map((term) => ({
          OR: [
            { name: { contains: term, mode: 'insensitive' } },
            { lastName: { contains: term, mode: 'insensitive' } },
            { email: { contains: term, mode: 'insensitive' } },
            { whatsappNumber: { contains: term, mode: 'insensitive' } },
            { smsNumber: { contains: term, mode: 'insensitive' } },
          ],
        })),
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

  async update(id: string, dto: UpdatePatientDto, userId: string, tx?: TransactionClient): Promise<Patient> {
    await patientRepository.findById(id, userId, tx);

    try {
      const data = buildUpdateData(
        dto,
        [ 'name', 'lastName', 'whatsappNumber', 'smsNumber', 'email', 'reminderChannel', 'notes', 'status', 'appointmentTypeId' ],
        {
          whatsappNumber: (v: string | null) => v || null,
          smsNumber: (v: string | null) => v || null,
          email: (v: string | null) => (v ? normalizeEmail(v) : null) || null,
          notes: (v: string | null) => v || null,
          appointmentTypeId: (v: string | null) => v || null,
        },
      );

      return await (tx ?? prisma).patient.update({
        where: { id },
        data,
      });
    } catch (err) {
      if (isPrismaUniqueConstraintError(err)) {
        logger.warn({ maskedEmail: dto.email ? maskEmail(dto.email) : undefined, operation: 'update', patientId: id }, 'Patient email conflict');
        throw new PatientEmailConflictError();
      }
      throw err;
    }
  },

  async delete(id: string, userId: string, tx?: TransactionClient): Promise<Patient> {
    await patientRepository.findById(id, userId, tx);
    return softDelete((tx ?? prisma).patient, id, userId) as Promise<Patient>;
  },

  async restore(id: string, userId: string, tx?: TransactionClient): Promise<Patient> {
    await patientRepository.findById(id, userId, tx);
    try {
      return await restore((tx ?? prisma).patient, id, userId) as Patient;
    } catch (err) {
      if (isPrismaUniqueConstraintError(err)) {
        logger.warn({ operation: 'restore', patientId: id }, 'Patient email conflict');
        throw new PatientEmailConflictError();
      }
      throw err;
    }
  },
};
