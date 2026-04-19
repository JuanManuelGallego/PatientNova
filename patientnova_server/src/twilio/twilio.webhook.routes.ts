import { Router, type Request, type Response } from 'express';
import { AppointmentStatus, ReminderStatus, Channel } from '@prisma/client';
import { twilioWebhookAuth } from '../middlewares/twilioWebhookAuth.js';
import { sendWhatsAppFreeForm } from './twilioClient.js';
import { prisma } from '../prisma/prismaClient.js';
import { logger } from '../utils/logger.js';

export const twilioWebhookRouter = Router();

const TWIML_EMPTY_RESPONSE = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';

/**
 * POST /webhooks/twilio/whatsapp-reply
 *
 * Twilio calls this endpoint when a patient taps a quick-reply button on an
 * appointment-reminder WhatsApp template.
 *
 * Expected fields in the URL-encoded body:
 *   From          — patient's WhatsApp number, e.g. "whatsapp:+15551234567"
 *   ButtonPayload — button identifier set in the template: "confirm" | "cancel"
 *   Body          — human-readable button text, e.g. "Confirmar cita"
 */
twilioWebhookRouter.post(
  '/',
  twilioWebhookAuth,
  async (req: Request, res: Response) => {
    // Always respond with an empty TwiML response so Twilio doesn't retry
    res.set('Content-Type', 'text/xml');

    try {
      const from: string = req.body.From ?? '';
      const buttonPayload: string = (req.body.ButtonPayload ?? '').toString().toLowerCase().trim();

      if (!from) {
        logger.warn('Received Twilio webhook with missing "From" field');
        res.status(200).send(TWIML_EMPTY_RESPONSE);
        return;
      }

      // Normalize to E.164 (strip "whatsapp:" prefix)
      const phoneNumber = from.replace(/^whatsapp:/i, '').trim();

      // Determine the patient's intent
      const isConfirm = buttonPayload.includes('confirm');
      const isCancel = buttonPayload.includes('cancel');

      if (!isConfirm && !isCancel) {
        logger.warn({ phoneNumber, buttonPayload }, 'Unrecognised ButtonPayload — ignoring webhook');
        res.status(200).send(TWIML_EMPTY_RESPONSE);
        return;
      }

      // Find the most recent WHATSAPP reminder for this phone number that is
      // linked to a SCHEDULED or CONFIRMED appointment
      const reminder = await prisma.reminder.findFirst({
        where: {
          to: phoneNumber,
          channel: Channel.WHATSAPP,
          appointmentId: { not: null },
          appointment: {
            status: { in: [ AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED ] },
          },
        },
        orderBy: { createdAt: 'desc' },
        include: { appointment: true },
      });

      if (!reminder || !reminder.appointment) {
        logger.warn({ phoneNumber, buttonPayload }, 'No active appointment reminder found for this phone number — ignoring webhook');
        res.status(200).send(TWIML_EMPTY_RESPONSE);
        return;
      }

      const { appointment } = reminder;

      if (isConfirm) {
        await prisma.$transaction([
          prisma.appointment.update({
            where: { id: appointment.id },
            data: { status: AppointmentStatus.CONFIRMED, confirmedAt: new Date() },
          }),
          prisma.reminder.update({
            where: { id: reminder.id },
            data: { status: ReminderStatus.SENT },
          }),
        ]);

        logger.info({ appointmentId: appointment.id, reminderId: reminder.id }, 'Appointment confirmed via WhatsApp quick-reply');

        await sendWhatsAppFreeForm(
          phoneNumber,
          '✅ ¡Tu cita ha sido confirmada! Te esperamos.',
        );
      } else {
        // isCancel
        await prisma.$transaction([
          prisma.appointment.update({
            where: { id: appointment.id },
            data: { status: AppointmentStatus.CANCELLED, cancelledAt: new Date() },
          }),
          prisma.reminder.update({
            where: { id: reminder.id },
            data: { status: ReminderStatus.CANCELLED },
          }),
        ]);

        logger.info({ appointmentId: appointment.id, reminderId: reminder.id }, 'Appointment cancelled via WhatsApp quick-reply');

        await sendWhatsAppFreeForm(
          phoneNumber,
          '❌ Tu cita ha sido cancelada. Para reagendar, por favor comunícate tu profesional de la salud.',
        );
      }
    } catch (err) {
      logger.error({ err }, 'Error processing WhatsApp quick-reply webhook');
    }

    res.status(200).send(TWIML_EMPTY_RESPONSE);
  },
);
