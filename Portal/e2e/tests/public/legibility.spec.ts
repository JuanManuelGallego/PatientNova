import { expect, test } from '@playwright/test';
import { faintText, goToTimes, patientEmail, stripVercelBypass, submitDetails, verifyEmail } from '../../support/portal';

const SLUG = 'e2e-publica';

// Patients have no theme, but a provider who opened the page in their own browser left a dark one saved.
test.use({ colorScheme: 'dark' });

test('every label reads clearly in a browser with a dark theme saved', async ({ page }, testInfo) => {
    await stripVercelBypass(page);
    await page.addInitScript(() => localStorage.setItem('patientnova-theme', 'dark'));
    // Polled: a sheet fading in or a button changing color is faint only for those few frames.
    const check = (screen: string) => expect.poll(() => faintText(page), { message: screen }).toEqual([]);

    await page.goto(`/book/${SLUG}`);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page.getByRole('heading', { name: '¿Qué necesitas?' })).toBeVisible();

    // Desktop already shows the profile, so only phones open it.
    const openProfile = page.getByRole('button', { name: 'Ver perfil' });
    if (await openProfile.isVisible()) {
        await openProfile.click();
        await expect(page.getByRole('dialog')).toBeVisible();
        await check('profile');
        await page.keyboard.press('Escape');
    }
    await check('need, nothing chosen');

    await goToTimes(page, SLUG);
    await check('times, no time chosen');

    // Desktop shows the month beside the times, so only phones open it.
    const openCalendar = page.getByRole('button', { name: 'Ver calendario' });
    if (await openCalendar.isVisible()) {
        await openCalendar.click();
        await expect(page.getByRole('dialog')).toBeVisible();
        await check('calendar');
        await page.keyboard.press('Escape');
    }

    await page.getByRole('button', { name: /Primer horario/ }).click();
    await check('times, time chosen');

    await page.getByRole('button', { name: 'Continuar' }).click();
    await expect(page.getByRole('heading', { name: '¿Dónde te enviamos el código?' })).toBeVisible();
    await check('verify');

    await verifyEmail(page, patientEmail('legible', testInfo));
    await expect(page.getByLabel('Nombre')).toBeVisible();
    await check('details');

    await page.getByRole('button', { name: 'Reservar cita' }).click();
    await expect(page.getByRole('alert').first()).toBeVisible();
    await check('details with errors');

    await submitDetails(page, 'Reservar cita');
    await expect(page.getByRole('heading', { name: 'Tu cita quedó reservada' })).toBeVisible();
    await check('result');

    await page.getByRole('link', { name: 'Ver mis citas' }).click();
    await expect(page.getByRole('list', { name: 'Próximas citas' })).toBeVisible();
    await check('Mis citas');

    await page.getByRole('button', { name: 'Reprogramar' }).first().click();
    await expect(page.getByRole('heading', { name: 'Reprogramar cita' })).toBeVisible();
    await check('reschedule');
});
