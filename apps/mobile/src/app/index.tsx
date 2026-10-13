import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useApp } from "@/store/app-store";

export default function Index() {
  const { user, hydrated } = useApp();
  if (!hydrated) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#191817" }}>
        <ActivityIndicator color="#fff" />
      </View>
    );
  }
  return <Redirect href={user ? "/dashboard" : "/login"} />;
}
