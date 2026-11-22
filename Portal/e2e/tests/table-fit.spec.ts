import { test, expect } from '../fixtures';
import { createTestPatient, createTestAppointment, createTestReminder } from '../utils/helpers';

// Every list table behaves the same: under 1100px its secondary columns hide instead of scrolling sideways.
const PAGES = [
  { name: 'Citas', path: '/appointments', hasActions: true, settleReminder: true },
  { name: 'Pacientes', path: '/patients', hasActions: true, settleReminder: true },
  { name: 'Recordatorios (activos)', path: '/reminders', hasActions: true, settleReminder: false },
  { name: 'Recordatorios (historial)', path: '/reminders?activeTab=History', hasActions: true, settleReminder: true },
  { name: 'Actividad', path: '/activity', hasActions: false, settleReminder: true },
];

test.describe('List tables fit at 1280px', () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  for (const { name, path, hasActions, settleReminder } of PAGES) {
    test(`${name} table fits without sideways scrolling`, async ({ page, api, trackedPatients, trackedAppointments, trackedReminders }) => {
      const longName = 'Patient With A Remarkably Long Full Name For Table Fit';
      const patient = await createTestPatient(api, {
        name: longName,
        lastName: 'Apellido Extremadamente Largo Para Medir',
        email: `long-address-for-table-fit-${Date.now().toString(36)}@patientnova-test.com`,
      });
      trackedPatients.track(patient.id);
      const appt = await createTestAppointment(api, patient.id);
      trackedAppointments.track(appt.data.id);
      const reminder = await createTestReminder(api, patient.id);
      trackedReminders.track(reminder.data.id);
      // A settled reminder fills the History tab; the Activos tab needs it still pending.
      if (settleReminder) await api.cancelReminder(reminder.data.id);

      await page.goto(path);
      const table = page.locator('table').first();
      const dataRow = table.locator('tbody tr.table-row').first();
      await expect(dataRow).toBeVisible();

      const m = await table.evaluate((el) => {
        const ths = Array.from(el.querySelectorAll('thead th')) as HTMLElement[];
        const visible = ths.filter((th) => getComputedStyle(th).display !== 'none');
        const rects = visible.map((th) => ({
          label: th.textContent?.trim() ?? '',
          left: th.getBoundingClientRect().left,
          right: th.getBoundingClientRect().right,
          actions: th.classList.contains('col--actions'),
        }));
        return {
          scrollWidth: el.scrollWidth,
          clientWidth: (el.parentElement as HTMLElement).clientWidth,
          rects,
        };
      });
      expect(m.scrollWidth).toBeLessThanOrEqual(m.clientWidth);
      expect(m.rects.some((r) => r.actions), 'actions column header present').toBe(hasActions);

      const actions = m.rects.find((r) => r.actions);
      for (const r of m.rects) {
        expect(r.right, `${r.label} inside viewport`).toBeLessThanOrEqual(1280);
        if (actions && r !== actions) {
          expect(r.right, `${r.label} must not overlap actions`).toBeLessThanOrEqual(actions.left + 0.5);
        }
      }
      if (name === 'Citas') {
        const labels = m.rects.map((r) => r.label);
        expect(labels.join('|')).toContain('Estado');
        expect(labels.join('|')).toContain('Pago');
      }
    });
  }
});
