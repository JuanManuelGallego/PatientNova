import type { Browser, BrowserContext, Page } from '@playwright/test';
import { Env } from '../utils/env';
import { LoginPage } from '../pages/LoginPage';

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
