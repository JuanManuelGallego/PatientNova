import { test, expect, Page } from "@playwright/test";
import { setup } from "../utils/setup";

let page:Page;

test.describe('Authentication', () => {
  test.beforeAll(async ({browser}) => {
    page = await browser.newPage();
    setup(page);
  });
  
  test('Navigate to login page', async () => {
    await expect(page).toHaveURL(/dashboard/);
  });
});
