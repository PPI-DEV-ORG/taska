import { useLocalSearchParams } from "expo-router";
import { ModuleIndexScreen } from "@/screens/module-index";

export default function ModuleIndex() {
  const { module } = useLocalSearchParams<{ module: string }>();
  return <ModuleIndexScreen moduleKey={module} />;
}
