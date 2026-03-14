import { Prisma, type Patient } from '@prisma/client';
import { prisma } from '../prismaClient.js';
import type { CreatePatientDto, UpdatePatientDto, ListPatientsQuery } from './patient.schemas.js';

// ─── Custom error types ───────────────────────────────────────────────────────

export class PatientNotFoundError extends Error {
  constructor(id: string) {
    super(`Patient with id "${id}" not found`);
    this.name = 'PatientNotFoundError';
  }
}

export class PatientEmailConflictError extends Error {
  constructor(email: string) {
    super(`A patient with email "${email}" already exists`);
    this.name = 'PatientEmailConflictError';
  }
}

// ─── Paginated result type ────────────────────────────────────────────────────

export interface PaginatedPatients {
  data: Patient[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ─── Repository ───────────────────────────────────────────────────────────────

export const patientRepository = {

  // ── Create ──────────────────────────────────────────────────────────────────
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
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new PatientEmailConflictError(dto.email);
      }
      throw err;
    }
  },

  // ── Find by ID ───────────────────────────────────────────────────────────────
  async findById(id: string): Promise<Patient> {
    const patient = await prisma.patient.findUnique({ where: { id } });
    if (!patient) throw new PatientNotFoundError(id);
    return patient;
  },

  // ── List (paginated + filtered) ──────────────────────────────────────────────
  async findMany(query: ListPatientsQuery): Promise<PaginatedPatients> {
    const { status, search, page, pageSize, orderBy, order } = query;
    const skip = (page - 1) * pageSize;

    const where: Prisma.PatientWhereInput = {
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

  // ── Update (partial) ─────────────────────────────────────────────────────────
  async update(id: string, dto: UpdatePatientDto): Promise<Patient> {
    // Ensure patient exists first
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
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new PatientEmailConflictError(dto.email!);
      }
      throw err;
    }
  },

  // ── Delete ───────────────────────────────────────────────────────────────────
  async delete(id: string): Promise<Patient> {
    await patientRepository.findById(id);
    return prisma.patient.update({ where: { id }, data: { status: 'ARCHIVED' } });
  },
};
