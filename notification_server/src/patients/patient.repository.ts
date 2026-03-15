import type { Patient } from '@prisma/client';
import { prisma } from '../prisma/prismaClient.js';
import { PatientEmailConflictError, PatientNotFoundError } from '../utils/errors.js';
import type { PaginatedPatients } from '../utils/types.js';
import type { CreatePatientDto, UpdatePatientDto, ListPatientsQuery } from './patient.schemas.js';

export const patientRepository = {
  async create(dto: CreatePatientDto): Promise<Patient> {
    try {
      return await prisma.patient.create({
        data: {
          name: dto.name,
          lastName: dto.lastName,
          whatsappNumber: dto.whatsappNumber ?? null,
          smsNumber: dto.smsNumber ?? null,
          email: dto.email.toLowerCase(),
          status: dto.status,
        },
      });
    } catch (err) {
      if (err && typeof err === 'object' && 'code' in err && (err as any).code === 'P2002') {
        throw new PatientEmailConflictError(dto.email);
      }
      throw err;
    }
  },

  async findById(id: string): Promise<Patient> {
    const patient = await prisma.patient.findUnique({ where: { id } });
    if (!patient) throw new PatientNotFoundError(id);
    return patient;
  },

  async findMany(query: ListPatientsQuery): Promise<PaginatedPatients> {
    const { status, search, page, pageSize, orderBy, order } = query;
    const skip = (page - 1) * pageSize;

    const where: any = {
      ...(status && { status }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [ data, total ] = await prisma.$transaction([
      prisma.patient.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { [ orderBy ]: order },
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

  async update(id: string, dto: UpdatePatientDto): Promise<Patient> {
    await patientRepository.findById(id);

    try {
      return await prisma.patient.update({
        where: { id },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.lastName !== undefined && { lastName: dto.lastName }),
          ...({ whatsappNumber: dto.whatsappNumber || null }),
          ...({ smsNumber: dto.smsNumber || null }),
          ...(dto.email !== undefined && { email: dto.email.toLowerCase() }),
          ...(dto.status !== undefined && { status: dto.status }),
        },
      });
    } catch (err) {
      if (err && typeof err === 'object' && 'code' in err && (err as any).code === 'P2002') {
        throw new PatientEmailConflictError(dto.email!);
      }
      throw err;
    }
  },

  async delete(id: string): Promise<Patient> {
    await patientRepository.findById(id);
    return prisma.patient.delete({ where: { id }});
  },
};
