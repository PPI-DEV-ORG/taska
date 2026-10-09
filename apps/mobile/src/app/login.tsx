import * as React from "react";
import { Image, Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { FormField } from "@/components/taska/basics";
import { useApp } from "@/store/app-store";
import { ROLE_LABEL, USERS, type Role } from "@/mock/data";
import { cn } from "@/lib/utils";

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useApp();
  const [role, setRole] = React.useState<Role>("bos");
  const user = USERS.find((u) => u.role === role)!;

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
            <FormField label="Email"><Input value={user.email} editable={false} className="h-11 sm:h-11" /></FormField>
            <FormField label="Kata sandi"><Input value="demo-taska" secureTextEntry editable={false} className="h-11 sm:h-11" /></FormField>

            <View className="gap-2">
              <Text className="text-sm font-medium">Masuk sebagai (hanya untuk demo)</Text>
              <View className="flex-row flex-wrap gap-2">
                {USERS.map((u) => (
                  <Pressable
                    key={u.id}
                    onPress={() => setRole(u.role)}
                    className={cn("min-h-[52px] w-[48.5%] justify-center rounded-lg border px-3 py-2", role === u.role ? "border-primary bg-primary/15" : "border-border bg-panel/40")}
                  >
                    <Text className={cn("text-sm font-medium", role === u.role && "text-primary")}>{ROLE_LABEL[u.role]}</Text>
                    <Text className="text-muted-foreground text-[13px]" numberOfLines={1}>{u.name}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <Button size="lg" onPress={() => { login(role); router.replace("/dashboard"); }}>
              <Text>Masuk</Text>
            </Button>
          </View>
          <Text className="text-muted-foreground text-center text-[13px]">Prototype tampilan. Data hanya tiruan dan tersimpan di memori.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
