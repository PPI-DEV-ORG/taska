import * as React from "react";
import { ScrollView, View } from "react-native";
import { PageHeader, EmptyState } from "@/components/akuntra/basics";
import { hasUserPermission } from "@/constants/modules";
import { useApp } from "@/store/app-store";
import { DriveExplorer } from "@/modules/drive/drive-explorer";

export default function GeneralFilesRoute() {
  const { user } = useApp();
  const isAllowed =
    hasUserPermission(user, "general-files", "M") ||
    hasUserPermission(user, "general-files", "L") ||
    hasUserPermission(user, "file-management", "M") ||
    hasUserPermission(user, "file-management", "L");

  if (!isAllowed) {
    return (
      <EmptyState
        title="Akses Ditolak"
        text="Akun kamu tidak memiliki akses untuk membuka modul Dokumen Umum."
      />
    );
  }

  return (
    <ScrollView className="flex-1 bg-background" showsVerticalScrollIndicator={false}>
      <View className="mx-auto w-full max-w-7xl p-4 md:p-6 gap-5">
        <PageHeader
          title="Dokumen Umum"
          subtitle="Company Shared Drive — buat folder, unggah, cari, pratinjau, dan bagikan dokumen umum perusahaan"
        />
        <DriveExplorer mode="manager" />
      </View>
    </ScrollView>
  );
}
