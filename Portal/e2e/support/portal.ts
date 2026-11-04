import { expect, type Page, type TestInfo } from '@playwright/test';
import { Env } from '../utils/env';

/**
 * Shared steps for the public booking specs. OTP budget: `otp-request-ip` allows 10 code requests per
 * IP per 15 minutes for the whole run (every project and retry), so each spec requests at most one code
 * and reuses the session afterwards.
 */

export const MOCK_BREVO_URL = process.env.MOCK_BREVO_URL ?? 'http://localhost:4010';

export interface MockEmail { subject: string; textContent: string }

export async function inbox(email: string): Promise<MockEmail[]> {
    const res = await fetch(`${MOCK_BREVO_URL}/__test/messages?email=${encodeURIComponent(email)}`);
    return ((await res.json()) as { messages: MockEmail[] }).messages;
}

export async function subjects(email: string): Promise<string[]> {
    return (await inbox(email)).map((m) => m.subject);
}

export async function latestCode(email: string): Promise<string> {
    let code = '';
    await expect.poll(async () => {
        const res = await fetch(`${MOCK_BREVO_URL}/__test/latest-code?email=${encodeURIComponent(email)}`);
        if (!res.ok) return '';
        code = ((await res.json()) as { code: string }).code;
        return code;
    }, { message: 'OTP email never reached the mock Brevo server', timeout: 15_000 }).toMatch(/^\d{6}$/);
    return code;
}

/** Anonymous API calls must not carry the Vercel bypass headers (they are only for the Portal origin). */
export async function stripVercelBypass(page: Page) {
    await page.route(`${new URL(Env.apiBaseUrl).origin}/**`, (route) => {
        const headers = { ...route.request().headers() };
        delete headers[ 'x-vercel-protection-bypass' ];
        delete headers[ 'x-vercel-set-bypass-cookie' ];
        return route.continue({ headers });
    });
}

/** A per-run, per-project address, so reruns and parallel projects never share a mailbox. */
export function patientEmail(prefix: string, testInfo: TestInfo): string {
    return `${prefix}-${testInfo.project.name}-${Date.now()}@example.com`;
}

export interface PickedSlot { dayName: string; timeText: string }

/** Next week on the public page, the selected day, the `index`-th free time of the day. */
export async function pickSlot(page: Page, slug: string, index = 0): Promise<PickedSlot> {
    await page.goto(`/book/${slug}`);
    await page.getByRole('button', { name: 'Semana siguiente' }).click();
    const day = page.getByRole('group', { name: 'Días de la semana' }).locator('button[aria-pressed="true"]');
    await expect(day).toBeVisible();
    const dayName = (await day.getAttribute('aria-label'))!;
    const time = page.getByRole('list', { name: /Mañana|Tarde/ }).getByRole('button').nth(index);
    const timeText = (await time.textContent())!.trim();
    await time.click();
    // "Envía tu solicitud" in approval mode.
    await expect(page.getByRole('heading', { name: /Confirma tu cita|Envía tu solicitud/ })).toBeVisible();
    return { dayName, timeText };
}

/** Whether `slot` is offered on the public page right now (next week, same day). */
export async function slotOffered(page: Page, slug: string, slot: PickedSlot): Promise<number> {
    await page.goto(`/book/${slug}`);
    await page.getByRole('button', { name: 'Semana siguiente' }).click();
    await page.getByRole('group', { name: 'Días de la semana' }).getByRole('button', { name: slot.dayName }).click();
    return page.getByRole('list', { name: /Mañana|Tarde/ }).getByRole('button', { name: slot.timeText, exact: true }).count();
}

/** The booking form's email step: request a code and log in with it (one OTP request). */
export async function verifyEmail(page: Page, email: string) {
    await page.getByLabel('Correo electrónico').fill(email);
    const send = page.getByRole('button', { name: 'Enviar código' });
    await expect(send).toBeEnabled({ timeout: 20_000 });
    await send.click();
    await page.getByLabel('Código de 6 dígitos').fill(await latestCode(email));
    await page.getByRole('button', { name: 'Ingresar' }).click();
}

/** The booking form's details step, for a signed-in session. */
export async function submitDetails(page: Page, submitLabel: 'Reservar cita' | 'Enviar solicitud') {
    await page.getByLabel('Nombre').fill('Paciente');
    await page.getByLabel('Apellidos').fill('E2E');
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: submitLabel }).click();
}
