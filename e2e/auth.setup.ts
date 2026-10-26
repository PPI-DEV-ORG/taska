import { test as setup, expect } from "@playwright/test";
import path from "path";
import fs from "fs";

const authFile = path.resolve(__dirname, ".auth/user.json");

setup("authenticate as superadmin", async ({ page }) => {
  const email = process.env.TEST_ADMIN_EMAIL;
  const password = process.env.TEST_ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "TEST_ADMIN_EMAIL dan TEST_ADMIN_PASSWORD harus didefinisikan di .env.test"
    );
  }

  // Ensure .auth directory exists
  const authDir = path.dirname(authFile);
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  await page.goto("/login");
  // Wait for React Native Web application to mount and hydrate
  const emailInput = page.getByPlaceholder("nama@taska.co.id");
  const passInput = page.getByPlaceholder("Masukkan kata sandi");
  await emailInput.waitFor({ state: "visible" });
  await page.waitForTimeout(1000);

  // Fill credentials
  await emailInput.click();
  await emailInput.fill(email);

  await passInput.click();
  await passInput.fill(password);

  await page.getByRole("button", { name: "Masuk" }).click();

  // Verify successful redirection to dashboard or presence of main nav
  await expect(page).toHaveURL(/.*dashboard.*/, { timeout: 15000 });

  // Save authenticated state (localStorage + cookies)
  await page.context().storageState({ path: authFile });
});

