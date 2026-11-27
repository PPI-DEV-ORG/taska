import { Icon } from "@/components/ui/icon";
import { NativeOnlyAnimatedView } from "@/components/ui/native-only-animated-view";
import { useKeyboardContainerOffset } from "@/hooks/use-keyboard-height";
import { cn } from "@/lib/utils";
import * as DialogPrimitive from "@rn-primitives/dialog";
import { Maximize2, Minimize2, X } from "lucide-react-native";
import * as React from "react";
import {
  PanResponder,
  Platform,
  Pressable,
  StatusBar,
  Text,
  useWindowDimensions,
  View,
  type GestureResponderEvent,
  type ViewProps,
} from "react-native";
import {
  FadeIn,
  FadeOut,
  ReduceMotion,
  SlideInDown,
  SlideOutDown,
} from "react-native-reanimated";
import { SafeAreaInsetsContext } from "react-native-safe-area-context";
import { FullWindowOverlay as RNFullWindowOverlay } from "react-native-screens";

const MOBILE_DRAWER_BREAKPOINT = 640;

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;
const FullWindowOverlay =
  Platform.OS === "ios" ? RNFullWindowOverlay : React.Fragment;

function DialogOverlay({
  className,
  children,
  onPress,
  isDrawer = false,
  keyboardOffset = 0,
  onContainerLayout,
  ...props
}: Omit<React.ComponentProps<typeof DialogPrimitive.Overlay>, "asChild"> & {
  children?: React.ReactNode;
  isDrawer?: boolean;
  keyboardOffset?: number;
  onContainerLayout?: ViewProps["onLayout"];
}) {
  const { onOpenChange } = DialogPrimitive.useRootContext();
  function onOverlayPress(event: GestureResponderEvent) {
    onPress?.(event);
    if (event.target === event.currentTarget && !event.isDefaultPrevented()) {
      onOpenChange(false);
    }
  }
  return (
    <FullWindowOverlay>
      <View
        onLayout={onContainerLayout}
        style={keyboardOffset > 0 ? { paddingBottom: keyboardOffset } : undefined}
        className={cn(
          "absolute bottom-0 left-0 right-0 top-0 z-50 flex",
          isDrawer
            ? "items-stretch justify-end p-0"
            : "items-center justify-center p-4 sm:p-6",
          Platform.select({
            web: "fixed",
          }),
        )}
        pointerEvents="box-none"
      >
        {/* Backdrop terpisah (sibling) agar Pressable overlay tidak membungkus ScrollView di dalam modal */}
        <DialogPrimitive.Overlay
          className={cn(
            "absolute bottom-0 left-0 right-0 top-0 bg-black/50",
            Platform.select({
              web: "animate-in fade-in-0 cursor-default",
            }),
            className,
          )}
          {...props}
          onPress={Platform.select({ web: onOverlayPress, native: onPress })}
          asChild={Platform.OS !== "web"}
        >
          <NativeOnlyAnimatedView
            entering={FadeIn.duration(200).reduceMotion(ReduceMotion.System)}
            exiting={FadeOut.duration(150).reduceMotion(ReduceMotion.System)}
            className="absolute bottom-0 left-0 right-0 top-0 bg-black/50"
            as="Pressable"
          />
        </DialogPrimitive.Overlay>

        <NativeOnlyAnimatedView
          entering={
            isDrawer
              ? SlideInDown.duration(220).reduceMotion(ReduceMotion.System)
              : FadeIn.delay(50).reduceMotion(ReduceMotion.System)
          }
          exiting={
            isDrawer
              ? SlideOutDown.duration(180).reduceMotion(ReduceMotion.System)
              : FadeOut.duration(150).reduceMotion(ReduceMotion.System)
          }
          className={cn(
            "z-10 w-full",
            isDrawer
              ? "items-stretch justify-end"
              : "items-center justify-center",
          )}
          pointerEvents="box-none"
        >
          <>{children}</>
        </NativeOnlyAnimatedView>
      </View>
    </FullWindowOverlay>
  );
}

