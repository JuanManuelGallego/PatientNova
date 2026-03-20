import { Prisma, type Appointment } from '@prisma/client';
import { prisma } from '../prisma/prismaClient.js';
import {
  type CreateAppointmentDto,
  type UpdateAppointmentDto,
  type ListAppointmentsQuery,
} from './appointment.schemas.js';
import { AppointmentPatientNotFoundError, AppointmentReminderNotFoundError, AppointmentNotFoundError } from '../utils/errors.js';
import { appointmentInclude, type AppointmentWithRelations, type PaginatedAppointments } from '../utils/types.js';

export const appointmentRepository = {
  async create(dto: CreateAppointmentDto): Promise<AppointmentWithRelations> {

    const patient = await prisma.patient.findUnique({ where: { id: dto.patientId } });
    if (!patient) throw new AppointmentPatientNotFoundError(dto.patientId);

    if (dto.reminderId) {
      const reminder = await prisma.reminder.findUnique({ where: { id: dto.reminderId } });
      if (!reminder) throw new AppointmentReminderNotFoundError(dto.reminderId);
    }

    const appointmentData: Prisma.AppointmentUncheckedCreateInput = {
      startAt: dto.startAt,
      endAt: dto.endAt,
      timezone: dto.timezone || "",
      price: dto.price,
      currency: dto.currency || "CST",
      paid: dto.paid,
      location: dto.location,
      meetingUrl: dto.meetingUrl || null,
      notes: dto.notes || null,
      type: dto.type,
      status: dto.status,
      patientId: dto.patientId,
      reminderId: dto.reminderId || null,
    };

    return prisma.appointment.create({
      data: appointmentData,
      include: appointmentInclude,
    });
  },

  async findById(id: string): Promise<AppointmentWithRelations> {
    const appt = await prisma.appointment.findUnique({
      where: { id },
      include: appointmentInclude,
    });
    if (!appt) throw new AppointmentNotFoundError(id);
    return appt;
  },

  async findMany(query: ListAppointmentsQuery): Promise<PaginatedAppointments> {
    const { patientId, status, startAt, dateFrom, dateTo, paid, page, pageSize, orderBy, order } = query;
    const skip = (page - 1) * pageSize;

    const where: Prisma.AppointmentWhereInput = {
      ...(patientId && { patientId }),
      ...(status && { status }),
      ...(paid !== undefined && { paid }),
      ...(startAt && { startAt }),
      ...(dateFrom || dateTo
        ? {
          startAt: {
            ...(dateFrom && { gte: dateFrom }),
            ...(dateTo && { lte: dateTo }),
          },
        }
        : {}),
    };

    const [ data, total ] = await prisma.$transaction([
      prisma.appointment.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { [ orderBy ]: order },
        include: appointmentInclude,
      }),
      prisma.appointment.count({ where }),
    ]);

    return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  },

  async update(id: string, dto: UpdateAppointmentDto): Promise<AppointmentWithRelations> {
    await appointmentRepository.findById(id);

    if (dto.reminderId) {
      const reminder = await prisma.reminder.findUnique({ where: { id: dto.reminderId } });
      if (!reminder) throw new AppointmentReminderNotFoundError(dto.reminderId);
    }

    const appointmentData: Prisma.AppointmentUncheckedUpdateInput = {
      ...(dto.startAt !== undefined && { startAt: dto.startAt }),
      ...(dto.endAt !== undefined && { endAt: dto.endAt }),
      ...(dto.timezone !== undefined && { timezone: dto.timezone }),
      ...(dto.price !== undefined && { price: dto.price }),
      ...(dto.currency !== undefined && { currency: dto.currency }),
      ...(dto.paid !== undefined && { paid: dto.paid }),
      ...(dto.location !== undefined && { location: dto.location }),
      ...(dto.meetingUrl !== undefined && { meetingUrl: dto.meetingUrl }),
      ...(dto.notes !== undefined && { notes: dto.notes }),
      ...(dto.type !== undefined && { type: dto.type }),
      ...(dto.status !== undefined && { status: dto.status }),
      ...(dto.cancelledAt !== undefined && { cancelledAt: dto.cancelledAt }),
      ...(dto.completedAt !== undefined && { completedAt: dto.completedAt }),
      ...(dto.reminderId !== undefined && { reminderId: dto.reminderId }),
    }

    return prisma.appointment.update({
      where: { id },
      data: appointmentData,
      include: appointmentInclude,
    });
  },

  async delete(id: string): Promise<Appointment> {
    await appointmentRepository.findById(id);
    return prisma.appointment.delete({ where: { id } });
  },

  async markPaid(id: string): Promise<AppointmentWithRelations> {
    await appointmentRepository.findById(id);
    return prisma.appointment.update({
      where: { id },
      data: { paid: true },
      include: appointmentInclude,
    });
  },
};

