import * as React from "react";
import { api } from "@/services/api";

export type FaAccountOption = {
  code: string;
  name: string;
  label: string;
  category: string;
  isCash: boolean;
};

export const FALLBACK_FA_CASH_ACCOUNTS: FaAccountOption[] = [
  { code: "1000.02", name: "Bank Mandiri PT GMP", label: "1000.02 - Bank Mandiri PT GMP", category: "Aset Lancar", isCash: true },
  { code: "1000.01", name: "Kas Operasional / Kecil", label: "1000.01 - Kas Operasional / Kecil", category: "Aset Lancar", isCash: true },
];

export const FALLBACK_FA_ASSET_ACCOUNTS: FaAccountOption[] = [
  { code: "1504", name: "Peralatan Kantor & Elektronik", label: "1504 - Peralatan Kantor & Elektronik", category: "Aset Tidak Lancar", isCash: false },
  { code: "1501", name: "Tanah", label: "1501 - Tanah", category: "Aset Tidak Lancar", isCash: false },
  { code: "1502", name: "Bangunan & Gedung", label: "1502 - Bangunan & Gedung", category: "Aset Tidak Lancar", isCash: false },
  { code: "1503", name: "Kendaraan Operasional", label: "1503 - Kendaraan Operasional", category: "Aset Tidak Lancar", isCash: false },
  { code: "1505", name: "Mesin & Peralatan Proyek", label: "1505 - Mesin & Peralatan Proyek", category: "Aset Tidak Lancar", isCash: false },
  { code: "1506", name: "Perangkat IT & Komputer", label: "1506 - Perangkat IT & Komputer", category: "Aset Tidak Lancar", isCash: false },
  { code: "1507", name: "Furniture & Fixture", label: "1507 - Furniture & Fixture", category: "Aset Tidak Lancar", isCash: false },
];

export const FALLBACK_FA_ACCUM_ACCOUNTS: FaAccountOption[] = [
  { code: "1592", name: "Akum. Penyusutan Kendaraan", label: "1592 - Akum. Penyusutan Kendaraan", category: "Aset Tidak Lancar", isCash: false },
  { code: "1591", name: "Akum. Penyusutan Gedung", label: "1591 - Akum. Penyusutan Gedung", category: "Aset Tidak Lancar", isCash: false },
  { code: "1593", name: "Akum. Penyusutan Peralatan Kantor", label: "1593 - Akum. Penyusutan Peralatan Kantor", category: "Aset Tidak Lancar", isCash: false },
  { code: "1594", name: "Akum. Penyusutan Mesin & Alat", label: "1594 - Akum. Penyusutan Mesin & Alat", category: "Aset Tidak Lancar", isCash: false },
  { code: "1595", name: "Akum. Penyusutan Perangkat IT", label: "1595 - Akum. Penyusutan Perangkat IT", category: "Aset Tidak Lancar", isCash: false },
  { code: "1596", name: "Akum. Penyusutan Furniture", label: "1596 - Akum. Penyusutan Furniture", category: "Aset Tidak Lancar", isCash: false },
];

export const FALLBACK_FA_EXPENSE_ACCOUNTS: FaAccountOption[] = [
  { code: "6101", name: "Beban Penyusutan Aset Tetap", label: "6101 - Beban Penyusutan Aset Tetap", category: "Beban Operasional", isCash: false },
];

export function useFaAccounts() {
  const [cashAccounts, setCashAccounts] = React.useState<FaAccountOption[]>(FALLBACK_FA_CASH_ACCOUNTS);
  const [fundingOptions, setFundingOptions] = React.useState<FaAccountOption[]>(FALLBACK_FA_CASH_ACCOUNTS);
  const [assetAccounts, setAssetAccounts] = React.useState<FaAccountOption[]>(FALLBACK_FA_ASSET_ACCOUNTS);
  const [accumDepAccounts, setAccumDepAccounts] = React.useState<FaAccountOption[]>(FALLBACK_FA_ACCUM_ACCOUNTS);
  const [depExpenseAccounts, setDepExpenseAccounts] = React.useState<FaAccountOption[]>(FALLBACK_FA_EXPENSE_ACCOUNTS);
  const [allAccounts, setAllAccounts] = React.useState<FaAccountOption[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let mounted = true;
    api.get<any[]>("/accounting/accounts?postable=true")
      .then((rows) => {
        if (!mounted || !Array.isArray(rows)) return;
        const active = rows.filter((r) => r.status === "AKTIF");
        const mapped: FaAccountOption[] = active.map((r) => ({
          code: r.code,
          name: r.name,
          label: `${r.code} - ${r.name}`,
          category: r.category,
          isCash: Boolean(r.isCash),
        }));

        setAllAccounts(mapped);

        // Kas / Bank
        const cash = mapped.filter((a) => a.isCash);
        if (cash.length > 0) setCashAccounts(cash);

        // Sumber Dana: Kas/Bank + Ekuitas (310xxx) + Hutang Usaha (210xxx)
        const funding = mapped.filter(
          (a) =>
            a.isCash ||
            a.category?.toLowerCase().includes("ekuitas") ||
            a.category?.toLowerCase().includes("modal") ||
            a.code.startsWith("31") ||
            a.category?.toLowerCase().includes("kewajiban") ||
            a.category?.toLowerCase().includes("hutang") ||
            a.code.startsWith("21"),
        );
        if (funding.length > 0) setFundingOptions(funding);

        // Akun Aset Tetap: 1501-1589 / Non-akumulasi aset tidak lancar
        const assets = mapped.filter(
          (a) =>
            (a.code.startsWith("15") && !a.code.startsWith("159")) ||
            (a.category === "Aset Tidak Lancar" && !a.name.toLowerCase().includes("akumulasi")),
        );
        if (assets.length > 0) setAssetAccounts(assets);

        // Akun Akumulasi Penyusutan: 159x / nama akumulasi
        const accum = mapped.filter(
          (a) =>
            a.code.startsWith("159") ||
            a.name.toLowerCase().includes("akumulasi") ||
            a.name.toLowerCase().includes("akum."),
        );
        if (accum.length > 0) setAccumDepAccounts(accum);

        // Akun Beban Penyusutan: 6101 / Beban operasional susut
        const exp = mapped.filter(
          (a) =>
            a.code === "6101" ||
            a.name.toLowerCase().includes("penyusutan") ||
            a.category === "Beban Operasional",
        );
        if (exp.length > 0) setDepExpenseAccounts(exp);
      })
      .catch(() => null)
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  return {
    cashAccounts,
    fundingOptions,
    assetAccounts,
    accumDepAccounts,
    depExpenseAccounts,
    allAccounts,
    loading,
  };
}
