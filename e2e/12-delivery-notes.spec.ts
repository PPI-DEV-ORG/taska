import { test, expect } from "@playwright/test";

test.describe("Modul Surat Jalan (Delivery Notes)", () => {
  const tujuan = `[TEST] Gudang Cabang Bandung ${Date.now()}`;

  test("Buat Surat Jalan, Cek Detail, Ubah Status, dan Hapus", async ({ page }) => {
    // 1. Buka halaman Surat Jalan
    await page.goto("/delivery-notes");
    await expect(page).toHaveURL(/.*delivery-notes/);

    // 2. Klik Buat Surat Jalan
    const createBtn = page.getByRole("button", { name: "Buat surat jalan" }).first();
    await expect(createBtn).toBeVisible({ timeout: 10000 });
    await createBtn.click();

    // 3. Masuk halaman /delivery-notes/new
    await expect(page).toHaveURL(/.*delivery-notes\/new/);

    const tujuanInput = page.getByPlaceholder(/Gedung Wisma|Sudirman|Lokasi tujuan/i).first();
    await expect(tujuanInput).toBeVisible({ timeout: 10000 });
    await tujuanInput.fill(tujuan);

    const alasanInput = page.getByPlaceholder(/Instalasi reader|Alasan/i).first();
    if (await alasanInput.isVisible()) {
      await alasanInput.fill("Pengiriman unit perlengkapan CCTV untuk deployment.");
    }

    const submitBtn = page.getByRole("button", { name: /Ajukan Surat Jalan|Terbitkan Surat Jalan/i });
    await expect(submitBtn).toBeVisible();
    await submitBtn.click();

    // 4. Kembali ke daftar surat jalan
    await expect(page).toHaveURL(/.*delivery-notes$/);

    // 5. Buka detail surat jalan
    const row = page.getByText(tujuan).or(page.getByText(/SJ\/\d+|SJN\/\d+/)).first();
    await expect(row).toBeVisible({ timeout: 10000 });
    await row.click();

    await expect(page).toHaveURL(/.*delivery-notes\/\d+/);

    // 6. Ubah Status Surat Jalan
    const ubahStatusBtn = page.getByRole("button", { name: "Ubah status" });
    if (await ubahStatusBtn.isVisible()) {
      await ubahStatusBtn.click();
      const statusDialog = page.getByRole("dialog");
      await expect(statusDialog).toBeVisible();
      await statusDialog.getByText("Dikirim").first().click();
      await page.waitForTimeout(500);
    }

    // 7. Hapus Surat Jalan
    const hapusBtn = page.getByRole("button", { name: "Hapus" }).first();
    await expect(hapusBtn).toBeVisible({ timeout: 10000 });
    await hapusBtn.click();

    const konfirmasiBtn = page.getByRole("dialog").getByRole("button", { name: /Ya, hapus|Hapus/i });
    await konfirmasiBtn.click();

    await expect(page).toHaveURL(/.*delivery-notes$/);
  });
});

