import { AppointmentStatus, ReminderStatus, Channel, type Reminder } from '../../generated/prisma/client.js';
import { sendSms, sendWhatsApp, sendWhatsAppFreeForm } from './twilioClient.js';
import { prisma } from '../prisma/prismaClient.js';
import { logger } from '../utils/logger.js';
import type { SendWhatsAppRequest } from '../utils/types';
import { config } from '../utils/config.js';
import type { SendSmsRequest } from '../utils/types';

interface WebhookPayload {
    from?: string;
    buttonPayload?: string;
    body?: string;
}

interface ProcessResult {
    success: boolean;
    message?: string | undefined;
}

interface AppointmentNotificationVars {
    userDisplayName: string;
    patientName: string;
    statusText: string;
    appointmentDate: string;
    appointmentTime: string;
}

export class TwilioWebhookService {
    /**
     * Normalize WhatsApp number by stripping "whatsapp:" prefix
     */
    normalizePhoneNumber(from: string): string {
        return from.replace(/^whatsapp:/i, '').trim();
    }

    /**
     * Validate and normalize webhook payload
     */
    validateWebhookPayload(payload: WebhookPayload): { isValid: boolean; phoneNumber?: string; buttonPayload?: string; error?: string } {
        const from = payload.from ?? '';

        if (!from) {
            logger.warn('Received Twilio webhook with missing "From" field');
            return { isValid: false, error: 'Missing "From" field' };
        }

        const phoneNumber = this.normalizePhoneNumber(from);
        const buttonPayload = (payload.buttonPayload ?? '').toString().toLowerCase().trim();

        if (!phoneNumber || !buttonPayload) {
            logger.warn({ from, buttonPayload }, 'Received Twilio webhook with missing phone number or button payload');
            return { isValid: false, error: 'Missing phone number or button payload' };
        }

        return { isValid: true, phoneNumber, buttonPayload };
    }

    /**
     * Determine user intent from button payload
     */
    determineUserIntent(buttonPayload: string): { intent: 'confirm' | 'cancel' | null } {
        const isConfirm = buttonPayload.includes('confirm');
        const isCancel = buttonPayload.includes('cancel');

        if (!isConfirm && !isCancel) {
            logger.warn({ buttonPayload }, 'Unrecognised ButtonPayload — ignoring webhook');
            return { intent: null };
        }

        return { intent: isConfirm ? 'confirm' : 'cancel' };
    }

    /**
     * Find the most recent active reminder for a phone number
     */
    async findActiveReminder(phoneNumber: string): Promise<(Reminder) | null> {
        const reminder = await prisma.reminder.findFirst({
            where: {
                to: phoneNumber,
                channel: Channel.WHATSAPP,
                sentAt: { lte: new Date() },
                appointmentId: { not: null },
                appointment: {
                    status: { in: [ AppointmentStatus.SCHEDULED ] },
                },
            },
            orderBy: { sendAt: 'desc' },
            include: { appointment: true },
        });

        if (!reminder) {
            logger.warn({ phoneNumber }, 'No active appointment reminder found for this phone number — ignoring webhook');
        }

        return reminder;
    }

    /**
     * Confirm an appointment and mark the reminder as sent
     */
    async confirmAppointment(reminder: Reminder, phoneNumber: string): Promise<void> {
        await prisma.$transaction([
            prisma.appointment.update({
                where: { id: reminder.appointmentId! },
                data: { status: AppointmentStatus.CONFIRMED, confirmedAt: new Date() },
            }),
            prisma.reminder.update({
                where: { id: reminder.id },
                data: { status: ReminderStatus.SENT },
            }),
        ]);

        logger.info(
            { appointmentId: reminder.appointmentId, reminderId: reminder.id },
            'Appointment confirmed via WhatsApp quick-reply',
        );

        try {
            await sendWhatsAppFreeForm(phoneNumber, '✅ ¡Tu cita ha sido confirmada! Te esperamos.');
        } catch (err) {
            logger.error({ err, appointmentId: reminder.appointmentId, phoneNumber }, 'Failed to send confirmation reply to patient');
        }
    }

