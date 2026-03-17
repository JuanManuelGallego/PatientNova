import { Prisma, ReminderMode, ReminderStatus, type Appointment, type Reminder } from '@prisma/client';
import { prisma } from '../prisma/prismaClient.js';
import {
  type CreateAppointmentDto,
  type UpdateAppointmentDto,
  type ListAppointmentsQuery,
  ReminderType,
} from './appointment.schemas.js';
import { AppointmentPatientNotFoundError, AppointmentReminderNotFoundError, AppointmentNotFoundError } from '../utils/errors.js';
import { appointmentInclude, Channel, type AppointmentWithRelations, type PaginatedAppointments } from '../utils/types.js';
import { reminderRepository } from '../reminders/reminder.repository.js';

export const appointmentRepository = {
  async create(dto: CreateAppointmentDto): Promise<AppointmentWithRelations> {
    const patient = await prisma.patient.findUnique({ where: { id: dto.patientId } });
    if (!patient) throw new AppointmentPatientNotFoundError(dto.patientId);

    let reminder: Reminder | null = null
    if (dto.reminderType !== ReminderType.NONE) {
      reminder = await reminderRepository.create({
        channel: Channel.WHATSAPP,
        to: patient.whatsappNumber ?? "",
        mode: ReminderMode.SCHEDULED,
        sendAt: getReminderSendAt(dto.date, dto.time, dto.reminderType),
        patientId: dto.patientId,
        status: ReminderStatus.PENDING,
        contentSid: "HXb5b62575e6e4ff6129ad7c8efe1f983e",
        contentVariables: {
          "1": "12/1",
          "2": "3pm"
        },
        scheduledAt: new Date().toISOString(),
      })
    }

    return prisma.appointment.create({
      data: {
        patientId: dto.patientId,
        date: dto.date,
        time: dto.time,
        status: dto.status,
        reminderId: reminder?.id || null,
        type: dto.type,
        location: dto.location,
        meetingUrl: dto.meetingUrl || null,
        price: dto.price,
        payed: dto.payed,
        duration: dto.duration,
      },
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
    const { patientId, status, date, dateFrom, dateTo, payed, page, pageSize, orderBy, order } = query;
    const skip = (page - 1) * pageSize;

    const where: Prisma.AppointmentWhereInput = {
      ...(patientId && { patientId }),
      ...(status && { status }),
      ...(payed !== undefined && { payed }),
      ...(date && { date }),
      ...(dateFrom || dateTo
        ? {
          date: {
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

    if (dto.patientId) {
      const patient = await prisma.patient.findUnique({ where: { id: dto.patientId } });
      if (!patient) throw new AppointmentPatientNotFoundError(dto.patientId);
    }
    if (dto.reminderId) {
      const reminder = await prisma.reminder.findUnique({ where: { id: dto.reminderId } });
      if (!reminder) throw new AppointmentReminderNotFoundError(dto.reminderId);
    }

    return prisma.appointment.update({
      where: { id },
      data: {
        ...(dto.patientId !== undefined && { patientId: dto.patientId }),
        ...(dto.date !== undefined && { date: dto.date }),
        ...(dto.time !== undefined && { time: dto.time }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.reminderId !== undefined && { reminderId: dto.reminderId }),
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.location !== undefined && { location: dto.location }),
        ...(dto.meetingUrl !== undefined && { meetingUrl: dto.meetingUrl || null }),
        ...(dto.price !== undefined && { price: dto.price }),
        ...(dto.payed !== undefined && { payed: dto.payed }),
        ...(dto.duration !== undefined && { duration: dto.duration }),
      },
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
      data: { payed: true },
      include: appointmentInclude,
    });
  },
};

function getReminderSendAt(date: string, time: string, reminderType: ReminderType): string {
  switch (reminderType) {
    case ReminderType.ONE_HOUR_BEFORE:
      return new Date(new Date(`${date}T${time}:00`).getTime() - 60 * 60 * 1000).toISOString();
    case ReminderType.ONE_DAY_BEFORE:
      return new Date(new Date(`${date}T${time}:00`).getTime() - 24 * 60 * 60 * 1000).toISOString();
    case ReminderType.ONE_WEEK_BEFORE:
      return new Date(new Date(`${date}T${time}:00`).getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    default:
      return new Date(`${date}T${time}:00`).toISOString();
  }
}

