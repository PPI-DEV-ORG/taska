import { useLocalSearchParams } from "expo-router";
import { SubscriptionsScreen } from "@/modules/subscriptions/subscriptions-screen";
import { EmptyState } from "@/components/akuntra/basics";
import { hasUserPermission } from "@/constants/modules";
import { useApp } from "@/store/app-store";

export default function SubscriptionsRoute() {
  const { search } = useLocalSearchParams<{ search?: string }>();
  const { user } = useApp();
  const isAllowed =
    hasUserPermission(user, "subscriptions", "M") ||
    hasUserPermission(user, "subscriptions", "L");

  if (!isAllowed) {
    return (
      <EmptyState
        title="Akses Ditolak"
        text="Akun kamu tidak memiliki akses untuk membuka modul Manajemen Langganan."
      />
    );
  }

  return <SubscriptionsScreen initialSearch={search} />;
}
