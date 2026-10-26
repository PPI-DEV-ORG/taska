import { test, expect } from "@playwright/test";

test.describe("Modul Pengiriman Supplier (Shipments)", () => {
  test("Cek Daftar Tracking Pengiriman Logistik Vendor", async ({ page }) => {
    // 1. Buka halaman Shipments
    await page.goto("/shipments");
    await expect(page).toHaveURL(/.*shipments/);

    // 2. Verifikasi Header
    await expect(page.getByText("Pengiriman dari Supplier")).toBeVisible({ timeout: 10000 });

    // 3. Verifikasi tahapan pengiriman (Di Supplier, Dikirim, Sampai)
    await expect(page.getByText("Di Supplier").first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Dikirim").first()).toBeVisible();
    await expect(page.getByText("Sampai").first()).toBeVisible();

    // 4. Buka salah satu shipment card untuk menuju PO supplier terkait
    const shipmentCard = page.locator("div[role='button'], [tabindex='0']").filter({ hasText: /SP\/\d+|Di Supplier|Dikirim|Sampai/i }).first();
    if (await shipmentCard.isVisible()) {
      await shipmentCard.click();
      await expect(page).toHaveURL(/.*supplier-pos\/\d+/);
    }
  });
});

