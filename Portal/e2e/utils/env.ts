import { config } from 'dotenv-safe';

if (!process.env.CI) {
    config({ path: 'e2e/.env', example: 'e2e/.env.example', allowEmptyValues: true });
}

export const Env = {
    baseUrl: process.env.PLAYWRIGHT_BASE_URL as string,
    apiBaseUrl: process.env.API_BASE_URL as string,
    testUserEmail: process.env.TEST_USER_EMAIL as string,
    testUserPassword: process.env.TEST_USER_PASSWORD as string,
    vercelAutomationBypassSecret: process.env.VERCEL_AUTOMATION_BYPASS_SECRET as string,
    apptTypeName: process.env.APPT_TYPE_NAME as string,
    apptTypeId: process.env.APPT_TYPE_ID as string,
    locationName: process.env.LOCATION_NAME as string,
    locationId: process.env.LOCATION_ID as string,
}