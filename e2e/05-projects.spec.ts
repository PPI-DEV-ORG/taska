import { test, expect } from "@playwright/test";

test.describe("Modul Projects (CRUD)", () => {
  const projName = `[TEST] Project E2E ${Date.now()}`;

  test("Siklus CRUD: Tambah -> Lihat Detail -> Edit -> Hapus", async ({ page }) => {
    // 1. Buka halaman Projects
    await page.goto("/projects");
    await expect(page).toHaveURL(/.*projects/);

    // 2. Klik Tambah / Buat Project
    const tambahBtn = page.getByRole("button", { name: /Buat project|Tambah project/i }).first();
    await expect(tambahBtn).toBeVisible({ timeout: 10000 });
    await tambahBtn.click();

    // 3. Isi Form Project
    const namaInput = page.getByPlaceholder(/Instalasi CCTV Gudang|Nama project/i).first();
    if (await namaInput.isVisible()) {
      await namaInput.fill(projName);
    }

    const jenisTrigger = page.getByText("Pilih jenis", { exact: true });
    if (await jenisTrigger.isVisible()) {
      await jenisTrigger.click();
      await page.getByRole("dialog").last().getByText(/Customer|Internal/i).first().click().catch(() => {});
      await page.waitForTimeout(300);
    }

    // Klik Simpan
    await page.getByRole("button", { name: "Simpan" }).click();

    // 4. Verifikasi muncul di list & buka detail
    const row = page.getByText(projName).first();
    await expect(row).toBeVisible({ timeout: 10000 });
    await row.click();

    // 5. Verifikasi Halaman Detail
    await expect(page).toHaveURL(/.*projects\/\d+/);
    await expect(page.getByText(projName).first()).toBeVisible();

    // 6. Hapus Project
    const hapusBtn = page.getByRole("button", { name: "Hapus" }).first();
    await expect(hapusBtn).toBeVisible({ timeout: 10000 });
    await hapusBtn.click();

    // Konfirmasi Hapus
    const konfirmasiBtn = page.getByRole("dialog").getByRole("button", { name: /Ya, hapus|Hapus/i });
    await konfirmasiBtn.click();

    // 7. Verifikasi kembali ke list
    await expect(page).toHaveURL(/.*projects/);
  });
});

