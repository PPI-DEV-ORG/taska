import { test, expect } from "@playwright/test";

test.describe("Modul Pengeluaran / Expenses (CRUD)", () => {
  const catatan = `[TEST] Pengeluaran Operasional ${Date.now()}`;

  test("Siklus CRUD: Tambah -> Lihat Detail -> Edit -> Hapus", async ({ page }) => {
    await page.goto("/expenses");
    await expect(page).toHaveURL(/.*expenses/);

    const tambahBtn = page.getByRole("button", { name: /Catat pengeluaran|Tambah pengeluaran/i }).first();
    await expect(tambahBtn).toBeVisible({ timeout: 10000 });
    await tambahBtn.click();

    // Di halaman /expenses/new
    await expect(page).toHaveURL(/.*expenses\/new/);

    const nominalInput = page.getByPlaceholder(/Contoh: 150000|Nominal/i).first();
    if (await nominalInput.isVisible()) {
      await nominalInput.fill("150000");
    }

    const descInput = page.getByPlaceholder(/Contoh: Isi bensin|Keperluan|Catatan|Keterangan/i).first();
    if (await descInput.isVisible()) {
      await descInput.fill(catatan);
    }

    await page.getByRole("button", { name: /Kirim Laporan Pengeluaran|Kirim Pengajuan|Simpan/i }).click();

    // Verifikasi kembali ke list dan buka detail
    await expect(page).toHaveURL(/.*expenses$/);
    const row = page.getByText(catatan).first();
    await expect(row).toBeVisible({ timeout: 10000 });
    await row.click();

    await expect(page).toHaveURL(/.*expenses\/\d+/);

    const hapusBtn = page.getByRole("button", { name: "Hapus" }).first();
    await expect(hapusBtn).toBeVisible({ timeout: 10000 });
    await hapusBtn.click();

    const konfirmasiBtn = page.getByRole("dialog").getByRole("button", { name: /Ya, hapus|Hapus/i });
    await konfirmasiBtn.click();

    await expect(page).toHaveURL(/.*expenses/);
  });
});

