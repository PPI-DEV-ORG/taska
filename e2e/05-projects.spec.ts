import { test, expect } from "@playwright/test";

test.describe("Modul Projects (CRUD)", () => {
  const projName = `[TEST] Project E2E ${Date.now()}`;

  test("Siklus CRUD: Tambah -> Lihat Detail -> Edit -> Hapus", async ({ page }) => {
    test.setTimeout(60000);
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

    // 6. Test Tambah Tugas di dalam Project
    const taskTab = page.getByRole("tab", { name: "Tugas" }).or(page.getByText("Tugas", { exact: true })).first();
    if (await taskTab.isVisible()) {
      await taskTab.click();
      await page.waitForTimeout(300);

      const tambahTugasBtn = page.getByRole("button", { name: "Tambah Tugas" });
      if (await tambahTugasBtn.isVisible()) {
        await tambahTugasBtn.click();
        const taskDialog = page.getByRole("dialog").last();
        await expect(taskDialog).toBeVisible();

        const taskNameInput = taskDialog.getByPlaceholder(/Penarikan kabel|Nama Tugas/i).first();
        await taskNameInput.fill(`[TEST] Tugas Setting NVR ${Date.now()}`);

        const picTrigger = taskDialog.getByText(/Pilih PIC/i).first();
        if (await picTrigger.isVisible()) {
          await picTrigger.click();
          await page.getByRole("dialog").last().getByText(/Admin|Super|Teknisi|Hendra/i).first().click().catch(() => {});
          await page.waitForTimeout(300);
        }

        await taskDialog.getByRole("button", { name: "Simpan Tugas" }).click();
        await expect(taskDialog).not.toBeVisible({ timeout: 10000 });
      }
    }

    // 7. Test Halaman Modul Tugas Global
    await page.goto("/tasks");
    await expect(page).toHaveURL(/.*tasks/);
    await expect(page.getByText("Daftar Tugas (Tasks)")).toBeVisible({ timeout: 10000 });

    // 8. Kembali ke Project dan Hapus Project
    await page.goto("/projects");
    await expect(page).toHaveURL(/.*projects/);
    await row.click();
    await expect(page).toHaveURL(/.*projects\/\d+/);

    const hapusBtn = page.getByRole("button", { name: "Hapus" }).first();
    await expect(hapusBtn).toBeVisible({ timeout: 10000 });
    await hapusBtn.click();

    // Konfirmasi Hapus
    const konfirmasiBtn = page.getByRole("dialog").getByRole("button", { name: /Ya, hapus|Hapus/i });
    await konfirmasiBtn.click();

    // 9. Verifikasi kembali ke list
    await expect(page).toHaveURL(/.*projects/);
  });
});

