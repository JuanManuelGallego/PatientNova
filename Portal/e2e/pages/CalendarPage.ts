import { BasePage } from './BasePage';
import { expect, Page } from '@playwright/test';
import { BlockedTimeModal } from './BlockedTimeModal';
import { AppointmentModal } from './AppointmentModal';

export class CalendarPage extends BasePage {
  readonly newAppointmentButton = this.page.getByRole('button', { name: 'Nueva Cita' });
  readonly blockedTimeButton = this.page.getByRole('button', { name: 'Bloquear Horario' });
  readonly todayButton = this.page.getByRole('button', { name: 'Hoy' });
  readonly monthViewButton = this.page.getByRole('button', { name: 'Mes' });
  readonly weekViewButton = this.page.getByRole('button', { name: 'Semana' });
  readonly prevButton = this.page.locator('.calendar-toolbar .btn-secondary').first();
  readonly nextButton = this.page.locator('.calendar-toolbar .btn-secondary').last();

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