    /**
     * Cancel an appointment and mark the reminder as cancelled
     */
    async cancelAppointment(reminder: Reminder, phoneNumber: string): Promise<void> {
        await prisma.$transaction([
            prisma.appointment.update({
                where: { id: reminder.appointmentId! },
                data: { status: AppointmentStatus.CANCELLED, cancelledAt: new Date() },
            }),
            prisma.reminder.update({
                where: { id: reminder.id },
                data: { status: ReminderStatus.CANCELLED },
            }),
        ]);

        logger.info(
            { appointmentId: reminder.appointmentId, reminderId: reminder.id },
            'Appointment cancelled via WhatsApp quick-reply',
        );

        try {
            await sendWhatsAppFreeForm(
                phoneNumber,
                '❌ Tu cita ha sido cancelada. Para reagendar, por favor comunícate tu profesional de la salud.',
            );
        } catch (err) {
            logger.error({ err, appointmentId: reminder.appointmentId, phoneNumber }, 'Failed to send cancellation reply to patient');
        }
    }
    /**
     * Notify user of appointment status update (confirmation or cancellation)
     */
    async notifyUserOfStatusUpdate(appointmentId: string, newStatus: AppointmentStatus): Promise<void> {
        try {
            // Fetch appointment with related patient and user in a single query
            const appointment = await prisma.appointment.findUnique({
                where: { id: appointmentId },
                include: {
                    patient: {
                        include: {
                            user: true,
                        },
                    },
                },
            });

            // Validate data exists and has required fields
            if (!appointment?.patient?.user) {
                logger.warn({ appointmentId }, 'Could not find appointment with related patient and user');
                return;
            }

            const { patient, patient: { user } } = appointment;

            if (!user.reminderActive) {
                logger.info({ userId: user.id }, 'User does not have a notifications enabled');
                return;
            }

            // Format appointment date and time
            const notificationVars = this.buildNotificationVariables(
                appointment.startAt,
                user.displayName,
                patient.name,
                patient.lastName,
                newStatus,
            );

            if (user.reminderChannel === Channel.WHATSAPP) {
                if (!user.whatsappNumber) {
                    logger.warn({ userId: user.id }, 'User does not have a WhatsApp number on file');
                    return;
                }

                // Send notification
                const sendWhatsAppRequest: SendWhatsAppRequest = {
                    to: user.whatsappNumber,
                    contentSid: config.twilio.appointmentStatusUpdateSid,
                    contentVariables: {
                        "1": notificationVars.userDisplayName,
                        "2": notificationVars.patientName,
                        "3": notificationVars.statusText,
                        "4": notificationVars.appointmentDate,
                        "5": notificationVars.appointmentTime,
                    },
                };
                await sendWhatsApp(sendWhatsAppRequest);
            }
            else if (user.reminderChannel === Channel.SMS) {
                if (!user.phoneNumber) {
                    logger.warn({ userId: user.id }, 'User does not have a phone number on file');
                    return;
                }

                const sendSmsRequest: SendSmsRequest = {
                    to: user.phoneNumber,
                    body: `Hola, ${notificationVars.userDisplayName}. Le informamos que el/la paciente ${notificationVars.patientName} ha ${notificationVars.statusText} su cita programada para el día ${notificationVars.appointmentDate} a las ${notificationVars.appointmentTime}. Feliz dia`
                }

                await sendSms(sendSmsRequest);
            }

            logger.info(
                { appointmentId, userId: user.id, status: newStatus },
                'Appointment status update notification sent',
            );
        } catch (err) {
            logger.error({ err, appointmentId }, 'Failed to send appointment status update notification');
            throw err;
        }
    }

    /**
     * Build notification variables with formatted date and status text
     */
    private buildNotificationVariables(
        startAt: Date,
        userDisplayName: string | null,
        patientName: string,
        patientLastName: string | null,
        newStatus: AppointmentStatus,
    ): AppointmentNotificationVars {
        const appointmentDate = new Date(startAt);

        const fecha = appointmentDate.toLocaleString('es-ES', {
            timeZone: config.defaults.timezone,
            day: 'numeric',
            month: 'long',
        });

        const hora = appointmentDate.toLocaleString('es-ES', {
            timeZone: config.defaults.timezone,
            timeStyle: 'short',
        });

        const statusText = newStatus === AppointmentStatus.CONFIRMED ? 'confirmado' : 'cancelado';

        return {
            userDisplayName: userDisplayName || 'Usuario',
            patientName: `${patientName} ${patientLastName || ''}`.trim(),
            statusText,
            appointmentDate: fecha,
            appointmentTime: hora,
        };
    }

    async sendErrorMessage(phoneNumber: string): Promise<void> {
        try {
            await sendWhatsAppFreeForm(phoneNumber, 'Disculpa, no puedo procesar tu mensaje. Por favor, comunícate con tu profesional de la salud.');
        } catch (err) {
            logger.error({ err, phoneNumber }, 'Failed to send error reply to patient');
        }
    }

    /**
     * Process a WhatsApp quick-reply webhook
     */
    async processWhatsAppReply(payload: WebhookPayload): Promise<ProcessResult> {
        // Validate payload
        const validation = this.validateWebhookPayload(payload);
        const phoneNumber = validation.phoneNumber;
        if (!validation.isValid) {
            if (phoneNumber) {
                await this.sendErrorMessage(phoneNumber);
            }
            return { success: false, message: validation.error };
        }

        // Determine intent
        const { intent } = this.determineUserIntent(validation.buttonPayload!);
        if (!intent) {
            await this.sendErrorMessage(phoneNumber!);

            return { success: false, message: 'Unknown intent' };
        }

        // Find active reminder
        const reminder = await this.findActiveReminder(phoneNumber!);
        if (!reminder) {
            await this.sendErrorMessage(phoneNumber!);
            return { success: false, message: 'No active reminder found' };
        }

        // Process based on intent
        try {
            if (intent === 'confirm') {
                await this.confirmAppointment(reminder, phoneNumber!);
                await this.notifyUserOfStatusUpdate(reminder.appointmentId!, AppointmentStatus.CONFIRMED);
            } else {
                await this.cancelAppointment(reminder, phoneNumber!);
                await this.notifyUserOfStatusUpdate(reminder.appointmentId!, AppointmentStatus.CANCELLED);
            }
            return { success: true };
        } catch (err) {
            logger.error({ err }, 'Error processing WhatsApp quick-reply');
            await this.sendErrorMessage(phoneNumber!);
            return { success: false, message: 'Internal error' };
        }
    }
}

export const twilioWebhookService = new TwilioWebhookService();
