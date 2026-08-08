import { test, expect } from '../fixtures';
import { SidebarPage } from '../pages/SidebarPage';

test.describe('Sidebar Navigation', () => {
  test.describe('Desktop', () => {
    test('should display sidebar with brand', async ({ authenticatedPage }) => {
      const sidebar = new SidebarPage(authenticatedPage);
      await sidebar.expectVisible();
      await sidebar.expectBrandVisible();
    });

    test('should display all navigation links', async ({ authenticatedPage }) => {
      const sidebar = new SidebarPage(authenticatedPage);
      await sidebar.expectAllNavLinksVisible();
    });

    test('should highlight active link for current page', async ({ authenticatedPage }) => {
      const sidebar = new SidebarPage(authenticatedPage);
      await sidebar.expectActiveLink('dashboard');
    });

    test('should navigate to patients page', async ({ authenticatedPage }) => {
      const sidebar = new SidebarPage(authenticatedPage);
      await sidebar.clickLink('patients');
      await expect(authenticatedPage).toHaveURL(/\/patients/);
      await sidebar.expectActiveLink('patients');
    });

    test('should navigate to appointments page', async ({ authenticatedPage }) => {
      const sidebar = new SidebarPage(authenticatedPage);
      await sidebar.clickLink('appointments');
      await expect(authenticatedPage).toHaveURL(/\/appointments/);
      await sidebar.expectActiveLink('appointments');
    });

    test('should navigate to calendar page', async ({ authenticatedPage }) => {
      const sidebar = new SidebarPage(authenticatedPage);
      await sidebar.clickLink('calendar');
      await expect(authenticatedPage).toHaveURL(/\/calendar/);
      await sidebar.expectActiveLink('calendar');
    });

    test('should navigate to reminders page', async ({ authenticatedPage }) => {
      const sidebar = new SidebarPage(authenticatedPage);
      await sidebar.clickLink('reminders');
      await expect(authenticatedPage).toHaveURL(/\/reminders/);
      await sidebar.expectActiveLink('reminders');
    });

    test('should navigate to medical records page', async ({ authenticatedPage }) => {
      const sidebar = new SidebarPage(authenticatedPage);
      await sidebar.clickLink('medical-records');
      await expect(authenticatedPage).toHaveURL(/\/medical-records/);
      await sidebar.expectActiveLink('medical-records');
    });

    test('should navigate to settings page', async ({ authenticatedPage }) => {
      const sidebar = new SidebarPage(authenticatedPage);
      await sidebar.clickLink('settings');
      await expect(authenticatedPage).toHaveURL(/\/settings/);
      await sidebar.expectActiveLink('settings');
    });

    test('should navigate back to dashboard', async ({ authenticatedPage }) => {
      const sidebar = new SidebarPage(authenticatedPage);
      await sidebar.clickLink('patients');
      await expect(authenticatedPage).toHaveURL(/\/patients/);
      await sidebar.clickLink('dashboard');
      await expect(authenticatedPage).toHaveURL(/\/dashboard/);
      await sidebar.expectActiveLink('dashboard');
    });

    test('should display user section', async ({ authenticatedPage }) => {
      const sidebar = new SidebarPage(authenticatedPage);
      await sidebar.expectUserSectionVisible();
    });

    test('should display logout button', async ({ authenticatedPage }) => {
      const sidebar = new SidebarPage(authenticatedPage);
      await sidebar.expectLogoutButtonVisible();
    });

    test('should not show hamburger button on desktop', async ({ authenticatedPage }) => {
      const sidebar = new SidebarPage(authenticatedPage);
      await expect(sidebar.hamburger).toBeHidden();
    });
  });

  test.describe('Mobile', () => {
    test.use({ viewport: { width: 375, height: 812 } });

    test('should hide sidebar by default', async ({ authenticatedPage }) => {
      const sidebar = new SidebarPage(authenticatedPage);
      await sidebar.expectHidden();
    });

    test('should show hamburger button', async ({ authenticatedPage }) => {
      const sidebar = new SidebarPage(authenticatedPage);
      await expect(sidebar.hamburger).toBeVisible();
    });

    test('should open sidebar via hamburger', async ({ authenticatedPage }) => {
      const sidebar = new SidebarPage(authenticatedPage);
      await sidebar.openOnMobile();
      await sidebar.expectNavVisible();
    });

    test('should close sidebar via backdrop click', async ({ authenticatedPage }) => {
      const sidebar = new SidebarPage(authenticatedPage);
      await sidebar.openOnMobile();
      await sidebar.closeOnMobile();
    });

    test('should close sidebar via Escape key', async ({ authenticatedPage }) => {
      const sidebar = new SidebarPage(authenticatedPage);
      await sidebar.openOnMobile();
      await sidebar.closeOnMobileViaEscape();
    });

    test('should close sidebar after clicking a nav link', async ({ authenticatedPage }) => {
      const sidebar = new SidebarPage(authenticatedPage);
      await sidebar.openOnMobile();
      await sidebar.clickLink('patients');
      await expect(authenticatedPage).toHaveURL(/\/patients/);
      await expect(sidebar.sidebar).not.toHaveClass(/sidebar--open/);
    });
  });
});
