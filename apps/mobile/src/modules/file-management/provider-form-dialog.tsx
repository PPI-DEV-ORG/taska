import * as React from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, View } from "react-native";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { colors } from "@/tokens";
import { api } from "@/services/api";
import { useApp } from "@/store/app-store";
import {
  Cloud,
  HardDrive,
  FolderSync,
  X,
  CheckCircle2,
  AlertTriangle,
  Server,
} from "lucide-react-native";
import type { StorageProviderItem } from "./types";

export function ProviderFormDialog({
  visible,
  onClose,
  onSuccess,
  providerToEdit,
}: {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  providerToEdit?: StorageProviderItem | null;
}) {
  const { toast } = useApp();

  const [type, setType] = React.useState<"S3" | "NAS_MOUNT" | "WEBDAV">("S3");
  const [name, setName] = React.useState("");
  const [isDefault, setIsDefault] = React.useState(false);

  // S3
  const [endpoint, setEndpoint] = React.useState("");
  const [bucket, setBucket] = React.useState("");
  const [region, setRegion] = React.useState("auto");
  const [prefix, setPrefix] = React.useState("");
  const [accessKeyId, setAccessKeyId] = React.useState("");
  const [secretAccessKey, setSecretAccessKey] = React.useState("");

  // NAS Mount
  const [mountPath, setMountPath] = React.useState("");

  // WebDAV
  const [webdavUrl, setWebdavUrl] = React.useState("");
  const [webdavUsername, setWebdavUsername] = React.useState("");
  const [webdavPassword, setWebdavPassword] = React.useState("");

  const [testing, setTesting] = React.useState(false);
  const [testResult, setTestResult] = React.useState<{ ok: boolean; message: string } | null>(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    const timeout = setTimeout(() => {
      if (providerToEdit) {
        setName(providerToEdit.name);
        setType(providerToEdit.type === "LOCAL" ? "S3" : (providerToEdit.type as any));
        setIsDefault(providerToEdit.isDefault);
        const cfg = providerToEdit.config || {};
        if (providerToEdit.type === "S3") {
          setEndpoint(cfg.endpoint || "");
          setBucket(cfg.bucket || "");
          setRegion(cfg.region || "auto");
          setPrefix(cfg.prefix || "");
        } else if (providerToEdit.type === "NAS_MOUNT") {
          setMountPath(cfg.mountPath || cfg.path || "");
        } else if (providerToEdit.type === "WEBDAV") {
          setWebdavUrl(cfg.url || "");
          setPrefix(cfg.prefix || "");
        }
      } else {
        setName("");
        setType("S3");
        setIsDefault(false);
        setEndpoint("");
        setBucket("");
        setRegion("auto");
        setPrefix("");
        setAccessKeyId("");
        setSecretAccessKey("");
        setMountPath("");
        setWebdavUrl("");
        setWebdavUsername("");
        setWebdavPassword("");
      }
      setTestResult(null);
    }, 0);

    return () => clearTimeout(timeout);
  }, [providerToEdit, visible]);

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);

    // Kumpulkan payload
    const config: Record<string, any> = {};
    const credentials: Record<string, any> = {};

    if (type === "S3") {
      if (!bucket.trim()) {
        toast("Nama bucket wajib diisi", "danger");
        setTesting(false);
        return;
      }
      config.endpoint = endpoint.trim() || undefined;
      config.bucket = bucket.trim();
      config.region = region.trim() || "auto";
      config.prefix = prefix.trim() || undefined;

      if (accessKeyId.trim() || secretAccessKey.trim()) {
        credentials.accessKeyId = accessKeyId.trim();
        credentials.secretAccessKey = secretAccessKey.trim();
      }
    } else if (type === "NAS_MOUNT") {
      if (!mountPath.trim()) {
        toast("Mount path folder NAS wajib diisi", "danger");
        setTesting(false);
        return;
      }
      config.mountPath = mountPath.trim();
    } else if (type === "WEBDAV") {
      if (!webdavUrl.trim()) {
        toast("URL WebDAV wajib diisi", "danger");
        setTesting(false);
        return;
      }
      config.url = webdavUrl.trim();
      config.prefix = prefix.trim() || undefined;
      if (webdavUsername.trim() || webdavPassword.trim()) {
        credentials.username = webdavUsername.trim();
        credentials.password = webdavPassword.trim();
      }
    }

    try {
      if (providerToEdit) {
        // Cek provider yang sudah ada
        const res = await api.post<any>(`/file-management/providers/${providerToEdit.id}/test`, {});
        if (res.ok) {
          setTestResult({ ok: true, message: res.message || "Koneksi berhasil dan penyimpanan siap digunakan." });
        } else {
          setTestResult({ ok: false, message: res.message || "Gagal menghubungi penyimpanan" });
        }
      } else {
        // Coba simpan sementara atau verifikasi
        setTestResult({
          ok: true,
          message: "Form tervalidasi. Klik 'Simpan & Sambungkan' untuk memverifikasi koneksi fisik secara langsung.",
        });
      }
    } catch (e) {
      setTestResult({ ok: false, message: (e as Error).message });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast("Nama penyimpanan wajib diisi", "danger");
      return;
    }

    setSaving(true);
    const config: Record<string, any> = {};
    const credentials: Record<string, any> = {};

    if (type === "S3") {
      if (!bucket.trim()) {
        toast("Nama bucket wajib diisi", "danger");
        setSaving(false);
        return;
      }
      config.endpoint = endpoint.trim() || undefined;
      config.bucket = bucket.trim();
      config.region = region.trim() || "auto";
      config.prefix = prefix.trim() || undefined;

      if (accessKeyId.trim() && secretAccessKey.trim()) {
        credentials.accessKeyId = accessKeyId.trim();
        credentials.secretAccessKey = secretAccessKey.trim();
      }
    } else if (type === "NAS_MOUNT") {
      if (!mountPath.trim()) {
        toast("Mount path folder NAS wajib diisi", "danger");
        setSaving(false);
        return;
      }
      config.mountPath = mountPath.trim();
    } else if (type === "WEBDAV") {
      if (!webdavUrl.trim()) {
        toast("URL WebDAV wajib diisi", "danger");
        setSaving(false);
        return;
      }
      config.url = webdavUrl.trim();
      config.prefix = prefix.trim() || undefined;
      if (webdavUsername.trim() && webdavPassword.trim()) {
        credentials.username = webdavUsername.trim();
        credentials.password = webdavPassword.trim();
      }
    }

    try {
      if (providerToEdit) {
        await api.patch(`/file-management/providers/${providerToEdit.id}`, {
          name: name.trim(),
          config,
          ...(Object.keys(credentials).length > 0 ? { credentials } : {}),
          isDefault,
        });
        toast("Konfigurasi penyimpanan berhasil diperbarui.", "success");
      } else {
        await api.post("/file-management/providers", {
          name: name.trim(),
          type,
          config,
          credentials,
          isDefault,
        });
        toast(`Penyimpanan eksternal '${name}' berhasil disambungkan!`, "success");
      }
      onSuccess();
      onClose();
    } catch (e) {
      toast((e as Error).message, "danger");
      setTestResult({ ok: false, message: (e as Error).message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 items-center justify-center bg-black/60 p-4">
        <View className="max-h-[90vh] w-full max-w-xl rounded-2xl border border-border bg-card p-6 shadow-2xl">
          {/* Header */}
          <View className="mb-4 flex-row items-center justify-between border-b border-border pb-3">
            <View className="flex-row items-center gap-2.5">
              <View className="rounded-xl p-2" style={{ backgroundColor: `${colors.primary}1A` }}>
                <HardDrive size={20} color={colors.primary} />
              </View>
              <View>
                <Text className="text-base font-bold text-foreground">
                  {providerToEdit ? "Edit Penyimpanan" : "Sambungkan Penyimpanan Eksternal"}
                </Text>
                <Text className="text-xs text-muted-foreground">
                  Hubungkan S3, MinIO, Cloudflare R2, atau NAS kantor Anda
                </Text>
              </View>
            </View>
            <Pressable onPress={onClose} className="rounded-lg p-1 text-muted-foreground hover:bg-muted">
              <X size={18} />
            </Pressable>
          </View>

          <ScrollView className="space-y-4" showsVerticalScrollIndicator={false}>
            {/* Tipe Storage */}
            {!providerToEdit ? (
              <View className="gap-1.5">
                <Text className="text-xs font-semibold text-foreground">Pilih Tipe Penyimpanan</Text>
                <View className="flex-row gap-2">
                  <Pressable
                    onPress={() => setType("S3")}
                    className="flex-1 items-center gap-1.5 rounded-xl border p-3"
                    style={{
                      borderColor: type === "S3" ? colors.primary : "transparent",
                      backgroundColor: type === "S3" ? `${colors.primary}12` : "rgba(0,0,0,0.03)",
                    }}
                  >
                    <Cloud size={20} color={type === "S3" ? colors.primary : "#64748B"} />
                    <Text
                      className="text-xs font-bold"
                      style={{ color: type === "S3" ? colors.primary : undefined }}
                    >
                      S3 / MinIO
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => setType("NAS_MOUNT")}
                    className="flex-1 items-center gap-1.5 rounded-xl border p-3"
                    style={{
                      borderColor: type === "NAS_MOUNT" ? colors.primary : "transparent",
                      backgroundColor: type === "NAS_MOUNT" ? `${colors.primary}12` : "rgba(0,0,0,0.03)",
                    }}
                  >
                    <Server size={20} color={type === "NAS_MOUNT" ? colors.primary : "#64748B"} />
                    <Text
                      className="text-xs font-bold"
                      style={{ color: type === "NAS_MOUNT" ? colors.primary : undefined }}
                    >
                      NAS Mount
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => setType("WEBDAV")}
                    className="flex-1 items-center gap-1.5 rounded-xl border p-3"
                    style={{
                      borderColor: type === "WEBDAV" ? colors.primary : "transparent",
                      backgroundColor: type === "WEBDAV" ? `${colors.primary}12` : "rgba(0,0,0,0.03)",
                    }}
                  >
                    <FolderSync size={20} color={type === "WEBDAV" ? colors.primary : "#64748B"} />
                    <Text
                      className="text-xs font-bold"
                      style={{ color: type === "WEBDAV" ? colors.primary : undefined }}
                    >
                      WebDAV NAS
                    </Text>
                  </Pressable>
                </View>
              </View>
            ) : null}

            {/* Nama Provider */}
            <View className="gap-1">
              <Text className="text-xs font-semibold text-foreground">Nama Label Penyimpanan</Text>
              <Input
                placeholder="Contoh: MinIO On-Premise, S3 Archive, atau Synology NAS"
                value={name}
                onChangeText={setName}
              />
            </View>

            {/* Form spesifik S3 */}
            {type === "S3" ? (
              <View className="gap-3 rounded-xl border border-border/80 bg-muted/20 p-3.5">
                <View className="gap-1">
                  <Text className="text-xs font-medium text-foreground">Endpoint URL (Kosongkan bila AWS S3 Resmi)</Text>
                  <Input
                    placeholder="https://minio.kantor.com:9000 atau https://<id>.r2.cloudflarestorage.com"
                    value={endpoint}
                    onChangeText={setEndpoint}
                    autoCapitalize="none"
                  />
                </View>

                <View className="flex-row gap-2">
                  <View className="flex-1 gap-1">
                    <Text className="text-xs font-medium text-foreground">Nama Bucket *</Text>
                    <Input
                      placeholder="akuntra-files"
                      value={bucket}
                      onChangeText={setBucket}
                      autoCapitalize="none"
                    />
                  </View>
                  <View className="w-1/3 gap-1">
                    <Text className="text-xs font-medium text-foreground">Region</Text>
                    <Input
                      placeholder="auto / us-east-1"
                      value={region}
                      onChangeText={setRegion}
                      autoCapitalize="none"
                    />
                  </View>
                </View>

                <View className="gap-1">
                  <Text className="text-xs font-medium text-foreground">Subfolder / Prefix (Opsional)</Text>
                  <Input
                    placeholder="Contoh: erp-uploads"
                    value={prefix}
                    onChangeText={setPrefix}
                    autoCapitalize="none"
                  />
                </View>

                <View className="gap-1">
                  <Text className="text-xs font-medium text-foreground">
                    Access Key ID {providerToEdit ? "(Kosongkan jika tidak diubah)" : "*"}
                  </Text>
                  <Input
                    placeholder="Kunci Akses S3"
                    value={accessKeyId}
                    onChangeText={setAccessKeyId}
                    autoCapitalize="none"
                  />
                </View>

                <View className="gap-1">
                  <Text className="text-xs font-medium text-foreground">
                    Secret Access Key {providerToEdit ? "(Kosongkan jika tidak diubah)" : "*"}
                  </Text>
                  <Input
                    placeholder="Secret Key S3"
                    value={secretAccessKey}
                    onChangeText={setSecretAccessKey}
                    secureTextEntry
                    autoCapitalize="none"
                  />
                </View>
              </View>
            ) : null}

            {/* Form spesifik NAS Mount */}
            {type === "NAS_MOUNT" ? (
              <View className="gap-3 rounded-xl border border-border/80 bg-muted/20 p-3.5">
                <View className="gap-1">
                  <Text className="text-xs font-medium text-foreground">Mount Path Folder di Server *</Text>
                  <Input
                    placeholder="/mnt/nas_akuntra atau /Volumes/SharedStorage"
                    value={mountPath}
                    onChangeText={setMountPath}
                    autoCapitalize="none"
                  />
                  <Text className="text-[11px] text-muted-foreground">
                    Path filesystem absolut tempat folder share SMB/NFS di-mount pada host server Akuntra.
                  </Text>
                </View>
              </View>
            ) : null}

            {/* Form spesifik WebDAV */}
            {type === "WEBDAV" ? (
              <View className="gap-3 rounded-xl border border-border/80 bg-muted/20 p-3.5">
                <View className="gap-1">
                  <Text className="text-xs font-medium text-foreground">URL WebDAV NAS *</Text>
                  <Input
                    placeholder="https://nas.kantor.com:5006/files"
                    value={webdavUrl}
                    onChangeText={setWebdavUrl}
                    autoCapitalize="none"
                  />
                </View>

                <View className="flex-row gap-2">
                  <View className="flex-1 gap-1">
                    <Text className="text-xs font-medium text-foreground">Username NAS</Text>
                    <Input
                      placeholder="admin_nas"
                      value={webdavUsername}
                      onChangeText={setWebdavUsername}
                      autoCapitalize="none"
                    />
                  </View>
                  <View className="flex-1 gap-1">
                    <Text className="text-xs font-medium text-foreground">Password NAS</Text>
                    <Input
                      placeholder="••••••••"
                      value={webdavPassword}
                      onChangeText={setWebdavPassword}
                      secureTextEntry
                    />
                  </View>
                </View>
              </View>
            ) : null}

            {/* Opsi Jadikan Default */}
            <Pressable
              onPress={() => setIsDefault(!isDefault)}
              className="flex-row items-center gap-2.5 rounded-xl border border-border p-3"
            >
              <View
                className="h-4 w-4 rounded border items-center justify-center"
                style={{
                  backgroundColor: isDefault ? colors.primary : "transparent",
                  borderColor: isDefault ? colors.primary : "#94A3B8",
                }}
              >
                {isDefault ? <CheckCircle2 size={12} color="#FFF" /> : null}
              </View>
              <View className="flex-1">
                <Text className="text-xs font-semibold text-foreground">Jadikan Default Penyimpanan Baru</Text>
                <Text className="text-[11px] text-muted-foreground">
                  Seluruh unggahan file baru selanjutnya akan langsung disimpan ke storage ini.
                </Text>
              </View>
            </Pressable>

            {/* Hasil Uji Koneksi */}
            {testResult ? (
              <View
                className="flex-row items-start gap-2 rounded-xl border p-3"
                style={{
                  backgroundColor: testResult.ok ? "#10B98114" : "#EF444414",
                  borderColor: testResult.ok ? "#10B98133" : "#EF444433",
                }}
              >
                {testResult.ok ? (
                  <CheckCircle2 size={16} color="#10B981" />
                ) : (
                  <AlertTriangle size={16} color="#EF4444" />
                )}
                <Text
                  className="flex-1 text-xs"
                  style={{ color: testResult.ok ? "#065F46" : "#991B1B" }}
                >
                  {testResult.message}
                </Text>
              </View>
            ) : null}
          </ScrollView>

          {/* Footer Buttons */}
          <View className="mt-4 flex-row items-center justify-between border-t border-border pt-3">
            <Button
              variant="outline"
              size="sm"
              onPress={handleTestConnection}
              disabled={testing || saving}
            >
              {testing ? <ActivityIndicator size="small" /> : <Text>Uji Koneksi</Text>}
            </Button>

            <View className="flex-row gap-2">
              <Button variant="ghost" size="sm" onPress={onClose} disabled={saving}>
                <Text>Batal</Text>
              </Button>
              <Button
                size="sm"
                onPress={handleSave}
                disabled={saving}
                style={{ backgroundColor: colors.primary }}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text className="text-white font-semibold">Simpan & Sambungkan</Text>
                )}
              </Button>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}
