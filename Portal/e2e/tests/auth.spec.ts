import { test, expect } from '../fixtures';
import { LoginPage } from '../pages/LoginPage';
import { DashboardPage } from '../pages/DashboardPage';
import { LandingPage } from '../pages/LandingPage';
import { Env } from '../utils/env';

test.describe('Authentication & Session', () => {
  test('should redirect to login when unauthenticated', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });

  test('should show login error for invalid credentials', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto('/login');
    await loginPage.emailInput.fill('nonexistent@example.com');
    await loginPage.passwordInput.fill('wrongpassword');
    await loginPage.submitButton.click();
    await loginPage.expectError();
  });

  test('should login successfully with valid credentials', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.login(Env.testUserEmail, Env.testUserPassword);
    await expect(page).toHaveURL(/\/dashboard/);
    const dashboard = new DashboardPage(page);
    await dashboard.expectLoaded();
  });

  test('should redirect authenticated user away from /login', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/login');
    await expect(authenticatedPage).toHaveURL(/\/dashboard/);
  });

  test('should logout successfully', async ({ authenticatedPage }) => {
    const logoutButton = authenticatedPage.getByRole('button', { name: /Cerrar sesión|Logout|Salir/i });
    await logoutButton.click();
    await expect(authenticatedPage).toHaveURL(/\/login/);
  });

  test('should redirect to /login after logout from protected page', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/patients');
    await expect(authenticatedPage).toHaveURL(/\/patients/);
    const logoutButton = authenticatedPage.getByRole('button', { name: /Cerrar sesión|Logout|Salir/i });
    await logoutButton.click();
    await expect(authenticatedPage).toHaveURL(/\/login/);
  });

  test('should support ?from= redirect after login', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto('/login?from=/calendar');
    await loginPage.emailInput.fill(Env.testUserEmail);
    await loginPage.passwordInput.fill(Env.testUserPassword);
    await loginPage.submitButton.click();
    await page.waitForURL(/\/calendar/);
    await expect(page).toHaveURL(/\/calendar/);
  });

  test('should reject protocol-relative ?from= URL', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto('/login?from=//evil.com');
    await loginPage.emailInput.fill(Env.testUserEmail);
    await loginPage.passwordInput.fill(Env.testUserPassword);
    await loginPage.submitButton.click();
    await page.waitForURL(/\/dashboard/);
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('should show landing page for unauthenticated user', async ({ page }) => {
    await page.goto('/');
    const landing = new LandingPage(page);
    await landing.expectVisible();
  });

  test('should redirect to dashboard from landing page when authenticated', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/');
    await expect(authenticatedPage).toHaveURL(/\/dashboard/);
  });
});
