let counter = 0;

export function uniqueName(prefix = 'Test'): string {
  counter += 1;
  const ts = Date.now().toString(36);
  return `${prefix} ${ts}-${counter}`;
}

export function uniqueEmail(): string {
  counter += 1;
  const ts = Date.now().toString(36);
  return `test-${ts}-${counter}@patientnova-test.com`;
}

export function futureDateTime(hoursFromNow = 24): string {
  const d = new Date();
  d.setHours(d.getHours() + hoursFromNow);
  d.setMinutes(0, 0, 0);
  return d.toISOString();
}

export function futureDate(daysFromNow = 7): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(10, 0, 0, 0);
  return d.toISOString();
}

export function validE164Phone(): string {
  counter += 1;
  const suffix = String(1000000 + counter).slice(-7);
  return `+1${suffix}`;
}

export function uniquePassword(): string {
  return `Pass-${Date.now().toString(36)}!1`;
}
