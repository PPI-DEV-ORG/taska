import { describe, expect, it } from "vitest";
import { calculateSlip, terCategoryOf, terRate } from "./payroll.calc.js";

describe("PPh 21 TER", () => {
  it("kategori dari PTKP", () => {
    expect(terCategoryOf("TK/0")).toBe("A");
    expect(terCategoryOf("K/0")).toBe("A");
    expect(terCategoryOf("TK/2")).toBe("B");
    expect(terCategoryOf("K/2")).toBe("B");
    expect(terCategoryOf("K/3")).toBe("C");
  });
  it("batas tarif kategori A", () => {
    expect(terRate("A", 5_400_000)).toBe(0);
    expect(terRate("A", 5_400_001)).toBe(0.25);
    expect(terRate("A", 10_050_000)).toBe(2);
    expect(terRate("A", 10_050_001)).toBe(2.25); // dulu salah langsung 5%
    expect(terRate("A", 15_000_000)).toBe(6);
  });
  it("kategori B & C lebih longgar", () => {
    expect(terRate("B", 6_200_000)).toBe(0);
    expect(terRate("C", 6_600_000)).toBe(0);
    expect(terRate("C", 10_000_000)).toBe(1.5);
  });
});

describe("slip gaji", () => {
  it("gaji 8 jt + tunjangan 1 jt + uang makan, TK/0, BPJS lengkap", () => {
    const s = calculateSlip(
      { basicSalary: 8_000_000, allowance: 1_000_000, mealAllowance: 25_000, ptkp: "TK/0", hasNpwp: true },
      { presentDays: 20, absentDays: 0, overtimeHours: 0 },
    );
    expect(s.mealAllowance).toBe(500_000);
    expect(s.grossSalary).toBe(9_500_000);
    // Karyawan: Kes 1% 90.000 + JHT 2% 180.000 + JP 1% 90.000
    expect(s.detail.employee).toEqual({ kes: 90_000, jht: 180_000, jp: 90_000 });
    expect(s.bpjs).toBe(360_000);
    // Perusahaan: Kes 4% 360.000, JHT 3,7% 333.000, JP 2% 180.000, JKK 0,24% 21.600, JKM 0,3% 27.000
    expect(s.bpjsCompany).toBe(921_600);
    // Dasar PPh = bruto + JKK + JKM + Kes perusahaan = 9.908.600 → TER A 2%
    expect(s.taxBase).toBe(9_908_600);
    expect(s.terRate).toBe(2);
    expect(s.pph21).toBe(198_172);
    expect(s.netSalary).toBe(9_500_000 - 360_000 - 198_172);
  });

  it("batas upah BPJS Kesehatan & JP", () => {
    const s = calculateSlip({ basicSalary: 20_000_000, allowance: 0, mealAllowance: 0, ptkp: "K/1" }, { presentDays: 22, absentDays: 0, overtimeHours: 0 });
    expect(s.detail.employee.kes).toBe(120_000); // 1% × 12 jt
    expect(s.detail.employee.jp).toBe(105_474); // 1% × 10.547.400
    expect(s.detail.employee.jht).toBe(400_000); // JHT tanpa batas
    expect(s.terCategory).toBe("B");
  });

  it("lembur, alpha, bonus, potongan & tanpa NPWP", () => {
    const s = calculateSlip(
      { basicSalary: 5_500_000, allowance: 0, mealAllowance: 0, ptkp: "TK/0", hasNpwp: false, bpjsKes: false, bpjsTk: false, bpjsJp: false },
      { presentDays: 20, absentDays: 1, overtimeHours: 10 },
      { otherIncome: 1_000_000, otherDeduction: 200_000 },
    );
    expect(s.overtimePay).toBe(Math.round((10 * 5_500_000) / 173));
    expect(s.absentDeduct).toBe(250_000);
    expect(s.bpjs).toBe(0);
    const gross = 5_500_000 + s.overtimePay + 1_000_000 - 250_000;
    expect(s.grossSalary).toBe(gross);
    const pph = Math.round(Math.round((gross * terRate("A", gross)) / 100) * 1.2);
    expect(s.pph21).toBe(pph);
    expect(s.netSalary).toBe(gross - pph - 200_000);
  });

  it("tarif khusus menggantikan TER", () => {
    const s = calculateSlip({ basicSalary: 10_000_000, allowance: 0, mealAllowance: 0, pph21Rate: 5, bpjsKes: false, bpjsTk: false, bpjsJp: false }, { presentDays: 22, absentDays: 0, overtimeHours: 0 });
    expect(s.pph21).toBe(500_000);
  });
});
