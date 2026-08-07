import { Page } from "@playwright/test";
import { LoginPage } from "../pages/LoginPage";
import { Env } from "./env";

export async function setup(page: Page) {
    const context = page.context();
    await context.clearCookies();
    await context.clearPermissions();

    const loginPage = new LoginPage(page);

    await loginPage.login(Env.testUserEmail, Env.testUserPassword);
}