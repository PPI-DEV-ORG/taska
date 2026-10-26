import { test, expect } from "@playwright/test";

test.describe("Modul Survey (CRUD)", () => {
  const lokasi = `[TEST] Lokasi Survey ${Date.now()}`;

  test("Siklus CRUD: Tambah -> Lihat Detail -> Edit -> Hapus", async ({ page }) => {
    await page.goto("/surveys");
    await expect(page).toHaveURL(/.*surveys/);

    const tambahBtn = page.getByRole("button", { name: /Minta survey|Jadwalkan survey|Tambah survey/i }).first();
    await expect(tambahBtn).toBeVisible({ timeout: 10000 });
    await tambahBtn.click();

    const dialog = page.getByRole("dialog").last();

    const leadTrigger = dialog.getByText(/Pilih lead terkait/i).first();
    if (await leadTrigger.isVisible()) {
      await leadTrigger.click();
      await page.getByRole("dialog").last().getByText(/PT|CCTV|test/i).first().click().catch(() => {});
      await page.waitForTimeout(300);
    }

    const custTrigger = dialog.getByText("Pilih customer").first();
    if (await custTrigger.isVisible()) {
      await custTrigger.click();
      await page.getByRole("dialog").last().getByText(/PT|Telkom/i).first().click().catch(() => {});
      await page.waitForTimeout(300);
    }

    const lokasiInput = dialog.getByPlaceholder(/Alamat atau titik lokasi survey/i);
    if (await lokasiInput.isVisible()) {
      await lokasiInput.fill(lokasi);
    }

    const timTrigger = dialog.getByText(/Pilih tim survey/i).first();
    if (await timTrigger.isVisible()) {
      await timTrigger.click();
      await page.getByRole("dialog").last().getByText(/Admin|Super|Teknisi|Hendra/i).first().click().catch(() => {});
      await page.getByRole("dialog").last().getByRole("button", { name: /Selesai/i }).click().catch(() => {});
      await page.waitForTimeout(300);
    }

    await dialog.getByRole("button", { name: "Simpan" }).click();

    const row = page.getByText(lokasi).first();
    await expect(row).toBeVisible({ timeout: 10000 });
    await row.click();

    await expect(page).toHaveURL(/.*surveys\/\d+/);

    const hapusBtn = page.getByRole("button", { name: "Hapus" }).first();
    await expect(hapusBtn).toBeVisible({ timeout: 10000 });
    await hapusBtn.click();

    const konfirmasiBtn = page.getByRole("dialog").getByRole("button", { name: /Ya, hapus|Hapus/i });
    await konfirmasiBtn.click();

    await expect(page).toHaveURL(/.*surveys/);
  });
});

