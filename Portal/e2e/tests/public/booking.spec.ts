import { expect, test } from '@playwright/test';
import {
    fillDetails,
    inbox,
    latestLink,
    patientEmail,
    pickSlot,
    slotOffered,
    stripVercelBypass,
    subjects,
    submitDetails,
} from '../../support/portal';

const SLUG = 'e2e-publica';
const PROVIDER_EMAIL = 'e2e-public-provider@example.com';
const PROVIDER_NAME = 'Dra. Ana Pública';

test.describe('booking confirmed by the emailed link', () => {
    test.beforeEach(async ({ page }) => {
        await stripVercelBypass(page);
    });

    test('hold the time, confirm from the email, and only then is it booked', async ({ page }, testInfo) => {
        const email = patientEmail('reserva', testInfo);
        const providerNoticesBefore = (await inbox(PROVIDER_EMAIL)).length;

        const slot = await pickSlot(page, SLUG);

        const channels = page.getByRole('group', { name: 'Recibir el enlace de confirmación por' });
        await channels.getByRole('button', { name: 'WhatsApp' }).click();
        await expect(page.getByLabel('Número de WhatsApp')).toBeVisible();
        await channels.getByRole('button', { name: 'Correo' }).click();

        await fillDetails(page, email);
        await submitDetails(page, 'Reservar cita');
        const pending = page.getByTestId('booking-pending');
        await expect(pending).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Revisa tu correo' })).toBeVisible();
        await expect(pending).toContainText('Tu cita todavía no está confirmada');
        await expect(page.getByTestId('pending-time')).toContainText(slot.timeText);

        if (testInfo.project.name === 'public') {
            await page.getByRole('button', { name: /Corregir/ }).click();
            await expect(page.getByRole('heading', { name: 'Último paso' })).toBeVisible();
            await expect(page.getByLabel('Nombre')).toHaveValue('Paciente');
            await expect(page.getByLabel('Correo electrónico')).toHaveValue(email);
            await submitDetails(page, 'Reservar cita');
            await expect(page.getByRole('heading', { name: 'Revisa tu correo' })).toBeVisible();
        }

        const link = await latestLink(email);
        expect(link).toContain('/book/confirmar/');
        expect(await subjects(email)).toContain(`Confirma tu cita con ${PROVIDER_NAME}`);

        expect(await slotOffered(page, SLUG, slot)).toBe(0);
        expect(await subjects(email)).not.toContain(`Cita confirmada con ${PROVIDER_NAME}`);
        expect((await inbox(PROVIDER_EMAIL)).length).toBe(providerNoticesBefore);

        await page.goto(link);
        await expect(page.getByTestId('confirmation-unconfirmed')).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Confirma tu cita' })).toBeVisible();
        await expect(page.getByTestId('confirmation-time')).toContainText(slot.timeText);
        expect(await subjects(email)).not.toContain(`Cita confirmada con ${PROVIDER_NAME}`);
        expect((await inbox(PROVIDER_EMAIL)).length).toBe(providerNoticesBefore);

        await page.getByRole('button', { name: 'Confirmar mi cita' }).click();
        await expect(page.getByRole('heading', { name: 'Tu cita está confirmada' })).toBeVisible();
        await expect(page.getByTestId('confirmation-confirmed')).toContainText(slot.timeText);
        await expect(page.getByRole('button', { name: 'Agregar al calendario' })).toBeVisible();

        await expect.poll(() => subjects(email)).toContain(`Cita confirmada con ${PROVIDER_NAME}`);
        await expect.poll(async () => (await inbox(PROVIDER_EMAIL)).length).toBeGreaterThan(providerNoticesBefore);
        const notice = (await inbox(PROVIDER_EMAIL)).at(-1)!;
        expect(notice.subject).toBe('Nueva cita reservada en línea');
        expect(notice.textContent).not.toContain('Paciente E2E');

        expect(await slotOffered(page, SLUG, slot)).toBe(0);
    });

    test('an unknown link shows the unavailable page and is not indexed', async ({ page }) => {
        await page.goto('/book/confirmar/este-enlace-no-existe-0000000000000000000000000');
        await expect(page.getByRole('heading', { name: 'Esta página de reservas no está disponible' })).toBeVisible();
        await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    });
});
