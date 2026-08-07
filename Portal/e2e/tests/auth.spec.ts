import { test, expect } from "../fixtures";

test("Navigate to login page", async ({ authenticatedPage }) => {
  await expect(authenticatedPage).toHaveURL(/dashboard/);
});