function DialogContent({
  className,
  portalHost,
  children,
  style,
  mobileMode = "drawer",
  initialFullScreen = false,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  portalHost?: string;
  /** "drawer" (default): bottom sheet yang bisa di-expand full screen di mobile (< 640px). "modal": tetap modal di tengah. */
  mobileMode?: "drawer" | "modal";
  initialFullScreen?: boolean;
}) {
  const { width, height } = useWindowDimensions();
  const { keyboardHeight, effectiveOffset, containerHeight, onContainerLayout } =
    useKeyboardContainerOffset();
  const safeInsets = React.useContext(SafeAreaInsetsContext) ?? {
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  };
  const { open, onOpenChange } = DialogPrimitive.useRootContext();

  const isMobile = width < MOBILE_DRAWER_BREAKPOINT;
  const isDrawer = isMobile && mobileMode !== "modal";

  const [prevOpen, setPrevOpen] = React.useState(open);
  const [isExpanded, setIsExpanded] = React.useState(initialFullScreen);
  const [dragOffset, setDragOffset] = React.useState(0);
  const [isDragging, setIsDragging] = React.useState(false);

  if (open !== prevOpen) {
    setPrevOpen(open);
    if (!open) {
      setIsExpanded(initialFullScreen);
      setDragOffset(0);
      setIsDragging(false);
    }
  }

  const panResponder = React.useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_evt, gs) =>
          Math.abs(gs.dy) > 6 && Math.abs(gs.dy) > Math.abs(gs.dx),
        onPanResponderGrant: () => {
          setIsDragging(true);
        },
        onPanResponderMove: (_evt, gs) => {
          if (isExpanded) {
            setDragOffset(Math.max(0, gs.dy));
          } else {
            // Tarik ke atas (dy < 0) beri feedback sedikit terangkat, tarik ke bawah (dy > 0) ikuti jari
            setDragOffset(Math.max(-96, gs.dy));
          }
        },
        onPanResponderRelease: (_evt, gs) => {
          setIsDragging(false);
          setDragOffset(0);
          if (!isExpanded) {
            if (gs.dy < -45 || gs.vy < -0.45) {
              setIsExpanded(true);
            } else if (gs.dy > 90 || gs.vy > 0.7) {
              onOpenChange(false);
            }
          } else {
            if (gs.dy > 180 || gs.vy > 1.1) {
              onOpenChange(false);
            } else if (gs.dy > 45 || gs.vy > 0.4) {
              setIsExpanded(false);
            }
          }
        },
        onPanResponderTerminate: () => {
          setIsDragging(false);
          setDragOffset(0);
        },
      }),
    [isExpanded, onOpenChange],
  );

  const drawerStyle = React.useMemo(() => {
    if (!isDrawer) return undefined;

    const fallbackTop =
      Platform.OS === "android"
        ? (StatusBar.currentHeight ?? 28)
        : Platform.OS === "ios"
          ? 44
          : 8;
    const topPadding = isExpanded ? Math.max(safeInsets.top, fallbackTop) : 0;
    const bottomPadding = keyboardHeight > 0 ? 12 : Math.max(safeInsets.bottom, 16);

    const base: Record<string, any> = {
      width: "100%",
      maxWidth: "100%",
      marginHorizontal: 0,
      marginVertical: 0,
      borderBottomLeftRadius: 0,
      borderBottomRightRadius: 0,
      borderTopLeftRadius: isExpanded ? 0 : 20,
      borderTopRightRadius: isExpanded ? 0 : 20,
      borderBottomWidth: 0,
      borderLeftWidth: 0,
      borderRightWidth: 0,
      borderTopWidth: isExpanded ? 0 : 1,
      paddingTop: topPadding,
      paddingBottom: bottomPadding,
    };

    if (Platform.OS === "web") {
      if (isExpanded) {
        base.height = "100dvh";
        base.minHeight = "100dvh";
        base.maxHeight = "100dvh";
      } else {
        base.height = undefined;
        base.minHeight = "55dvh";
        base.maxHeight = "88dvh";
      }
      base.transition = isDragging
        ? "none"
        : "height 200ms ease, max-height 200ms ease, border-radius 200ms ease, transform 180ms ease";
    } else {
      // Di React Native (Yoga), child ScrollView dengan flex: 1 akan collapse ke 0px jika parent tidak punya height eksplisit.
      const visibleHeight = Math.max(260, (containerHeight || height) - effectiveOffset);
      const topGuard = Math.max(safeInsets.top, fallbackTop) + 8;
      if (keyboardHeight > 0) {
        const maxKbHeight = Math.max(240, visibleHeight - topGuard);
        const target = isExpanded ? maxKbHeight : Math.min(Math.round(height * 0.82), maxKbHeight);
        base.height = target;
        base.maxHeight = maxKbHeight;
      } else if (isExpanded) {
        base.height = height;
        base.maxHeight = height;
      } else {
        const defaultHeight = Math.round(height * 0.82);
        base.height = defaultHeight;
        base.maxHeight = Math.round(height * 0.88);
      }
    }

    if (dragOffset !== 0) {
      base.transform = [{ translateY: dragOffset }];
    }

    return base;
  }, [
    isDrawer,
    isExpanded,
    isDragging,
    dragOffset,
    height,
    containerHeight,
    keyboardHeight,
    effectiveOffset,
    safeInsets.top,
    safeInsets.bottom,
  ]);

  const modalKeyboardStyle = React.useMemo(() => {
    if (isDrawer || Platform.OS === "web" || keyboardHeight <= 0) return undefined;
    const visibleHeight = Math.max(240, (containerHeight || height) - effectiveOffset - 32);
    return { maxHeight: visibleHeight };
  }, [isDrawer, keyboardHeight, containerHeight, height, effectiveOffset]);

  return (
    <DialogPortal hostName={portalHost}>
      <DialogOverlay
        isDrawer={isDrawer}
        keyboardOffset={effectiveOffset}
        onContainerLayout={onContainerLayout}
      >
        <DialogPrimitive.Content
          className={cn(
            "bg-background border-border z-50 mx-auto flex w-[92vw] max-w-[calc(100%-2rem)] max-h-[88vh] flex-col gap-4 rounded-2xl border p-5 sm:p-6 shadow-2xl shadow-black/40 sm:w-[560px] md:w-[680px] lg:w-[760px]",
            Platform.select({
              web: isDrawer
                ? "animate-in fade-in-0 slide-in-from-bottom-6 duration-200 overflow-y-auto"
                : "animate-in fade-in-0 zoom-in-95 duration-200 overflow-y-auto",
            }),
            className,
          )}
          style={[
            !isDrawer
              ? Platform.select({
                  web: {
                    width:
                      className?.includes("max-w-") || className?.includes("w-")
                        ? undefined
                        : "clamp(340px, 90vw, 760px)",
                  } as any,
                })
              : undefined,
            style,
            drawerStyle,
            modalKeyboardStyle,
          ]}
          {...props}
        >
          {isDrawer ? (
            <View
              {...panResponder.panHandlers}
              className="flex-row items-center justify-between pt-2 pb-1 -mt-1 select-none"
              style={Platform.OS === "web" ? ({ touchAction: "none" } as any) : undefined}
            >
              <View className="w-16" />
              <Pressable
                onPress={() => setIsExpanded((v) => !v)}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel={isExpanded ? "Perkecil drawer" : "Perbesar layar penuh"}
                className="flex-1 items-center justify-center py-2"
              >
                <View className="h-1.5 w-11 rounded-full bg-muted-foreground/35" />
              </Pressable>
              <View className="w-16 flex-row items-center justify-end gap-1">
                <Pressable
                  onPress={() => setIsExpanded((v) => !v)}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel={isExpanded ? "Perkecil drawer" : "Layar penuh"}
                  className="rounded-lg p-1.5 opacity-75 active:opacity-100 hover:bg-muted/40"
                >
                  <Icon
                    as={isExpanded ? Minimize2 : Maximize2}
                    className="text-muted-foreground size-4 shrink-0"
                  />
                </Pressable>
                <DialogPrimitive.Close
                  className="rounded-lg p-1.5 opacity-75 active:opacity-100 hover:bg-muted/40"
                  hitSlop={10}
                >
                  <Icon
                    as={X}
                    className="text-accent-foreground web:pointer-events-none size-4 shrink-0"
                  />
                  <Text className="sr-only">Close</Text>
                </DialogPrimitive.Close>
              </View>
            </View>
          ) : null}
          <>{children}</>
          {!isDrawer ? (
            <DialogPrimitive.Close
              className={cn(
                "absolute right-4 top-4 rounded opacity-70 active:opacity-100",
                Platform.select({
                  web: "ring-offset-background focus:ring-ring data-[state=open]:bg-accent transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-offset-2",
                }),
              )}
              hitSlop={12}
            >
              <Icon
                as={X}
                className={cn(
                  "text-accent-foreground web:pointer-events-none size-4 shrink-0",
                )}
              />
              <Text className="sr-only">Close</Text>
            </DialogPrimitive.Close>
          ) : null}
        </DialogPrimitive.Content>
      </DialogOverlay>
    </DialogPortal>
  );
}

function DialogHeader({ className, ...props }: ViewProps) {
  return (
    <View
      className={cn("flex flex-col gap-2 text-center sm:text-left", className)}
      {...props}
    />
  );
}

function DialogFooter({ className, ...props }: ViewProps) {
  return (
    <View
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className,
      )}
      {...props}
    />
  );
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      className={cn(
        "text-foreground text-lg font-semibold leading-none",
        className,
      )}
      {...props}
    />
  );
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};
