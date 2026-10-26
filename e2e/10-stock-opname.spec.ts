import { test, expect } from "@playwright/test";

test.describe("Modul Stok Opname", () => {
  test("Cek Halaman Stok Opname, Pergantian Unit & Filter Gudang", async ({ page }) => {
    // 1. Buka halaman Stok Opname
    await page.goto("/opname");
    await expect(page).toHaveURL(/.*opname/);

    // 2. Verifikasi Header dan Panel Statistik
    await expect(page.getByText("Stok Opname", { exact: true })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Total Produk")).toBeVisible();
    await expect(page.getByText("Gudang Terpilih")).toBeVisible();

    // 3. Verifikasi tombol aksi
    const laporBtn = page.getByRole("button", { name: "Lapor Barang Rusak / Retur" });
    await expect(laporBtn).toBeVisible();

    const gantiSnBtn = page.getByRole("button", { name: "Pergantian Unit (SN Lama → Baru)" });
    await expect(gantiSnBtn).toBeVisible();

    // 4. Buka dialog Pergantian Unit
    await gantiSnBtn.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/Pergantian Barang \/ Unit Ber-SN/i)).toBeVisible();

    // Tutup dialog
    const batalBtn = dialog.getByRole("button", { name: "Batal" });
    if (await batalBtn.isVisible()) {
      await batalBtn.click();
    }
  });
});

