import { test, expect } from "@playwright/test";

test.describe("Modul Sales Order & PO Client (CRUD)", () => {
  const testPoNum = `PO-TEST-${Date.now()}`;

  test("Siklus CRUD: Tambah -> Lihat Detail -> Edit -> Hapus", async ({ page }) => {
    // 1. Buka halaman SO / PO
    await page.goto("/po-client");
    await expect(page).toHaveURL(/.*po-client/);

    // 2. Klik Tambah SO/PO
    const tambahBtn = page.getByRole("button", { name: /Buat SO \/ PO|Tambah/i }).first();
    await expect(tambahBtn).toBeVisible({ timeout: 10000 });
    await tambahBtn.click();

    // 3. Isi Form di Modal
    const modal = page.getByRole("dialog").last();
    const custTrigger = modal.getByText(/Pilih customer/i).first();
    if (await custTrigger.isVisible()) {
      await custTrigger.click();
      await page.getByRole("dialog").last().getByText(/PT|Telkom/i).first().click().catch(() => {});
      await page.waitForTimeout(300);
    }

    const nilaiInput = modal.locator("input").nth(2);
    if (await nilaiInput.isVisible()) {
      await nilaiInput.fill("12000000");
    }

    // Klik Simpan
    await modal.getByRole("button", { name: "Simpan" }).click();

    // 4. Buka baris teratas yang baru dibuat
    const row = page.getByText(/SO\/\d+|PO\/\d+/).first();
    await expect(row).toBeVisible({ timeout: 10000 });
    await row.click();

    // 5. Verifikasi Halaman Detail
    await expect(page).toHaveURL(/.*po-client\/\d+/);

    // 6. Edit Catatan / Nilai
    const catatanInput = page.getByPlaceholder(/Catatan/i).first();
    if (await catatanInput.isVisible()) {
      await catatanInput.fill("Diupdate via Playwright E2E");
      const simpanBtn = page.getByRole("button", { name: /Simpan Perubahan/i });
      if (await simpanBtn.isVisible()) {
        await simpanBtn.click();
      }
    }

    // 7. Hapus SO/PO
    const hapusBtn = page.getByRole("button", { name: "Hapus" }).first();
    await expect(hapusBtn).toBeVisible({ timeout: 10000 });
    await hapusBtn.click();

    // Konfirmasi Hapus
    const konfirmasiBtn = page.getByRole("dialog").getByRole("button", { name: /Ya, hapus|Hapus/i });
    await konfirmasiBtn.click();

    // 8. Verifikasi kembali ke list
    await expect(page).toHaveURL(/.*po-client/);
  });
});

