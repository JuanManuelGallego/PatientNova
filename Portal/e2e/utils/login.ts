import { expect, Page } from "@playwright/test";
import { DashboardPage } from "../pages/DashboardPage";
import { LoginPage } from "../pages/LoginPage";
import { Env } from "./env";

export const login = async (page: Page) => {
    await page.context().clearCookies();
    await page.context().clearPermissions();

    const loginPage = new LoginPage(page);
    await loginPage.login(Env.testUserEmail, Env.testUserPassword);

    await expect(page).toHaveURL(/\/dashboard/);

    const dashboard = new DashboardPage(page);
    await dashboard.expectLoaded();
}