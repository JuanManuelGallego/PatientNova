import { e164Regex } from "../utils/validation";

export function validateE164(phone: string): void {
    if (!e164Regex.test(phone)) {
        throw new Error(
            `Invalid phone number "${phone}". Must be E.164 format, e.g. +15551234567`
        );
    }
}