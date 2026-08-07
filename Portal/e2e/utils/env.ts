import { config } from 'dotenv-safe';

config({ path: 'e2e/.env', example: 'e2e/.env.example', allowEmptyValues: true });

export const Env = {
    baseUrl: process.env.PLAYWRIGHT_BASE_URL as string,
    testUserEmail: process.env.TEST_USER_EMAIL as string,
    testUserPassword: process.env.TEST_USER_PASSWORD as string,
    vercelAutomationBypassSecret: process.env.VERCEL_AUTOMATION_BYPASS_SECRET as string,
}