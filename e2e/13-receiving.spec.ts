import { test, expect } from "@playwright/test";

test.describe("Modul Penerimaan Barang (Receiving)", () => {
  test("Buat Penerimaan Barang Baru, Cek Detail, dan Hapus", async ({ page }) => {
    // 1. Buka halaman Penerimaan
    await page.goto("/receiving");
    await expect(page).toHaveURL(/.*receiving/);

    // 2. Klik Terima Barang
    const createBtn = page.getByRole("button", { name: "Terima barang" }).first();
    await expect(createBtn).toBeVisible({ timeout: 10000 });
    await createBtn.click();

    // 3. Masuk ke halaman /receiving/new
    await expect(page).toHaveURL(/.*receiving\/new/);

    // If there is a serial number input textarea, fill it so it passes validation!
    const snTextarea = page.getByPlaceholder(/SN-/i).first();
    if (await snTextarea.isVisible()) {
      await snTextarea.fill(`SN-RCV-${Date.now()}`);
    }

    // Isi catatan kondisi jika ada
    const catatanInput = page.getByPlaceholder(/Kondisi kemasan|catatan/i).first();
    if (await catatanInput.isVisible()) {
      await catatanInput.fill("Kemasan rapi, barang utuh tidak ada cacat.");
    }

    // Klik Simpan Penerimaan & Masukkan ke Stok
    const submitBtn = page.getByRole("button", { name: /Simpan Penerimaan/i });
    await expect(submitBtn).toBeVisible();
    await submitBtn.click();

    // 4. Masuk ke daftar penerimaan barang
    await page.waitForTimeout(1000);
    await page.goto("/receiving");
    await expect(page).toHaveURL(/.*receiving$/);

    // 5. Buka detail penerimaan barang teratas
    const firstRow = page.getByText(/RCP\/\d+\/\d+\/\d+|RC\/\d+\/\d+\/\d+/).first();
    await expect(firstRow).toBeVisible({ timeout: 10000 });
    await firstRow.click();

    await expect(page).toHaveURL(/.*receiving\/\d+/);

    // 6. Hapus Data Penerimaan
    const hapusBtn = page.getByRole("button", { name: "Hapus" }).first();
    await expect(hapusBtn).toBeVisible({ timeout: 10000 });
    await hapusBtn.click();

    const konfirmasiBtn = page.getByRole("dialog").getByRole("button", { name: /Ya, hapus|Hapus/i });
    await konfirmasiBtn.click();

    await expect(page).toHaveURL(/.*receiving$/);
  });
});

