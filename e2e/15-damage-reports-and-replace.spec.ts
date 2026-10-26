import { test, expect } from "@playwright/test";

test.describe("Modul Kerusakan & Retur (Damage Reports & Replace)", () => {
  const keterangan = `[TEST] Kamera CCTV Lensa Pecah ${Date.now()}`;

  test("Catat Kerusakan/Retur, Terima Barang Pengganti, dan Hapus", async ({ page }) => {
    // 1. Buka halaman Kerusakan & Retur
    await page.goto("/damage-reports");
    await expect(page).toHaveURL(/.*damage-reports/);

    // 2. Klik Catat Kerusakan / Retur
    const createBtn = page.getByRole("button", { name: "Catat kerusakan / retur" }).first();
    await expect(createBtn).toBeVisible({ timeout: 10000 });
    await createBtn.click();

    // 3. Isi Form di Modal
    const dialog = page.getByRole("dialog").first();
    await expect(dialog).toBeVisible();

    // Pilih Barang
    const barangTrigger = dialog.getByText(/Pilih barang/i).first();
    if (await barangTrigger.isVisible()) {
      await barangTrigger.click();
      await page.getByRole("dialog").last().getByText(/Kamera|Kabel|UNV|IMP|DS-/i).first().click().catch(() => {});
      await page.waitForTimeout(300);
    }

    // Pilih Jenis Retur / Kerusakan
    const jenisTrigger = dialog.getByText(/Pilih jenis/i).first();
    if (await jenisTrigger.isVisible()) {
      await jenisTrigger.click();
      await page.getByRole("dialog").last().getByText("Rusak").first().click().catch(() => {});
      await page.waitForTimeout(300);
    }

    // Isi Keterangan
    const ketInput = dialog.locator("textarea").first();
    await ketInput.fill(keterangan);

    // Simpan Laporan Kerusakan
    await dialog.getByRole("button", { name: "Simpan" }).click();
    await expect(dialog).not.toBeVisible({ timeout: 10000 });

    // 4. Buka baris laporan teratas via chevron aksi
    const chevronBtn = page.locator("button:has(svg.lucide-chevron-right)").first();
    await expect(chevronBtn).toBeVisible({ timeout: 10000 });
    await chevronBtn.click();

    await expect(page).toHaveURL(/.*damage-reports\/\d+/);

    // 5. Test Alur Terima Barang Pengganti (Replace Unit)
    const terimaPenggantiBtn = page.getByRole("button", { name: "Terima Barang Pengganti" });
    if (await terimaPenggantiBtn.isVisible()) {
      await terimaPenggantiBtn.click();
      const replaceDialog = page.getByRole("dialog").last();
      await expect(replaceDialog).toBeVisible();

      const snPenggantiInput = replaceDialog.getByPlaceholder(/Scan barcode|SN baru/i).first();
      if (await snPenggantiInput.isVisible()) {
        await snPenggantiInput.fill(`SN-RPL-${Date.now()}`);
      }

      // Klik Simpan & Tambah ke Stok
      const simpanReplaceBtn = replaceDialog.getByRole("button", { name: /Simpan & Tambah ke Stok/i });
      await expect(simpanReplaceBtn).toBeVisible();
      await simpanReplaceBtn.click();

      // Tunggu dialog tertutup
      await expect(replaceDialog).not.toBeVisible({ timeout: 10000 });
    }

    // 6. Hapus Laporan Kerusakan
    const hapusBtn = page.getByRole("button", { name: "Hapus" }).first();
    await expect(hapusBtn).toBeVisible({ timeout: 10000 });
    await hapusBtn.click();

    const konfirmasiBtn = page.getByRole("dialog").getByRole("button", { name: /Ya, hapus|Hapus/i });
    await konfirmasiBtn.click();

    await expect(page).toHaveURL(/.*damage-reports$/);
  });
});

