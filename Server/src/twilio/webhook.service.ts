import { AppointmentStatus, CancelledBy, Channel, type Reminder } from '../../generated/prisma/client.ts';
import { sendSms, sendWhatsApp, sendWhatsAppFreeForm } from './client.js';
import { sendEmail } from '../brevo/email-client.js';
import { prisma, type TransactionClient } from '../utils/prisma/prisma-client.js';
import { withProviderLock } from '../utils/prisma/provider-lock.js';
import { logger, maskPhone } from '../utils/api/logger.js';
import type { SendWhatsAppRequest } from './types';
import { config } from '../utils/config/config.js';
import type { SendSmsRequest } from './types';
import { logAudit } from '../audit-log/audit-log.utils.js';
import { EntityType, ActionType, ActionSource } from '../../generated/prisma/enums.ts';
import { contactHash } from '../utils/encryption/blind-index.js';

interface WebhookPayload {
    from?: string;
    buttonPayload?: string;
    body?: string;
}

// A quick reply may arrive long after the reminder was sent. Only an upcoming, active,
// non-deleted appointment can still be confirmed or cancelled by the patient; anything else
// (cancelled, completed, no-show, deleted, already started) is left untouched.
const PATIENT_MODIFIABLE_STATUSES: ReadonlySet<AppointmentStatus> = new Set([
    AppointmentStatus.SCHEDULED,
    AppointmentStatus.CONFIRMED,
]);

