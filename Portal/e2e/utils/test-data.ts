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

export function uniquePhoneNumber(): string {
  counter += 1;
  const digits = (1000000 + counter * 7919) % 10000000;
  return `+1555${digits.toString().padStart(7, '0')}`;
}

export function randomString(length: number = 10) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length }, () => chars[ Math.floor(Math.random() * chars.length) ]).join('');
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
