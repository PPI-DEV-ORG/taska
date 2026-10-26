import { test, expect } from "@playwright/test";

test.describe("Modul Master Customer (CRUD)", () => {
  const custName = `[TEST] PT Customer Uji ${Date.now()}`;

  test("Siklus CRUD: Tambah -> Lihat Detail -> Edit -> Hapus", async ({ page }) => {
    await page.goto("/customers");
    await expect(page).toHaveURL(/.*customers/);

    const tambahBtn = page.getByRole("button", { name: /Tambah customer/i }).first();
    await expect(tambahBtn).toBeVisible({ timeout: 10000 });
    await tambahBtn.click();

    const inputs = page.getByRole("dialog").locator("input");
    await inputs.nth(0).fill(custName);
    await inputs.nth(1).fill("Jakarta");
    await inputs.nth(2).fill("Bpk Penguji");

    await page.getByRole("button", { name: "Simpan" }).click();

    const row = page.getByText(custName).first();
    await expect(row).toBeVisible({ timeout: 10000 });
    await row.click();

    await expect(page).toHaveURL(/.*customers\/\d+/);

    const hapusBtn = page.getByRole("button", { name: "Hapus" }).first();
    await expect(hapusBtn).toBeVisible({ timeout: 10000 });
    await hapusBtn.click();

    const konfirmasiBtn = page.getByRole("dialog").getByRole("button", { name: /Ya, hapus|Hapus/i });
    await konfirmasiBtn.click();

    await expect(page).toHaveURL(/.*customers/);
  });
});

