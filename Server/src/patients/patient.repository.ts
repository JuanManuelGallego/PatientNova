import { Channel, type Patient, type Prisma } from '../../generated/prisma/client.ts';
import { prisma, type TransactionClient } from '../utils/prisma/prisma-client.js';
import { PatientNotFoundError } from '../utils/errors/errors.js';
import { PatientEmailConflictError } from './patient.errors.js';
import { buildPaginatedResult, paginate, type Paginated } from '../utils/api/pagination.js';
import { emailHash } from '../utils/encryption/blind-index.js';
import { MATCH_NOTHING, patientSearchWhere } from '../utils/encryption/pii-search.js';
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

// Name/last name/email are encrypted, so the database cannot sort on them. A provider's matching
// patients are few enough to sort after decryption; above the cap we fall back to newest first.
const ENCRYPTED_SORT_FIELDS = new Set([ 'name', 'lastName', 'email' ]);
type EncryptedSortField = 'name' | 'lastName' | 'email';
export const IN_MEMORY_SORT_CAP = 5000;
const collator = new Intl.Collator('es', { sensitivity: 'base', numeric: true });

async function sortByDecryptedField(
  where: Prisma.PatientWhereInput,
  field: EncryptedSortField,
  order: 'asc' | 'desc',
  skip: number,
  take: number,
): Promise<{ data: Patient[]; total: number } | null> {
  const keys = await prisma.patient.findMany({
    where,
    select: { id: true, name: true, lastName: true, email: true },
    take: IN_MEMORY_SORT_CAP + 1,
  });
  if (keys.length > IN_MEMORY_SORT_CAP) {
    logger.warn({ count: keys.length, field }, 'Too many patients to sort by an encrypted field; using createdAt');
    return null;
  }

  const sortKey = (p: { name: string; lastName: string; email: string | null }): string[] =>
    field === 'name' ? [ p.name, p.lastName ] : field === 'lastName' ? [ p.lastName, p.name ] : [ p.email ?? '' ];
  const direction = order === 'asc' ? 1 : -1;
  keys.sort((a, b) => {
    const ka = sortKey(a);
    const kb = sortKey(b);
    // Missing emails always go last.
    if (field === 'email' && !a.email !== !b.email) return a.email ? -1 : 1;
    for (let i = 0; i < ka.length; i++) {
      const c = collator.compare(ka[ i ]!, kb[ i ]!);
      if (c !== 0) return c * direction;
    }
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });

  const pageIds = keys.slice(skip, skip + take).map((k) => k.id);
  const rows = await prisma.patient.findMany({ where: { id: { in: pageIds } } });
  const byId = new Map(rows.map((r) => [ r.id, r ]));
  return { data: pageIds.map((id) => byId.get(id)).filter((r): r is Patient => !!r), total: keys.length };
}

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
        logger.warn({ email: maskEmail(dto.email), operation: 'create' }, 'Patient email conflict');
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

  /**
   * Active (non-deleted) patient of this provider with the given email. Emails are encrypted,
   * so the match is on the blind index of the normalized email (same index as the unique key).
   */
  async findByEmail(email: string, userId: string): Promise<Patient | null> {
    const hash = emailHash(email);
    if (!hash) return null;
    return prisma.patient.findFirst({
      where: { userId, isDeleted: false, emailHash: hash },
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
    const searchWhere = search ? patientSearchWhere(search) ?? MATCH_NOTHING : undefined;

    const where: Prisma.PatientWhereInput = {
      userId,
      ...(includeDeleted ? {} : { isDeleted: false }),
      ...(status && {
        status: Array.isArray(status) ? { in: status } : status
      }),
      ...(searchWhere && { AND: [ searchWhere ] }),
    };

    if (ENCRYPTED_SORT_FIELDS.has(orderBy)) {
      const sorted = await sortByDecryptedField(where, orderBy as EncryptedSortField, order, skip, pageSize);
      if (sorted) return buildPaginatedResult(sorted.data, sorted.total, page, pageSize);
    }

    return paginate(
      prisma.patient.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: ENCRYPTED_SORT_FIELDS.has(orderBy) ? { createdAt: 'desc' } : { [ orderBy ]: order },
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
        logger.warn({ email: dto.email ? maskEmail(dto.email) : undefined, operation: 'update', patientId: id }, 'Patient email conflict');
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
      // Restoring a soft-deleted patient whose email is now used by an active one.
      if (isPrismaUniqueConstraintError(err)) {
        logger.warn({ operation: 'restore', patientId: id }, 'Patient email conflict');
        throw new PatientEmailConflictError();
      }
      throw err;
    }
  },
};
