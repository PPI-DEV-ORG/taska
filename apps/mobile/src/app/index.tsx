import { Redirect } from "expo-router";
import { useApp } from "@/store/app-store";

export default function Index() {
  const { user } = useApp();
  return <Redirect href={user ? "/dashboard" : "/login"} />;
}
