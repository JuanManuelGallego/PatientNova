import { BasePage } from './BasePage';
import { expect, Locator, Page } from '@playwright/test';
import { BlockedTimeModal } from './Modals/BlockedTimeModal';
import { AppointmentModal } from './Modals/AppointmentModal';
import { AppointmentDrawer } from './Drawers/AppointmentDrawer';

export class CalendarPage extends BasePage {
  readonly newAppointmentButton: Locator;
  readonly blockedTimeButton: Locator;
  readonly todayButton: Locator;
  readonly monthViewButton: Locator;
  readonly weekViewButton: Locator;
  readonly prevButton: Locator;
  readonly nextButton: Locator;
  readonly calendarGrid: Locator;

  constructor(page: Page) {
    super(page);
    this.newAppointmentButton = this.page.getByTestId('calendar-new-appointment-button');
    this.blockedTimeButton = this.page.getByTestId('calendar-block-time-button');
    this.todayButton = this.page.getByTestId('calendar-today-button');
    this.monthViewButton = this.page.getByTestId('calendar-view-month-button');
    this.weekViewButton = this.page.getByTestId('calendar-view-week-button');
    this.prevButton = this.page.getByTestId('calendar-nav-prev-button');
    this.nextButton = this.page.getByTestId('calendar-nav-next-button');
    this.calendarGrid = this.page.locator('.cal-grid');
  }

  eventChip(id: string): Locator {
    return this.page.getByTestId(`calendar-event-${id}`);
  }

  blockedTimeChip(id: string): Locator {
    return this.page.getByTestId(`calendar-blocked-${id}`);
  }

  calendarCell(date: string): Locator {
    return this.page.getByTestId(`calendar-cell-${date}`);
  }

  async openBlockedTimeModal() {
    await this.blockedTimeButton.click();
    const modal = new BlockedTimeModal(this.page);
    await modal.waitForOpen();
    return modal;
  }

  async openAppointmentModal() {
    await this.newAppointmentButton.click();
    const modal = new AppointmentModal(this.page);
    await modal.waitForOpen();
    return modal;
  }

  async openEventDrawer(id: string) {
    await this.goToChipWeek(id);
    await this.eventChip(id).click();
    const drawer = new AppointmentDrawer(this.page);
    await drawer.waitForOpen();
    return drawer;
  }

  async openBlockedTimeEditModal(description: string) {
    const titleLocator = this.page.getByTitle(description);
    if (!(await titleLocator.isVisible())) {
      await this.goToWeekWith(() => titleLocator.isVisible());
    }
    await titleLocator.click();
    const modal = new BlockedTimeModal(this.page);
    await modal.waitForOpen();
    return modal;
  }

  private async waitForCalendarData() {
    await this.page
      .waitForResponse(
        (r) =>
          r.url().includes('/appointments') || r.url().includes('/blocked-time'),
        { timeout: 10000 },
      )
      .catch(() => {});
  }

  private async waitForVisible(
    locator: Locator,
    timeout = 5000,
  ): Promise<boolean> {
    return locator
      .waitFor({ state: 'visible', timeout })
      .then(() => true)
      .catch(() => false);
  }

  private async goToWeekWith(isFound: (timeout: number) => Promise<boolean>) {
    for (let i = 0; i < 6; i++) {
      await this.goToNext();
      await this.waitForCalendarData();
      if (await isFound(5000)) return;
    }
  }

  async goToChipWeek(id: string) {
    const eventLocator = this.eventChip(id);
    const blockedLocator = this.blockedTimeChip(id);
    const chipOnCurrentWeek = async (timeout: number) =>
      (await this.waitForVisible(eventLocator, timeout)) ||
      (await this.waitForVisible(blockedLocator, timeout));
    if (await chipOnCurrentWeek(5000)) return;
    await this.goToWeekWith(chipOnCurrentWeek);
  }

  async expectEventVisible(id: string) {
    await this.goToChipWeek(id);
    await expect(this.eventChip(id)).toBeVisible();
  }

  async expectBlockedTimeVisible(id: string) {
    await this.goToChipWeek(id);
    await expect(this.blockedTimeChip(id)).toBeVisible();
  }

  async goToToday() {
    await this.todayButton.click();
  }

  async goToPrev() {
    await this.prevButton.click();
  }

  async goToNext() {
    await this.nextButton.click();
  }

  async switchToMonth() {
    await this.monthViewButton.click();
  }

  async switchToWeek() {
    await this.weekViewButton.click();
  }
}
