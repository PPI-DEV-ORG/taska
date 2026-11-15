/**
 * Perhitungan gaji bulanan (Indonesia):
 *   • BPJS Kesehatan  : karyawan 1% · perusahaan 4%      — dasar gaji pokok + tunjangan tetap, maks. batas upah Kesehatan
 *   • JHT             : karyawan 2% · perusahaan 3,7%    — dasar gaji pokok + tunjangan tetap
 *   • Jaminan Pensiun : karyawan 1% · perusahaan 2%      — dasar maks. batas upah JP
 *   • JKK (0,24%–1,74% sesuai risiko) & JKM 0,3%         — ditanggung perusahaan
 *   • PPh 21 bulanan  : Tarif Efektif Rata-rata (TER, PP 58/2023) × penghasilan bruto
 *                       bruto = gaji + tunjangan + lembur + uang makan + bonus − potongan absen
 *                               + premi JKK, JKM & BPJS Kesehatan yang dibayar perusahaan
 *                       Kategori TER dari status PTKP; tanpa NPWP tarif 20% lebih tinggi.
 * Catatan: perhitungan ulang setahunan (masa Desember, Pasal 17) belum otomatis.
 */

export type PayrollSettings = {
  workDays: number;
  /** Pembagi upah lembur per jam (Kepmenaker: 1/173 upah sebulan). */
  overtimeDivisor: number;
  kesWageCap: number;
  jpWageCap: number;
  kesEmployeePct: number;
  kesCompanyPct: number;
  jhtEmployeePct: number;
  jhtCompanyPct: number;
  jpEmployeePct: number;
  jpCompanyPct: number;
  jkkPct: number;
  jkmPct: number;
  noNpwpSurchargePct: number;
};

export const DEFAULT_PAYROLL_SETTINGS: PayrollSettings = {
  workDays: 22,
  overtimeDivisor: 173,
  kesWageCap: 12_000_000,
  jpWageCap: 10_547_400,
  kesEmployeePct: 1,
  kesCompanyPct: 4,
  jhtEmployeePct: 2,
  jhtCompanyPct: 3.7,
  jpEmployeePct: 1,
  jpCompanyPct: 2,
  jkkPct: 0.24,
  jkmPct: 0.3,
  noNpwpSurchargePct: 20,
};

export type TerCategory = "A" | "B" | "C";

/** Kategori TER dari status PTKP (PP 58/2023). */
export function terCategoryOf(ptkp?: string | null): TerCategory {
  const k = String(ptkp || "TK/0").toUpperCase().replace(/\s/g, "");
  if (["TK/2", "TK/3", "K/1", "K/2"].includes(k)) return "B";
  if (k === "K/3") return "C";
  return "A"; // TK/0, TK/1, K/0
}

/** Tabel TER bulanan: [batas atas penghasilan bruto, tarif %]. Baris terakhir = di atasnya. */
const TER: Record<TerCategory, Array<[number, number]>> = {
  A: [
    [5_400_000, 0], [5_650_000, 0.25], [5_950_000, 0.5], [6_300_000, 0.75], [6_750_000, 1], [7_500_000, 1.25],
    [8_550_000, 1.5], [9_650_000, 1.75], [10_050_000, 2], [10_350_000, 2.25], [10_700_000, 2.5], [11_050_000, 3],
    [11_600_000, 3.5], [12_500_000, 4], [13_750_000, 5], [15_100_000, 6], [16_950_000, 7], [19_750_000, 8],
    [24_150_000, 9], [26_450_000, 10], [28_000_000, 11], [30_050_000, 12], [32_400_000, 13], [35_400_000, 14],
    [39_100_000, 15], [43_850_000, 16], [47_800_000, 17], [51_400_000, 18], [56_300_000, 19], [62_200_000, 20],
    [68_600_000, 21], [77_500_000, 22], [89_000_000, 23], [103_000_000, 24], [125_000_000, 25], [157_000_000, 26],
    [206_000_000, 27], [337_000_000, 28], [454_000_000, 29], [550_000_000, 30], [695_000_000, 31], [910_000_000, 32],
    [1_400_000_000, 33], [Infinity, 34],
  ],
  B: [
    [6_200_000, 0], [6_500_000, 0.25], [6_850_000, 0.5], [7_300_000, 0.75], [9_200_000, 1], [10_750_000, 1.5],
    [11_250_000, 2], [11_600_000, 2.5], [12_600_000, 3], [13_600_000, 4], [14_950_000, 5], [16_400_000, 6],
    [18_450_000, 7], [21_850_000, 8], [26_000_000, 9], [27_700_000, 10], [29_350_000, 11], [31_450_000, 12],
    [33_950_000, 13], [37_100_000, 14], [41_100_000, 15], [45_800_000, 16], [49_500_000, 17], [53_800_000, 18],
    [58_500_000, 19], [64_000_000, 20], [71_000_000, 21], [80_000_000, 22], [93_000_000, 23], [109_000_000, 24],
    [129_000_000, 25], [163_000_000, 26], [211_000_000, 27], [374_000_000, 28], [459_000_000, 29], [555_000_000, 30],
    [704_000_000, 31], [957_000_000, 32], [1_405_000_000, 33], [Infinity, 34],
  ],
  C: [
    [6_600_000, 0], [6_950_000, 0.25], [7_350_000, 0.5], [7_800_000, 0.75], [8_850_000, 1], [9_800_000, 1.25],
    [10_950_000, 1.5], [11_200_000, 1.75], [12_050_000, 2], [12_950_000, 3], [14_150_000, 4], [15_550_000, 5],
    [17_050_000, 6], [19_500_000, 7], [22_700_000, 8], [26_600_000, 9], [28_100_000, 10], [30_100_000, 11],
    [32_600_000, 12], [35_400_000, 13], [38_900_000, 14], [43_000_000, 15], [47_400_000, 16], [51_200_000, 17],
    [55_800_000, 18], [60_400_000, 19], [66_700_000, 20], [74_500_000, 21], [83_200_000, 22], [95_600_000, 23],
    [110_000_000, 24], [134_000_000, 25], [169_000_000, 26], [221_000_000, 27], [390_000_000, 28], [463_000_000, 29],
    [561_000_000, 30], [709_000_000, 31], [965_000_000, 32], [1_419_000_000, 33], [Infinity, 34],
  ],
};

