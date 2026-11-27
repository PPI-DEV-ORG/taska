import * as React from "react";
import { Platform, Pressable, Text, View } from "react-native";

type State = {
  hasError: boolean;
  message: string;
};

export class AppErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { hasError: false, message: "" };

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      message: error?.message || "Terjadi kesalahan tak terduga pada aplikasi.",
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[AppErrorBoundary]", error, info?.componentStack);
  }

  private handleReload = () => {
    this.setState({ hasError: false, message: "" });
    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.location.reload();
    }
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <View className="flex-1 items-center justify-center bg-background p-6">
        <View className="w-full max-w-md rounded-2xl border border-border bg-card p-6 gap-3">
          <Text className="text-lg font-bold text-foreground">Terjadi Kesalahan Tampilan</Text>
          <Text className="text-sm text-muted-foreground">
            Aplikasi mengalami gangguan saat menampilkan halaman ini. Data Anda tetap aman.
          </Text>
          {this.state.message ? (
            <View className="rounded-lg bg-muted p-3">
              <Text className="text-xs text-muted-foreground" numberOfLines={4}>
                {this.state.message}
              </Text>
            </View>
          ) : null}
          <Pressable
            onPress={this.handleReload}
            className="mt-2 items-center justify-center rounded-xl bg-primary py-3 px-4"
          >
            <Text className="text-sm font-semibold text-primary-foreground">Muat Ulang Aplikasi</Text>
          </Pressable>
        </View>
      </View>
    );
  }
}
