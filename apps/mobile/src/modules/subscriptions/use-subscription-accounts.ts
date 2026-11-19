import * as React from "react";
import { api } from "@/services/api";

export type AccountOption = {
  code: string;
  name: string;
  label: string;
  category: string;
  isCash: boolean;
};

export const FALLBACK_CASH_ACCOUNTS: AccountOption[] = [
  { code: "1000.02", name: "Bank Mandiri PT GMP", label: "1000.02 - Bank Mandiri PT GMP", category: "Aset Lancar", isCash: true },
  { code: "1000.01", name: "Kas Operasional", label: "1000.01 - Kas Operasional", category: "Aset Lancar", isCash: true },
  { code: "1000.03", name: "Kas Kecil (Petty Cash)", label: "1000.03 - Kas Kecil (Petty Cash)", category: "Aset Lancar", isCash: true },
];

export const FALLBACK_EXPENSE_ACCOUNTS: AccountOption[] = [
  { code: "6122", name: "Beban Lisensi & Software SaaS", label: "6122 - Beban Lisensi & Software SaaS", category: "Beban Operasional", isCash: false },
  { code: "6120", name: "Beban Cloud Hosting & VPS", label: "6120 - Beban Cloud Hosting & VPS", category: "Beban Operasional", isCash: false },
  { code: "6121", name: "Beban Domain & DNS", label: "6121 - Beban Domain & DNS", category: "Beban Operasional", isCash: false },
  { code: "6123", name: "Beban Email & Kolaborasi Bisnis", label: "6123 - Beban Email & Kolaborasi Bisnis", category: "Beban Operasional", isCash: false },
  { code: "6124", name: "Beban Internet & Konektivitas", label: "6124 - Beban Internet & Konektivitas", category: "Beban Operasional", isCash: false },
  { code: "6126", name: "Beban Cloud Storage & Backup", label: "6126 - Beban Cloud Storage & Backup", category: "Beban Operasional", isCash: false },
];

export const FALLBACK_PREPAID_ACCOUNTS: AccountOption[] = [
  { code: "1401", name: "Biaya Dibayar di Muka (Prepaid Expense)", label: "1401 - Biaya Dibayar di Muka (Prepaid Expense)", category: "Aset Lancar", isCash: false },
];

export function useSubscriptionAccounts() {
  const [cashAccounts, setCashAccounts] = React.useState<AccountOption[]>(FALLBACK_CASH_ACCOUNTS);
  const [expenseAccounts, setExpenseAccounts] = React.useState<AccountOption[]>(FALLBACK_EXPENSE_ACCOUNTS);
  const [prepaidAccounts, setPrepaidAccounts] = React.useState<AccountOption[]>(FALLBACK_PREPAID_ACCOUNTS);
  const [allAccounts, setAllAccounts] = React.useState<AccountOption[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let mounted = true;
    api.get<any[]>("/accounting/accounts?postable=true")
      .then((rows) => {
        if (!mounted || !Array.isArray(rows)) return;
        const active = rows.filter((r) => r.status === "AKTIF");
        const mapped: AccountOption[] = active.map((r) => ({
          code: r.code,
          name: r.name,
          label: `${r.code} - ${r.name}`,
          category: r.category,
          isCash: Boolean(r.isCash),
        }));

        setAllAccounts(mapped);

        const cash = mapped.filter((a) => a.isCash);
        if (cash.length > 0) setCashAccounts(cash);

        const exp = mapped.filter(
          (a) =>
            a.category === "Beban Operasional" ||
            a.category === "Beban Pokok (HPP)" ||
            a.category === "Beban Diluar Usaha",
        );
        if (exp.length > 0) setExpenseAccounts(exp);

        const prep = mapped.filter((a) => a.code.startsWith("14") || a.name.toLowerCase().includes("muka"));
        if (prep.length > 0) setPrepaidAccounts(prep);
      })
      .catch(() => null)
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  return { cashAccounts, expenseAccounts, prepaidAccounts, allAccounts, loading };
}
