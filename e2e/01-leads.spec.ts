import { test, expect } from "@playwright/test";

test.describe("Modul Leads (CRUD)", () => {
  const leadName = `[TEST] Lead Testing ${Date.now()}`;

  test("Siklus CRUD: Tambah -> Lihat Detail -> Edit -> Hapus", async ({ page }) => {
    // 1. Buka halaman Leads
    await page.goto("/leads");
    await expect(page).toHaveURL(/.*leads/);

    // 2. Klik Tambah Lead
    const tambahBtn = page.getByRole("button", { name: /Tambah lead/i });
    await expect(tambahBtn).toBeVisible({ timeout: 10000 });
    await tambahBtn.click();

    // 3. Isi Form Tambah Lead di Modal
    await page.getByPlaceholder("Contoh: CCTV Gudang Baru").fill(leadName);

    // Pilih Perusahaan (SearchableSelect)
    const perusahaanTrigger = page.getByText("Pilih perusahaan").first();
    if (await perusahaanTrigger.isVisible()) {
      await perusahaanTrigger.click();
      await page.getByRole("dialog").last().getByText(/PT|Telkom/i).first().click();
      await page.waitForTimeout(300);
    }

    // Pilih Sumber (SearchableSelect)
    const sumberTrigger = page.getByText("Pilih sumber").first();
    if (await sumberTrigger.isVisible()) {
      await sumberTrigger.click();
      await page.getByRole("dialog").last().getByText(/Social Media|Website|Referral|Cold Call/i).first().click();
      await page.waitForTimeout(300);
    }

    // Klik Simpan
    await page.getByRole("button", { name: "Simpan" }).click();

    // 4. Verifikasi Lead baru muncul di daftar tabel
    const leadRow = page.getByText(leadName).first();
    await expect(leadRow).toBeVisible({ timeout: 10000 });

    // 5. Buka Halaman Detail Lead
    await leadRow.click();
    await expect(page).toHaveURL(/.*leads\/\d+/);
    await expect(page.getByText(leadName).first()).toBeVisible();

    // 6. Test Ubah Status di Detail Lead
    const ubahStatusBtn = page.getByRole("button", { name: "Ubah status" });
    if (await ubahStatusBtn.isVisible()) {
      await ubahStatusBtn.click();
      const statusDialog = page.getByRole("dialog").last();
      await expect(statusDialog).toBeVisible();
      await statusDialog.getByText("Proposal").first().click();
      await page.waitForTimeout(500);
    }

    // 7. Test Action Tombol Minta Survey
    const mintaSurveyBtn = page.getByRole("button", { name: "Minta survey" });
    if (await mintaSurveyBtn.isVisible()) {
      await mintaSurveyBtn.click();
      await page.waitForTimeout(500);
    }

    // 8. Edit Data Lead di Halaman Detail
    const catatanInput = page.getByPlaceholder(/Tulis ringkasan|kebutuhan teknis/i).first();
    if (await catatanInput.isVisible()) {
      await catatanInput.fill("Catatan kebutuhan diubah oleh Playwright E2E");
      
      // Simpan Perubahan
      const simpanPerubahanBtn = page.getByRole("button", { name: /Simpan Perubahan/i });
      if (await simpanPerubahanBtn.isVisible()) {
        await simpanPerubahanBtn.click();
        await page.waitForTimeout(500);
      }
    }

    // 9. Hapus Lead
    const hapusBtn = page.getByRole("button", { name: "Hapus" }).first();
    await expect(hapusBtn).toBeVisible({ timeout: 10000 });
    await hapusBtn.click();

    // Konfirmasi Hapus di Dialog
    const konfirmasiHapusBtn = page.getByRole("dialog").getByRole("button", { name: /Ya, hapus|Hapus/i });
    await konfirmasiHapusBtn.click();

    // 10. Verifikasi kembali ke list dan data sudah terhapus
    await expect(page).toHaveURL(/.*leads/);
    await expect(page.getByText(leadName)).not.toBeVisible({ timeout: 10000 });
  });
});

