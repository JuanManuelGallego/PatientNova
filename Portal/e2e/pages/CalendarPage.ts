import { BasePage } from './BasePage';
import { expect, Locator, Page } from '@playwright/test';
import { BlockedTimeModal } from './BlockedTimeModal';
import { AppointmentModal } from './AppointmentModal';

export class CalendarPage extends BasePage {
  readonly newAppointmentButton: Locator;
  readonly blockedTimeButton: Locator;
  readonly todayButton: Locator;
  readonly monthViewButton: Locator;
  readonly weekViewButton: Locator;
  readonly prevButton: Locator;
  readonly nextButton: Locator;

  constructor(page: Page) {
    super(page);
    this.newAppointmentButton = this.page.getByTestId('calendar-new-appointment-button');
    this.blockedTimeButton = this.page.getByTestId('calendar-block-time-button');
    this.todayButton = this.page.getByTestId('calendar-today-button');
    this.monthViewButton = this.page.getByTestId('calendar-view-month-button');
    this.weekViewButton = this.page.getByTestId('calendar-view-week-button');
    this.prevButton = this.page.getByTestId('calendar-nav-prev-button');
    this.nextButton = this.page.getByTestId('calendar-nav-next-button');
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