const NOT_MODIFIABLE_REPLY = 'Esta cita ya no se puede modificar desde aquí. Por favor, comunícate con tu profesional de la salud.';

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
            logger.warn({ phoneLast4: maskPhone(from), buttonPayload }, 'Received Twilio webhook with missing phone number or button payload');
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
                // `to` is encrypted; match the destination through its blind index.
                toHash: contactHash(phoneNumber),
                channel: Channel.WHATSAPP,
                sentAt: { lte: new Date() },
                appointmentId: { not: null },
            },
            orderBy: { sendAt: 'desc' },
            include: { appointment: true },
        });

        if (!reminder) {
            logger.warn({ phoneLast4: maskPhone(phoneNumber) }, 'No active appointment reminder found for this phone number — ignoring webhook');
        }

        return reminder;
    }

    /**
     * Applies a patient's quick reply under the provider lock, so it serializes with provider edits
     * and re-reads the appointment inside the transaction. Returns false (no change) when the
     * appointment can no longer be modified by the patient.
     */
    private async applyPatientReply(reminder: Reminder, intent: 'confirm' | 'cancel'): Promise<boolean> {
        return prisma.$transaction(async (tx: TransactionClient) => {
            await withProviderLock(tx, reminder.userId);
            const appt = await tx.appointment.findFirst({
                where: { id: reminder.appointmentId!, userId: reminder.userId, isDeleted: false },
                select: { status: true, startAt: true },
            });
            if (!appt || !PATIENT_MODIFIABLE_STATUSES.has(appt.status) || appt.startAt.getTime() <= Date.now()) {
                logger.info(
                    { appointmentId: reminder.appointmentId, status: appt?.status ?? null, intent },
                    'WhatsApp quick-reply ignored: appointment no longer modifiable',
                );
                return false;
            }

            const now = new Date();
            const data = intent === 'confirm'
                ? { status: AppointmentStatus.CONFIRMED, confirmedAt: now }
                : { status: AppointmentStatus.CANCELLED, cancelledAt: now, cancelledBy: CancelledBy.PATIENT, paid: false };
            await tx.appointment.update({ where: { id: reminder.appointmentId! }, data });

            await logAudit({
                entityType: EntityType.APPOINTMENT,
                entityId: reminder.appointmentId!,
                userId: reminder.userId,
                actionType: ActionType.UPDATE,
                source: ActionSource.API,
                description: intent === 'confirm'
                    ? 'Cita confirmada via respuesta rápida de WhatsApp'
                    : 'Cita cancelada via respuesta rápida de WhatsApp',
                affectedFields: intent === 'confirm' ? [ 'status' ] : [ 'status', 'paid', 'cancelledBy' ],
                fieldsBefore: { status: appt.status },
                fieldsAfter: intent === 'confirm'
                    ? { status: AppointmentStatus.CONFIRMED }
                    : { status: AppointmentStatus.CANCELLED, paid: false, cancelledBy: CancelledBy.PATIENT },
                tx,
                required: true,
            });
            return true;
        }, { timeout: 10000 });
    }

    /**
     * Confirm an upcoming appointment. Returns false when it can no longer be modified.
     */
    async confirmAppointment(reminder: Reminder, phoneNumber: string): Promise<boolean> {
        if (!(await this.applyPatientReply(reminder, 'confirm'))) return false;

        logger.info(
            { appointmentId: reminder.appointmentId, reminderId: reminder.id },
            'Appointment confirmed via WhatsApp quick-reply',
        );

        try {
            await sendWhatsAppFreeForm(phoneNumber, '✅ ¡Tu cita ha sido confirmada! Te esperamos.');
        } catch (err) {
            logger.error({ err, appointmentId: reminder.appointmentId }, 'Failed to send confirmation reply to patient');
        }
        return true;
    }

    /**
     * Cancel an upcoming appointment. Returns false when it can no longer be modified.
     */
    async cancelAppointment(reminder: Reminder, phoneNumber: string): Promise<boolean> {
        if (!(await this.applyPatientReply(reminder, 'cancel'))) return false;

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
            logger.error({ err, appointmentId: reminder.appointmentId }, 'Failed to send cancellation reply to patient');
        }
        return true;
    }

    /**
     * Notify user of appointment status update (confirmation or cancellation)
     */
    async notifyUserOfStatusUpdate(appointmentId: string, newStatus: AppointmentStatus): Promise<void> {
        try {
            // Fetch appointment with related patient and user in a single query
            const appointment = await prisma.appointment.findUnique({
                where: { id: appointmentId },
                include: {patient: true, user: true}
            });

            // Validate data exists and has required fields
            if (!appointment) {
                logger.warn({ appointmentId }, 'Could not find appointment with related patient and user');
                return;
            }

            const { patient, user } = appointment;

            if (!patient || !user) {
                logger.warn({ appointmentId }, 'Appointment missing required patient or user relation');
                return;
            }

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
                    body: this.buildStatusUpdateText(notificationVars),
                }

                await sendSms(sendSmsRequest);
            }
            else if (user.reminderChannel === Channel.EMAIL) {
                await sendEmail({
                    to: user.email,
                    subject: `Cita ${notificationVars.statusText} — ${notificationVars.patientName}`,
                    body: this.buildStatusUpdateText(notificationVars),
                });
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

    private buildStatusUpdateText(vars: AppointmentNotificationVars): string {
        return `Hola, ${vars.userDisplayName}. Le informamos que el/la paciente ${vars.patientName} ha ${vars.statusText} su cita programada para el día ${vars.appointmentDate} a las ${vars.appointmentTime}. Feliz dia`;
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
            logger.error({ err, phoneLast4: maskPhone(phoneNumber) }, 'Failed to send error reply to patient');
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
        let applied: boolean;
        try {
            applied = intent === 'confirm'
                ? await this.confirmAppointment(reminder, phoneNumber!)
                : await this.cancelAppointment(reminder, phoneNumber!);
        } catch (err) {
            logger.error({ err }, 'Error processing WhatsApp quick-reply');
            await this.sendErrorMessage(phoneNumber!);
            return { success: false, message: 'Internal error' };
        }

        if (!applied) {
            try {
                await sendWhatsAppFreeForm(phoneNumber!, NOT_MODIFIABLE_REPLY);
            } catch (err) {
                logger.error({ err, appointmentId: reminder.appointmentId }, 'Failed to send not-modifiable reply to patient');
            }
            return { success: false, message: 'Appointment not modifiable' };
        }

        // Notify user of status update — failure here should not error-message the patient
        // since the appointment action already succeeded
        try {
            const status = intent === 'confirm' ? AppointmentStatus.CONFIRMED : AppointmentStatus.CANCELLED;
            await this.notifyUserOfStatusUpdate(reminder.appointmentId!, status);
        } catch (err) {
            logger.error({ err, appointmentId: reminder.appointmentId }, 'Failed to notify user of appointment status update');
        }

        return { success: true };
    }
}

export const twilioWebhookService = new TwilioWebhookService();
