import * as React from "react";
import { useApp } from "@/store/app-store";
import { useBreakpoint } from "@/hooks/use-breakpoint";

import { ExecutiveDashboard } from "@/modules/dashboard/components/executive-dashboard";
import { SalesDashboard } from "@/modules/dashboard/components/sales-dashboard";
import { PmDashboard } from "@/modules/dashboard/components/pm-dashboard";
import { TeknisiDashboard } from "@/modules/dashboard/components/teknisi-dashboard";
import { ProcurementDashboard } from "@/modules/dashboard/components/procurement-dashboard";
import { FinanceDashboard } from "@/modules/dashboard/components/finance-dashboard";
import { GudangDashboard } from "@/modules/dashboard/components/gudang-dashboard";
import { SeDashboard } from "@/modules/dashboard/components/se-dashboard";

export default function DashboardScreen() {
  const { user, data, approvals, decide } = useApp();
  const { isMobile } = useBreakpoint();
  const [now] = React.useState(() => Date.now());

  if (!user) return null;

  const role = user.role;

  if (role === "super_admin" || role === "admin" || role === "bos") {
    return (
      <ExecutiveDashboard
        user={user}
        data={data}
        approvals={approvals}
        decide={decide}
        isMobile={isMobile}
      />
    );
  }

  if (role === "sales") {
    return <SalesDashboard user={user} data={data} isMobile={isMobile} />;
  }

  if (role === "pm") {
    return <PmDashboard user={user} data={data} isMobile={isMobile} />;
  }

  if (role === "teknisi") {
    return <TeknisiDashboard user={user} data={data} isMobile={isMobile} />;
  }

  if (role === "procurement") {
    return (
      <ProcurementDashboard
        user={user}
        data={data}
        now={now}
        isMobile={isMobile}
      />
    );
  }

  if (role === "finance" || role === "hr") {
    return (
      <FinanceDashboard
        user={user}
        data={data}
        approvals={approvals}
        isMobile={isMobile}
      />
    );
  }

  if (role === "gudang") {
    return <GudangDashboard user={user} data={data} isMobile={isMobile} />;
  }

  if (role === "se") {
    return <SeDashboard user={user} data={data} isMobile={isMobile} />;
  }

  return null;
}
