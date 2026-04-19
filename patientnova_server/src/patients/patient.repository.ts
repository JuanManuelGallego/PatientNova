import { PatientStatus, type Patient } from '@prisma/client';
import { prisma } from '../prisma/prismaClient.js';
import { PatientEmailConflictError, PatientNotFoundError } from '../utils/errors.js';
import type { PaginatedPatients } from '../utils/types.js';
import type { CreatePatientDto, UpdatePatientDto, ListPatientsQuery } from './patient.schemas.js';

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
          userId,
        },
      });
    } catch (err) {
      if (err && typeof err === 'object' && 'code' in err && (err as any).code === 'P2002' && dto.email) {
        throw new PatientEmailConflictError(dto.email);
      }
      throw err;
    }
  },

  async getStats(userId: string): Promise<{ total: number; byStatus: Record<string, number> }> {
    const counts = await prisma.patient.groupBy({
      by: [ 'status' ],
      _count: { _all: true },
      where: { userId },
    });

    const byStatus: Record<string, number> = {};
    let total = 0;
    for (const row of counts) {
      if (!row.status || row.status === PatientStatus.ARCHIVED) continue;
      byStatus[ row.status ] = row._count._all;
      total += row._count._all;
    }

    return { total, byStatus };
  },

  async findById(id: string, userId: string): Promise<Patient> {
    const patient = await prisma.patient.findFirst({
      where: { id, userId },
      include: {
        appointments: true,
        reminders: true,
      },
    });
    if (!patient) throw new PatientNotFoundError(id);
    return patient;
  },

  async findMany(query: ListPatientsQuery, userId: string): Promise<PaginatedPatients> {
    const { status, search, page, pageSize, orderBy, order } = query;
    const skip = (page - 1) * pageSize;

    const where: any = {
      userId,
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

    const [ data, total ] = await prisma.$transaction([
      prisma.patient.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { [ orderBy ]: order },
        include: {
          appointments: true,
          reminders: true,
          medicalRecord: true,
        },
      }),
      prisma.patient.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
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
          ...({ archivedAt: dto.status === PatientStatus.ARCHIVED ? new Date() : null })
        },
      });
    } catch (err) {
      if (err && typeof err === 'object' && 'code' in err && (err as any).code === 'P2002') {
        throw new PatientEmailConflictError(dto.email!);
      }
      throw err;
    }
  },

  async delete(id: string, userId: string): Promise<Patient> {
    await patientRepository.findById(id, userId);
    return prisma.patient.delete({ where: { id } });
  },
};
