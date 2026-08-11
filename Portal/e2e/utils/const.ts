export enum Routes {
    PATIENTS = '/patients',
    APPOINTMENTS = '/appointments',
    REMINDERS = '/reminders',
    DASHBOARD = '/dashboard',
    LOGIN = '/login',
    CALENDAR = '/calendar',
    MEDICAL_RECORDS = '/medical-records',
    SETTINGS = '/settings',
}

export enum EntityTypes {
    PATIENT = 'Patient',
    MEDICAL_RECORD = 'MedicalRecord',
    APPOINTMENT = 'Appointment',
    REMINDER = 'Reminder',
}

export enum HttpMethods {
    GET = 'GET',
    POST = 'POST',
    PUT = 'PUT',
    PATCH = 'PATCH',
    DELETE = 'DELETE',
}

export const APPT_TYPE_PRICE = '100000'