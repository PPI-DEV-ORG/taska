import * as React from "react";
import { Image, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { FormField } from "@/components/taska/basics";
import { useApp } from "@/store/app-store";

export default function LoginScreen() {
  const router = useRouter();
  const { login, toast } = useApp();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function onSubmit() {
    if (!email.trim() || !password) {
      toast("Email dan kata sandi wajib diisi", "danger");
      return;
    }
    setBusy(true);
    try {
      await login(email.trim(), password);
      router.replace("/dashboard");
    } catch (e: any) {
      toast(e?.message ?? "Login gagal. Periksa email dan kata sandi.", "danger");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView className="bg-background flex-1">
      <ScrollView contentContainerClassName="flex-grow items-center justify-center p-4 py-10">
        <View className="w-full max-w-[460px] gap-6">
          <View className="items-center gap-3">
            <Image
              source={require("../../assets/taska-logo.png")}
              style={{ width: 64, height: 64 }}
              resizeMode="contain"
            />
            <Text className="text-3xl font-semibold tracking-tight">Taska</Text>
            <Text className="text-text-secondary text-center text-sm">Satu tempat untuk lead, project, barang, dan pengeluaran kantor.</Text>
          </View>

          <View className="bg-card border-border gap-4 rounded-xl border p-5">
            <FormField label="Email" required>
              <Input
                value={email}
                onChangeText={setEmail}
                placeholder="nama@taska.co.id"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                className="h-11 sm:h-11"
              />
            </FormField>
            <FormField label="Kata sandi" required>
              <Input
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholder="Masukkan kata sandi"
                className="h-11 sm:h-11"
              />
            </FormField>

            <Button size="lg" disabled={busy} onPress={onSubmit}>
              <Text>{busy ? "Masuk..." : "Masuk"}</Text>
            </Button>
          </View>
          <Text className="text-muted-foreground text-center text-[13px]">Masuk dengan akun yang diberikan admin.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
