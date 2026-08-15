export function uniqueName(prefix = 'Test'): string {
  const ts = Date.now().toString(36);
  return `${prefix} ${ts}`;
}

export function uniqueEmail(): string {
  const ts = Date.now().toString(36);
  return `test-${ts}@patientnova-test.com`;
}

export function uniquePhoneNumber(): string {
  const digits = (1000000 + randomNumber() * 7919) % 10000000;
  return `+1555${digits.toString().padStart(7, '0')}`;
}

export function randomString(length: number = 10) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length }, () => chars[ Math.floor(Math.random() * chars.length) ]).join('');
}

export function randomNumber(): number {
  return Math.floor(Math.random() * 10000) + 1;
}

export function futureDateTime(hoursFromNow = 24): string {
  const d = new Date();
  d.setHours(d.getHours() + hoursFromNow);
  d.setMinutes(0, 0, 0);
  return d.toISOString();
}

export function futureBusinessHourDateTime(daysFromNow = 1): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  const hour = 8 + Math.floor(Math.random() * 12);
  d.setUTCHours(hour, 0, 0, 0);
  return d.toISOString();
}

export function addHours(iso: string, hours: number): string {
  const d = new Date(iso);
  d.setUTCHours(d.getUTCHours() + hours);
  return d.toISOString();
}

export function futureDate(daysFromNow = 7): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(10, 0, 0, 0);
  return d.toISOString();
}

export function validE164Phone(): string {
  const suffix = String(1000000 + randomNumber()).slice(-7);
  return `+1${suffix}`;
}

export function uniquePassword(): string {
  return `Pass-${Date.now().toString(36)}!1`;
}
