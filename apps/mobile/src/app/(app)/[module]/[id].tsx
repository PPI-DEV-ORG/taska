import { useLocalSearchParams } from "expo-router";
import { ModuleDetail } from "@/screens/module-detail";

export default function ModuleDetailRoute() {
  const { module, id } = useLocalSearchParams<{ module: string; id: string }>();
  return <ModuleDetail moduleKey={module as string} id={id as string} />;
}
