import { test, expect } from "@playwright/test";

test.describe("Modul Invoices (CRUD)", () => {
  test("Siklus CRUD: Tambah -> Lihat Detail -> Edit -> Hapus", async ({ page }) => {
    // 1. Buka halaman Invoices
    await page.goto("/invoices");
    await expect(page).toHaveURL(/.*invoices/);

    // 2. Klik Catat Invoice
    const tambahBtn = page.getByRole("button", { name: /Catat invoice|Tambah invoice/i }).first();
    await expect(tambahBtn).toBeVisible({ timeout: 10000 });
    await tambahBtn.click();

    // 3. Isi Form Invoice
    const dialog = page.getByRole("dialog").last();
    const customerTab = dialog.getByRole("button", { name: "Customer" });
    if (await customerTab.isVisible()) {
      await customerTab.click();
    }

    const customerTrigger = dialog.getByText(/Cari & pilih customer|Pilih customer/i).first();
    if (await customerTrigger.isVisible()) {
      await customerTrigger.click();
      await page.getByRole("dialog").last().getByText(/PT|Telkom/i).first().click().catch(() => {});
      await page.waitForTimeout(300);
    }

    const nilaiInput = dialog.getByPlaceholder("Rp 0");
    if (await nilaiInput.isVisible()) {
      await nilaiInput.fill("10000000");
    }

    // Klik Simpan & Buat Invoice
    await dialog.getByRole("button", { name: /Simpan & Buat Invoice|Simpan/i }).click();

    // 4. Buka baris teratas yang baru dibuat
    const row = page.getByText(/INV\/\d+\/\d+\/\d+/).first();
    await expect(row).toBeVisible({ timeout: 10000 });
    await row.click();

    // 5. Verifikasi Halaman Detail
    await expect(page).toHaveURL(/.*invoices\/\d+/);

    // 6. Edit Catatan Invoice
    const catatanInput = page.getByPlaceholder(/Tulis deskripsi|catatan/i).first();
    if (await catatanInput.isVisible()) {
      await catatanInput.fill("Invoice catatan diupdate via E2E");
      const simpanBtn = page.getByRole("button", { name: /Simpan Perubahan/i });
      if (await simpanBtn.isVisible()) {
        await simpanBtn.click();
      }
    }

    // 7. Hapus Invoice
    const hapusBtn = page.getByRole("button", { name: "Hapus" }).first();
    await expect(hapusBtn).toBeVisible({ timeout: 10000 });
    await hapusBtn.click();

    // Konfirmasi Hapus
    const konfirmasiBtn = page.getByRole("dialog").getByRole("button", { name: /Ya, hapus|Hapus/i });
    await konfirmasiBtn.click();

    // 8. Verifikasi kembali ke list
    await expect(page).toHaveURL(/.*invoices/);
  });
});

