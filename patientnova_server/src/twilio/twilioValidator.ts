export function validateE164(phone: string): void {
    const e164 = /^\+[1-9]\d{7,14}$/;
    if (!e164.test(phone)) {
        throw new Error(
            `Invalid phone number "${phone}". Must be E.164 format, e.g. +15551234567`
        );
    }
}