export function terRate(category: TerCategory, gross: number): number {
  for (const [upTo, rate] of TER[category]) if (gross <= upTo) return rate;
  return 34;
}

export type SalaryInput = {
  basicSalary: number;
  allowance: number;
  mealAllowance: number;
  ptkp?: string | null;
  hasNpwp?: boolean;
  /** Tarif PPh 21 khusus (%) — menggantikan TER bila diisi. */
  pph21Rate?: number | null;
  bpjsKes?: boolean;
  bpjsTk?: boolean;
  bpjsJp?: boolean;
};

export type AttendanceInput = { presentDays: number; absentDays: number; overtimeHours: number };

export type SlipCalc = {
  basicSalary: number;
  allowance: number;
  mealAllowance: number;
  overtimePay: number;
  absentDeduct: number;
  otherIncome: number;
  grossSalary: number;
  bpjs: number;
  bpjsCompany: number;
  taxBase: number;
  terCategory: TerCategory;
  terRate: number;
  pph21: number;
  otherDeduction: number;
  netSalary: number;
  detail: {
    employee: { kes: number; jht: number; jp: number };
    company: { kes: number; jht: number; jp: number; jkk: number; jkm: number };
    bpjsBase: number;
  };
};

const r = (n: number) => Math.round(n);

export function calculateSlip(
  cfg: SalaryInput,
  att: AttendanceInput,
  extra: { otherIncome?: number; otherDeduction?: number } = {},
  s: PayrollSettings = DEFAULT_PAYROLL_SETTINGS,
): SlipCalc {
  const basic = Math.max(0, Number(cfg.basicSalary) || 0);
  const allowance = Math.max(0, Number(cfg.allowance) || 0);
  const meal = r(Math.max(0, Number(cfg.mealAllowance) || 0) * Math.max(0, att.presentDays));
  const overtimePay = basic > 0 ? r((Math.max(0, att.overtimeHours) * basic) / s.overtimeDivisor) : 0;
  const absentDeduct = basic > 0 ? r((Math.max(0, att.absentDays) * basic) / s.workDays) : 0;
  const otherIncome = r(Math.max(0, Number(extra.otherIncome) || 0));
  const grossSalary = Math.max(0, basic + allowance + meal + overtimePay + otherIncome - absentDeduct);

  // BPJS (dasar = gaji pokok + tunjangan tetap)
  const base = basic + allowance;
  const kesBase = Math.min(base, s.kesWageCap);
  const jpBase = Math.min(base, s.jpWageCap);
  const tk = cfg.bpjsTk !== false;
  const kesOn = cfg.bpjsKes !== false;
  const jpOn = cfg.bpjsJp !== false;
  const employee = {
    kes: kesOn ? r((kesBase * s.kesEmployeePct) / 100) : 0,
    jht: tk ? r((base * s.jhtEmployeePct) / 100) : 0,
    jp: jpOn ? r((jpBase * s.jpEmployeePct) / 100) : 0,
  };
  const company = {
    kes: kesOn ? r((kesBase * s.kesCompanyPct) / 100) : 0,
    jht: tk ? r((base * s.jhtCompanyPct) / 100) : 0,
    jp: jpOn ? r((jpBase * s.jpCompanyPct) / 100) : 0,
    jkk: tk ? r((base * s.jkkPct) / 100) : 0,
    jkm: tk ? r((base * s.jkmPct) / 100) : 0,
  };
  const bpjs = employee.kes + employee.jht + employee.jp;
  const bpjsCompany = company.kes + company.jht + company.jp + company.jkk + company.jkm;

  // PPh 21: premi JKK, JKM & Kesehatan yang dibayar perusahaan = penghasilan (JHT & JP perusahaan bukan)
  const taxBase = grossSalary + company.jkk + company.jkm + company.kes;
  const category = terCategoryOf(cfg.ptkp);
  const custom = cfg.pph21Rate !== null && cfg.pph21Rate !== undefined && Number(cfg.pph21Rate) > 0 ? Number(cfg.pph21Rate) : null;
  const rate = custom ?? terRate(category, taxBase);
  let pph21 = r((taxBase * rate) / 100);
  if (cfg.hasNpwp === false && pph21 > 0) pph21 = r(pph21 * (1 + s.noNpwpSurchargePct / 100));

  const otherDeduction = r(Math.max(0, Number(extra.otherDeduction) || 0));
  const netSalary = grossSalary - bpjs - pph21 - otherDeduction;

  return {
    basicSalary: basic,
    allowance,
    mealAllowance: meal,
    overtimePay,
    absentDeduct,
    otherIncome,
    grossSalary,
    bpjs,
    bpjsCompany,
    taxBase,
    terCategory: category,
    terRate: rate,
    pph21,
    otherDeduction,
    netSalary,
    detail: { employee, company, bpjsBase: base },
  };
}
