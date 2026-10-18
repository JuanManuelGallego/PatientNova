import { e164Regex, emailRegex } from "../utils/validation/middleware";

// Values are not echoed: a malformed number or address escapes the PII masking of logs and error tracking.
export function validateE164(phone: string): void {
    if (!e164Regex.test(phone)) {
        throw new Error('Invalid phone number. Must be E.164 format, e.g. +15551234567');
    }
}

export function validateEmail(email: string): void {
    if (!emailRegex.test(email)) {
        throw new Error('Invalid email address');
    }
}
