import type { Browser, BrowserContext, Page } from '@playwright/test';
import { Env } from '../utils/env';
import { LoginPage } from '../pages/LoginPage';

/**
 * A second, signed-in browser context for a seeded portal provider, opened from a public spec. The
 * public projects run without the auth setup, and the shared SUPER_ADMIN account must never be used
 * for the inbox (its calendar would show the holds). `db:seed-e2e` gives every seeded account the Server's
 * ADMIN_PASSWORD, which the e2e env exposes as TEST_USER_PASSWORD (the auth setup already relies on both matching).
 */
export async function openProviderPage(browser: Browser, email: string): Promise<{ context: BrowserContext; page: Page }> {
    const context = await browser.newContext({
        baseURL: Env.baseUrl,
        locale: 'en-US',
        timezoneId: process.env.TZ,
        ...(Env.vercelAutomationBypassSecret && {
            extraHTTPHeaders: {
                'x-vercel-protection-bypass': Env.vercelAutomationBypassSecret,
                'x-vercel-set-bypass-cookie': 'true',
            },
        }),
    });
    const page = await context.newPage();
    await new LoginPage(page).login(email, Env.testUserPassword);
    await page.waitForURL(/\/dashboard/);
    return { context, page };
}
