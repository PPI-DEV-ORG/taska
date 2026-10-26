import { test, expect } from "@playwright/test";

test.describe("Modul Penawaran (CRUD)", () => {
  test("Siklus CRUD: Tambah -> Lihat Detail -> Edit -> Hapus", async ({ page }) => {
    // 1. Buka halaman Penawaran
    await page.goto("/quotations");
    await expect(page).toHaveURL(/.*quotations/);

    // 2. Klik Buat Penawaran
    const createBtn = page.getByRole("button", { name: /Buat penawaran/i });
    await expect(createBtn).toBeVisible({ timeout: 10000 });
    await createBtn.click();

    // 3. Isi Form Penawaran
    const customerTrigger = page.getByText("Pilih customer", { exact: true });
    if (await customerTrigger.isVisible()) {
      await customerTrigger.click();
      await page.getByRole("dialog").last().getByText(/PT|Telkom/i).first().click();
      await page.waitForTimeout(300);
    }

    const nilaiInput = page.getByPlaceholder("Contoh: 10.000.000");
    await expect(nilaiInput).toBeVisible();
    await nilaiInput.fill("5000000");

    // Klik Simpan
    await page.getByRole("button", { name: "Simpan" }).click();

    // 4. Buka baris teratas (penawaran yang baru dibuat)
    const firstRow = page.getByText(/PNW\/\d+\/\d+\/\d+/).first();
    await expect(firstRow).toBeVisible({ timeout: 10000 });
    await firstRow.click();

    // 5. Verifikasi Halaman Detail
    await expect(page).toHaveURL(/.*quotations\/\d+/);
    await expect(page.getByText(/Rincian Nilai & Kalkulasi Penawaran/i)).toBeVisible({ timeout: 10000 });

    // 6. Edit Nilai / Diskon Penawaran jika input diskon ada
    const discInput = page.getByPlaceholder(/Contoh: 500\.000|Masukkan diskon/i).first();
    if (await discInput.isVisible()) {
      await discInput.fill("100000");
      const simpanBtn = page.getByRole("button", { name: /Simpan Perubahan/i });
      if (await simpanBtn.isVisible()) {
        await simpanBtn.click();
      }
    }

    // 7. Hapus Penawaran
    const hapusBtn = page.getByRole("button", { name: "Hapus" }).first();
    await expect(hapusBtn).toBeVisible({ timeout: 10000 });
    await hapusBtn.click();

    // Konfirmasi Hapus
    const konfirmasiBtn = page.getByRole("dialog").getByRole("button", { name: /Ya, hapus|Hapus/i });
    await konfirmasiBtn.click();

    // 8. Verifikasi kembali ke list
    await expect(page).toHaveURL(/.*quotations/);
  });
});

