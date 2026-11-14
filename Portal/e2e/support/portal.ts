import { expect, type Page, type TestInfo } from '@playwright/test';
import { Env } from '../utils/env';


export const MOCK_BREVO_URL = process.env.MOCK_BREVO_URL ?? 'http://localhost:4010';

export interface MockEmail { subject: string; textContent: string }

export async function inbox(email: string): Promise<MockEmail[]> {
    const res = await fetch(`${MOCK_BREVO_URL}/__test/messages?email=${encodeURIComponent(email)}`);
    return ((await res.json()) as { messages: MockEmail[] }).messages;
}

export async function subjects(email: string): Promise<string[]> {
    return (await inbox(email)).map((m) => m.subject);
}

export async function latestLink(email: string, not?: string): Promise<string> {
    let link = '';
    await expect.poll(async () => {
        const res = await fetch(`${MOCK_BREVO_URL}/__test/latest-link?to=${encodeURIComponent(email)}`);
        if (!res.ok) return '';
        link = ((await res.json()) as { link: string }).link;
        return link === not ? '' : link;
    }, { message: 'The confirmation link email never reached the mock Brevo server', timeout: 15_000 }).toMatch(/\/book\/confirmar\/[\w-]+$/);
    return link;
}

export async function stripVercelBypass(page: Page) {
    await page.route(`${new URL(Env.apiBaseUrl).origin}/**`, (route) => {
        const headers = { ...route.request().headers() };
        delete headers[ 'x-vercel-protection-bypass' ];
        delete headers[ 'x-vercel-set-bypass-cookie' ];
        return route.continue({ headers });
    });
}

export function patientEmail(prefix: string, testInfo: TestInfo): string {
    return `${prefix}-${testInfo.project.name}-${Date.now()}@example.com`;
}

export interface PickedSlot { dayName: string; timeText: string }

/** Whichever day picker this viewport shows: the strip on phones, the month calendar on desktop. */
export const dayPicker = (page: Page) => page.getByRole('group', { name: /Días disponibles|Calendario de horarios/ });

const openDays = (page: Page) => dayPicker(page).locator('button:not([aria-disabled="true"]):not([aria-label^="Mes"])');

/** Tu cita, up to Horario. The e2e providers offer several types and one place. */
export async function goToTimes(page: Page, slug: string) {
    await page.goto(`/book/${slug}`);
    const need = page.getByRole('heading', { name: '¿Qué necesitas?' });
    const times = page.getByRole('heading', { name: '¿Cuándo te queda bien?' });
    await expect(need.or(times)).toBeVisible();
    if (await need.isVisible()) {
        await page.getByRole('group', { name: 'Tipo de cita' }).getByRole('button').first().click();
        await page.getByRole('button', { name: 'Ver horarios' }).click();
    }
    await expect(times).toBeVisible();
    await expect(openDays(page).first()).toBeVisible();
}

/** The second open day: today can run out of times, which would shift the indexes between calls. */
export async function pickSecondDay(page: Page): Promise<string> {
    const day = openDays(page).nth(1);
    await day.click();
    await expect(day).toHaveAttribute('aria-pressed', 'true');
    return (await day.getAttribute('aria-label'))!;
}

export async function pickSlot(page: Page, slug: string, index = 0): Promise<PickedSlot> {
    await goToTimes(page, slug);
    const dayName = await pickSecondDay(page);
    const time = page.getByRole('list', { name: /Mañana|Tarde/ }).getByRole('button').nth(index);
    const timeText = (await time.textContent())!.trim();
    await time.click();
    await page.getByRole('button', { name: 'Continuar' }).click();
    await expect(page.getByRole('heading', { name: 'Último paso' })).toBeVisible();
    return { dayName, timeText };
}

