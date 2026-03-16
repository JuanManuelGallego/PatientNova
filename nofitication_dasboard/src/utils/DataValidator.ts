export function validateEmail(email: string) {
    const regex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return regex.test(email);
}

export function validatePhoneNumber(phone: string) {
    const e164Regex = /^\+[1-9]\d{1,14}$/;
    return e164Regex.test(phone);
}