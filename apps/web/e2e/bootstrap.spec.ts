import { expect, test } from "@playwright/test";

test("renders the bootstrap landing page", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "SupportDesk" })).toBeVisible();
  await expect(page.getByText("Enterprise Ticketing Platform")).toBeVisible();
  await expect(page.getByText("Project Successfully Bootstrapped")).toBeVisible();
});
