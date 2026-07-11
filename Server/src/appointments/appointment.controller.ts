import type { Request, Response } from 'express';
import { appointmentService } from './appointment.service.js';
import { ok } from '../utils/apiUtils.js';
import type { ListAppointmentsQuery, AppointmentStatsQuery } from './appointment.schemas.js';
import { AppointmentStatus } from '../../generated/prisma/client.ts';

export const appointmentController = {
  async list(req: Request<{}, any, any, ListAppointmentsQuery>, res: Response) {
    ok(res, await appointmentService.findMany(req.query, req.user!.id, req.user!.timezone));
  },

  async stats(req: Request<{}, any, any, AppointmentStatsQuery>, res: Response) {
    ok(res, await appointmentService.getStats(req.query, req.user!.id, req.user!.timezone));
  },

  async get(req: Request, res: Response) {
    ok(res, await appointmentService.findById(req.params.id as string, req.user!.id));
  },

  async create(req: Request, res: Response) {
    const appt = await appointmentService.create(req.body, req.user!.id);
    ok(res, appt, 201);
  },

  async update(req: Request, res: Response) {
    const appt = await appointmentService.update(req.params.id as string, req.body, req.user!.id);
    ok(res, appt);
  },

  async markPaid(req: Request, res: Response) {
    const appt = await appointmentService.markPaid(req.params.id as string, req.user!.id);
    ok(res, appt);
  },

  async confirm(req: Request, res: Response) {
    const appt = await appointmentService.setStatus(req.params.id as string, req.user!.id, AppointmentStatus.CONFIRMED);
    ok(res, appt);
  },

  async cancel(req: Request, res: Response) {
    const appt = await appointmentService.setStatus(req.params.id as string, req.user!.id, AppointmentStatus.CANCELLED);
    ok(res, appt);
  },

  async remove(req: Request, res: Response) {
    const result = await appointmentService.delete(req.params.id as string, req.user!.id);
    ok(res, { deleted: true, id: result.id });
  },

  async restore(req: Request, res: Response) {
    const appt = await appointmentService.restore(req.params.id as string, req.user!.id);
    ok(res, appt);
  },
};
