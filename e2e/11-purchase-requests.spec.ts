import { test, expect } from "@playwright/test";

test.describe("Modul Request Barang (Purchase Requests)", () => {
  test("Buat Request Baru, Cek Detail, Ubah Status, dan Hapus", async ({ page }) => {
    // 1. Buka halaman purchase requests
    await page.goto("/purchase-requests");
    await expect(page).toHaveURL(/.*purchase-requests/);

    // 2. Klik Buat Request
    const createBtn = page.getByRole("button", { name: "Buat request" }).first();
    await expect(createBtn).toBeVisible({ timeout: 10000 });
    await createBtn.click();

    // 3. Masuk halaman /purchase-requests/new (Wizard 3 langkah)
    await expect(page).toHaveURL(/.*purchase-requests\/new/);

    // Langkah 1: Pilih Project & Jenis Biaya
    const nextBtn1 = page.getByRole("button", { name: /Lanjut: Pilih Barang/i });
    await expect(nextBtn1).toBeVisible({ timeout: 10000 });
    await nextBtn1.click();

    // Langkah 2: Barang sudah default terpilih dari master, lanjut ke ringkasan
    const nextBtn2 = page.getByRole("button", { name: /Lanjut: Ringkasan/i });
    await expect(nextBtn2).toBeVisible({ timeout: 10000 });
    await nextBtn2.click();

    // Langkah 3: Konfirmasi dan Ajukan
    const submitBtn = page.getByRole("button", { name: /Ajukan Request Barang/i });
    await expect(submitBtn).toBeVisible({ timeout: 10000 });
    await submitBtn.click();

    // 4. Kembali ke daftar request barang
    await expect(page).toHaveURL(/.*purchase-requests$/);

    // 5. Buka detail request teratas
    const chevronBtn = page.locator("button:has(svg.lucide-chevron-right)").first();
    await expect(chevronBtn).toBeVisible({ timeout: 10000 });
    await chevronBtn.click();

    await expect(page).toHaveURL(/.*purchase-requests\/\d+/);

    // 6. Hapus Request Barang (Status 'Diajukan' memenuhi syarat penghapusan backend)
    const hapusBtn = page.getByRole("button", { name: "Hapus" }).first();
    await expect(hapusBtn).toBeVisible({ timeout: 10000 });
    await hapusBtn.click();

    const konfirmasiBtn = page.getByRole("dialog").getByRole("button", { name: /Ya, hapus|Hapus/i });
    await konfirmasiBtn.click();

    await expect(page).toHaveURL(/.*purchase-requests$/);
  });
});

