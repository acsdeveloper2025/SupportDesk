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
  });

  test("root redirects to login and profile requires auth", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);

    await page.goto("/profile");
    await expect(page).toHaveURL(/\/login\?redirectTo=%2Fprofile/);
  });

  test("login form submits with tenant slug and no console errors", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => consoleErrors.push(err.message));

    await page.goto("/login");
    await page.getByLabel("Email").fill("user@acme.com");
    await page.getByLabel("Password").fill("Password123!");
    await page.getByLabel("Tenant slug").fill("acme");
    await page.getByRole("button", { name: /sign in/i }).click();

    await expect(page).toHaveURL(/\/dashboard|\/tickets|\/profile/, { timeout: 15000 });
    expect(consoleErrors).toEqual([]);
  });
});
