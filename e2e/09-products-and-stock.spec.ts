import { test, expect } from "@playwright/test";

test.describe("Modul Produk, Serial Number & Stok", () => {
  const timestamp = Date.now();
  const snProductName = `[TEST] Kamera CCTV SN ${timestamp}`;
  const snProductSku = `CAM-SN-${timestamp.toString().slice(-6)}`;

  const nonSnProductName = `[TEST] Kabel UTP Cat6 ${timestamp}`;
  const nonSnProductSku = `KBL-${timestamp.toString().slice(-6)}`;

  test("Menambahkan Barang Ber-SN, Barang Non-SN, Tambah SN, dan Cek Stok", async ({ page }) => {
    // 1. Buka halaman Stok & Produk
    await page.goto("/stock");
    await expect(page).toHaveURL(/.*stock/);

    // 2. Tambah Barang Ber-SN
    const tambahBtn = page.getByRole("button", { name: "Tambah Barang / Jasa" });
    await expect(tambahBtn).toBeVisible({ timeout: 10000 });
    await tambahBtn.click();

    const addDialog = page.getByRole("dialog");
    await expect(addDialog).toBeVisible();

    // Default adalah "Barang Ber-SN"
    await addDialog.getByPlaceholder(/Contoh: Kamera IP|Nama Barang/i).fill(snProductName);
    await addDialog.getByPlaceholder(/Contoh: UNV-IPC2124|Kode SKU/i).fill(snProductSku);
    await addDialog.getByPlaceholder(/Uniview|Merk/i).fill("Uniview Test");
    await addDialog.getByRole("button", { name: "Simpan ke Katalog" }).click();

    // Verifikasi barang ber-SN muncul di katalog
    const snProductRow = page.getByText(snProductName).first();
    await expect(snProductRow).toBeVisible({ timeout: 10000 });

    // 3. Tambah Barang Non-SN
    await tambahBtn.click();
    await expect(addDialog).toBeVisible();

    // Pilih jenis Barang Non-SN
    await addDialog.getByRole("button", { name: "Barang Non-SN" }).click();
    await addDialog.getByPlaceholder(/Contoh: Kamera IP|Nama Barang/i).fill(nonSnProductName);
    await addDialog.getByPlaceholder(/Contoh: UNV-IPC2124|Kode SKU/i).fill(nonSnProductSku);
    await addDialog.getByPlaceholder(/Uniview|Merk/i).fill("Belden Test");
    await addDialog.getByRole("button", { name: "Simpan ke Katalog" }).click();

    // Verifikasi barang Non-SN muncul di katalog
    const nonSnProductRow = page.getByText(nonSnProductName).first();
    await expect(nonSnProductRow).toBeVisible({ timeout: 10000 });

    // 4. Tambah Unit Serial Number (SN) untuk Barang Ber-SN
    const tambahSnBtn = page.getByRole("button", { name: "Tambah Barang per SN" });
    await expect(tambahSnBtn).toBeVisible();
    await tambahSnBtn.click();

    const batchSnDialog = page.getByRole("dialog").last();
    await expect(batchSnDialog).toBeVisible();

    // Pilih produk ber-SN yang baru dibuat
    const prodSelectTrigger = batchSnDialog.getByText(/Pilih produk kamera|Pilih produk ber-SN/i).first();
    await expect(prodSelectTrigger).toBeVisible();
    await prodSelectTrigger.click();
    await page.getByRole("dialog").last().getByText(snProductName).first().click();
    await page.waitForTimeout(300);

    // Klik Generate SN Otomatis (misal default 10 SN)
    const generateBtn = batchSnDialog.getByRole("button", { name: /Buat \d+ SN/i });
    if (await generateBtn.isVisible()) {
      await generateBtn.click();
    } else {
      const snTextArea = batchSnDialog.locator("textarea").first();
      await snTextArea.fill(`${snProductSku}-001\n${snProductSku}-002`);
    }

    // Simpan unit SN
    const simpanSnBtn = batchSnDialog.getByRole("button", { name: /Simpan.*Unit SN/i });
    await expect(simpanSnBtn).toBeVisible();
    await simpanSnBtn.click();

    // Tunggu modal Batch SN selesai dan tertutup
    await expect(batchSnDialog).not.toBeVisible({ timeout: 10000 });

    // 5. Cek Stok di Tab "Per Serial Number"
    await page.getByText("Per Serial Number").click();
    await page.waitForTimeout(500);

    // Verifikasi SN dari produk kita muncul di tab serial number
    await expect(page.getByText(snProductSku).first()).toBeVisible({ timeout: 10000 });

    // 6. Cek Stok di Tab "List Barang & Jasa"
    await page.getByText("List Barang & Jasa").click();
    await page.waitForTimeout(500);

    // Cari produk ber-SN dengan filter pencarian
    const searchInput = page.getByPlaceholder("Cari");
    if (await searchInput.isVisible()) {
      await searchInput.fill(snProductSku);
      await expect(page.getByText(snProductName).first()).toBeVisible({ timeout: 5000 });
    }
  });
});