export async function slotOffered(page: Page, slug: string, slot: PickedSlot): Promise<number> {
    await goToTimes(page, slug);
    const day = dayPicker(page).getByRole('button', { name: slot.dayName, exact: true });
    const nextMonth = dayPicker(page).getByRole('button', { name: 'Mes siguiente' });
    if (await day.count() === 0 && await nextMonth.count() > 0) await nextMonth.click();
    if (await day.count() === 0) return 0;
    await day.click();
    return page.getByRole('list', { name: /Mañana|Tarde/ }).getByRole('button', { name: slot.timeText, exact: true }).count();
}

export async function fillDetails(page: Page, email: string) {
    await page.getByLabel('Nombre').fill('Paciente');
    await page.getByLabel('Apellidos').fill('E2E');
    await page.getByRole('group', { name: 'Recibir el enlace de confirmación por' }).getByRole('button', { name: 'Correo' }).click();
    await page.getByLabel('Correo electrónico').fill(email);
    await page.getByRole('checkbox').check();
}

export async function submitDetails(page: Page, submitLabel: 'Reservar cita' | 'Enviar solicitud') {
    const submit = page.getByRole('button', { name: submitLabel });
    await expect(submit).toBeEnabled({ timeout: 20_000 });
    await submit.click();
}

export async function requestByEmail(page: Page, email: string, submitLabel: 'Reservar cita' | 'Enviar solicitud') {
    await fillDetails(page, email);
    await submitDetails(page, submitLabel);
    await expect(page.getByRole('heading', { name: 'Revisa tu correo' })).toBeVisible();
}

export async function confirmFromEmail(page: Page, link: string, finalHeading: string) {
    await page.goto(link);
    await expect(page.getByTestId('confirmation-unconfirmed')).toBeVisible();
    await page.getByRole('button', { name: 'Confirmar mi cita' }).click();
    await expect(page.getByRole('heading', { name: finalHeading })).toBeVisible();
}

/** Text under 4.5:1 against what is behind it, opacity included. Disabled controls count: a patient still has to read them. */
export async function faintText(page: Page): Promise<string[]> {
    return page.evaluate(() => {
        type Rgb = { r: number; g: number; b: number; a: number };
        const parse = (color: string): Rgb => {
            const [ r, g, b, a = 1 ] = color.match(/[\d.]+/g)!.map(Number);
            return { r, g, b, a };
        };
        const mix = (top: Rgb, under: Rgb, alpha: number): Rgb => ({
            r: top.r * alpha + under.r * (1 - alpha),
            g: top.g * alpha + under.g * (1 - alpha),
            b: top.b * alpha + under.b * (1 - alpha),
            a: 1,
        });
        const luminance = ({ r, g, b }: Rgb) => {
            const linear = (v: number) => (v / 255 <= 0.03928 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4);
            return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
        };
        const opacity = (el: Element | null): number => (el ? Number(getComputedStyle(el).opacity) * opacity(el.parentElement) : 1);
        const background = (el: Element | null): Rgb => {
            const layers: Rgb[] = [];
            for (let e = el; e; e = e.parentElement) {
                const layer = parse(getComputedStyle(e).backgroundColor);
                if (layer.a > 0) layers.push(layer);
                if (layer.a === 1) break;
            }
            return layers.reverse().reduce((under, layer) => mix(layer, under, layer.a), { r: 255, g: 255, b: 255, a: 1 });
        };

        const white: Rgb = { r: 255, g: 255, b: 255, a: 1 };
        const faint = new Set<string>();
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) {
            const text = walker.currentNode.textContent?.trim();
            const el = walker.currentNode.parentElement!;
            if (!text || [ 'SCRIPT', 'STYLE', 'NEXT-ROUTE-ANNOUNCER' ].includes(el.tagName) || !el.getClientRects().length) continue;
            const seen = opacity(el);
            if (seen === 0) continue; // Hidden on purpose, like the name a sheet pins once it scrolls.
            const under = mix(background(el), white, seen);
            const color = parse(getComputedStyle(el).color);
            const a = luminance(mix(color, under, color.a * seen));
            const b = luminance(under);
            const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
            if (ratio < 4.5) faint.add(`${ratio.toFixed(2)}:1 ${text.slice(0, 40)}`);
        }
        return [ ...faint ];
    });
}
