import { test, expect } from '../fixtures';
import { CalendarPage } from '../pages/CalendarPage';
import { Routes, HttpMethods } from '../utils/const';
import { uniqueName, futureBusinessHourDateTime, addHours } from '../utils/test-data';
import {
  createTestPatient,
  createTestAppointment,
  createTestBlockedTime,
} from '../utils/helpers';
import { Env } from '../utils/env';
import { EntityType } from '@/src/types/AuditLog';

test.describe('Calendar', () => {
  test('Create appointment from calendar', async ({
    page,
    api,
    trackedAppointments,
    trackedPatients,
  }) => {
    const patient = await createTestPatient(api);
    trackedPatients.track(patient.id);

    await page.goto(Routes.CALENDAR);

    const calendar = new CalendarPage(page);
    const modal = await calendar.openAppointmentModal();

    const appointmentId = await modal.createAppointment({
      patientName: patient.name,
      typeName: Env.apptTypeName,
      locationName: Env.locationName,
    });
    trackedAppointments.track(appointmentId);

    await expect(calendar.eventChip(appointmentId)).toBeVisible();
  });

  test('Create blocked time', async ({ page, trackedBlockedTime }) => {
    const description = uniqueName(EntityType.BLOCKED_TIME);
    const startTimeUtc = futureBusinessHourDateTime();
    const endTimeUtc = addHours(startTimeUtc, 1);

    await page.goto(Routes.CALENDAR);

    const calendar = new CalendarPage(page);
    const modal = await calendar.openBlockedTimeModal();

    const id = await modal.createBlockedTime({
      description,
      startTimeUtc,
      endTimeUtc,
    });
    trackedBlockedTime.track(id);

    await expect(calendar.blockedTimeChip(id)).toBeVisible();
  });

  test('Edit blocked time', async ({ page, api, trackedBlockedTime }) => {
    const description = uniqueName(EntityType.BLOCKED_TIME);
    const startTimeUtc = futureBusinessHourDateTime();
    const endTimeUtc = addHours(startTimeUtc, 1);
    const blockedTime = await createTestBlockedTime(api, {
      description,
      startTimeUtc,
      endTimeUtc,
    });
    trackedBlockedTime.track(blockedTime.data.id);

    await page.goto(Routes.CALENDAR);

    const calendar = new CalendarPage(page);
    const modal = await calendar.openBlockedTimeEditModal(description);

    const updatedDescription = uniqueName(EntityType.BLOCKED_TIME);
    const result = await modal.editBlockedTime({ description: updatedDescription });

    expect(result.id).toBe(blockedTime.data.id);
    expect(result.description).toBe(updatedDescription);

    await expect(calendar.blockedTimeChip(blockedTime.data.id)).toBeVisible();
    await expect(page.getByTitle(updatedDescription)).toBeVisible();

    const fetched = await api.getBlockedTime(blockedTime.data.id);
    expect(fetched.data.id).toBe(blockedTime.data.id);
    expect(fetched.data.description).toBe(updatedDescription);
    expect(fetched.data.isDeleted).toBe(false);
  });

  test('Delete blocked time', async ({ page, api, trackedBlockedTime }) => {
    const description = uniqueName(EntityType.BLOCKED_TIME);
    const startTimeUtc = futureBusinessHourDateTime();
    const endTimeUtc = addHours(startTimeUtc, 1);
    const blockedTime = await createTestBlockedTime(api, {
      description,
      startTimeUtc,
      endTimeUtc,
    });
    trackedBlockedTime.track(blockedTime.data.id);

    await page.goto(Routes.CALENDAR);

    const calendar = new CalendarPage(page);
    const modal = await calendar.openBlockedTimeEditModal(description);
    await modal.deleteBlockedTime();

    await expect(calendar.blockedTimeChip(blockedTime.data.id)).not.toBeVisible();

    const fetched = await api.getBlockedTime(blockedTime.data.id);
    expect(fetched.data.isDeleted).toBe(true);
    expect(fetched.data.deletedAt).toBeTruthy();
  });

  test('Open appointment drawer from calendar event', async ({
    page,
    api,
    trackedAppointments,
    trackedPatients,
  }) => {
    const patient = await createTestPatient(api);
    trackedPatients.track(patient.id);
    const startTimeUtc = futureBusinessHourDateTime();
    const endTimeUtc = addHours(startTimeUtc, 1);

    const appointment = await createTestAppointment(api, patient.id, {
      locationId: Env.locationId,
      typeId: Env.apptTypeId,
      startAt: startTimeUtc,
      endAt: endTimeUtc
    });
    trackedAppointments.track(appointment.data.id);

    await page.goto(Routes.CALENDAR);

    const calendar = new CalendarPage(page);
    const drawer = await calendar.openEventDrawer(appointment.data.id);
    await expect(drawer.panel).toBeVisible();
    await expect(drawer.patientName).toContainText(patient.name);
    await drawer.close();
  });
});
