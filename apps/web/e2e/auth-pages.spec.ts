import { expect, test } from "@playwright/test";

test.describe("authentication pages", () => {
  test("renders auth-only pages", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await expect(page.getByLabel("Tenant slug")).toBeVisible();

    await page.goto("/forgot-password");
    await expect(page.getByRole("heading", { name: "Forgot password" })).toBeVisible();

    await page.goto("/reset-password");
    await expect(page.getByRole("heading", { name: "Reset password" })).toBeVisible();

    await page.goto("/email-verification");
    await expect(page.getByRole("heading", { name: "Verify email" })).toBeVisible();

    await page.goto("/profile");
    await expect(page.getByRole("heading", { name: "Profile" })).toBeVisible();
    await expect(page.getByText("Dashboard")).toHaveCount(0);
    await expect(page.getByText("Tickets")).toHaveCount(0);
  });
});
