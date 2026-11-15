import { test, expect } from '../fixtures';
import { AuditLogsPage } from '../pages/AuditLogsPage';
import { uniqueEmail, randomString } from '../utils/test-data';

interface AuditRecord {
  id: string;
  entityId: string;
  description: string;
  actorDisplayName: string;
  actionType: string;
  entityType: string;
  source: string;
}

function auditEndpointMatches(url: string, params: Record<string, string>): boolean {
  if (!url.includes('/audit-logs')) return false;
  const sp = new URL(url).searchParams;
  return Object.entries(params).every(([k, v]) => sp.get(k) === v);
}

test.describe('Activity', () => {
  test('Filter by search, entity type, and action type', async ({ page, api, trackedPatients, trackedLocations }) => {
    const prefix = `AuditFlt-${Date.now().toString(36)}`;
    const patientName = `${prefix}-P`;
    const patient = await api.createPatient({ name: patientName, lastName: patientName, email: uniqueEmail() });
    trackedPatients.track(patient.data.id);

    const locName = `${prefix}-L`;
    const location = await api.createLocation({ name: locName, address: '1 Test St', instructions: randomString()  });
    trackedLocations.track(location.data.id);

    const locAudits = await api.getAuditLogs({ entityId: location.data.id });
    const locAuditId = (locAudits.data as unknown as AuditRecord[])[0]?.id;

    const auditPage = new AuditLogsPage(page);
    await auditPage.goToAuditLogs();

    const responsePromise = page.waitForResponse((r) =>
      auditEndpointMatches(r.url(), {
        entityType: 'PATIENT',
        actionType: 'CREATE',
        search: patientName,
      }),
    );

    await auditPage.search(patientName);
    await auditPage.selectEntityFilter('Paciente');
    await auditPage.selectActionFilter('Creación');

    const response = await responsePromise;
    expect(response.status()).toBe(200);

    await auditPage.expectRowVisibleByDescription(patientName);
    if (locAuditId) {
      await auditPage.expectRowNotVisible(locAuditId);
    }
  });

  test('Paginate across two pages', async ({ page, api, trackedPatients }) => {
    const prefix = `AuditPag-${Date.now().toString(36)}`;
    const names: string[] = [];
    for (let i = 0; i < 12; i++) {
      const name = `${prefix}-${String(i).padStart(2, '0')}`;
      names.push(name);
      const patient = await api.createPatient({ name, lastName: name, email: uniqueEmail() });
      trackedPatients.track(patient.data.id);
    }

    const auditPage = new AuditLogsPage(page);
    await auditPage.goToAuditLogs();

    await auditPage.search(prefix);
    await auditPage.selectEntityFilter('Paciente');
    // Register the waiter BEFORE the action that triggers the request (a fast API answers first).
    const filtered = page.waitForResponse((r) =>
      auditEndpointMatches(r.url(), {
        search: prefix,
        entityType: 'PATIENT',
        actionType: 'CREATE',
      }),
    );
    await auditPage.selectActionFilter('Creación');
    await filtered;

    const table = page.getByTestId('audit-table');
    await expect(table.locator('tbody tr')).toHaveCount(10);
    await expect(page.getByTestId('audit-pagination-count')).toContainText('de 12 registros');

    const nextPage = page.waitForResponse(
      (r) => r.url().includes('/audit-logs') && new URL(r.url()).searchParams.get('page') === '2',
    );
    await auditPage.goToNextPage();
    await nextPage;

    await expect(table.locator('tbody tr')).toHaveCount(2);
    // Oldest created (index 0) lands on page two due to desc ordering.
    await expect(table).toContainText(names[0]);
    // Newest created (index 11) is on page one, not page two.
    await expect(table).not.toContainText(names[11]);

    const prevPage = page.waitForResponse(
      (r) => r.url().includes('/audit-logs') && new URL(r.url()).searchParams.get('page') === '1',
    );
    await auditPage.goToPreviousPage();
    await prevPage;
    await expect(table.locator('tbody tr')).toHaveCount(10);
  });

  test('Open row drawer and verify details', async ({ page, api, trackedPatients }) => {
    const prefix = `AuditDrw-${Date.now().toString(36)}`;
    const patientName = `${prefix}-P`;
    const patient = await api.createPatient({ name: patientName, lastName: patientName, email: uniqueEmail() });
    trackedPatients.track(patient.data.id);

    const auditPage = new AuditLogsPage(page);
    await auditPage.goToAuditLogs();

    await auditPage.search(patientName);
    await auditPage.selectEntityFilter('Paciente');
    const filtered = page.waitForResponse(
      (r) => r.url().includes('/audit-logs')
        && new URL(r.url()).searchParams.get('search') === patientName
        && new URL(r.url()).searchParams.get('actionType') === 'CREATE',
    );
    await auditPage.selectActionFilter('Creación');
    await filtered;

    const drawer = await auditPage.openRowByDescription(patientName);
    await drawer.expectVisible();
    await drawer.expectAction('Creación');
    await drawer.expectEntityType('Paciente');
    await drawer.expectEntityId(patient.data.id);
    await drawer.expectSource('Tú');
    await drawer.close();
    await drawer.expectNotVisible();
  });
});
