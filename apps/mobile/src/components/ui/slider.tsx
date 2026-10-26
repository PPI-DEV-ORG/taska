import * as React from "react";
import { Platform, View, PanResponder } from "react-native";
import { cn } from "@/lib/utils";

export interface SliderProps {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange?: (val: number) => void;
  onValueCommit?: (val: number) => void;
  disabled?: boolean;
  className?: string;
}

export function Slider({
  value,
  min = 0,
  max = 100,
  step = 1,
  onChange,
  onValueCommit,
  disabled = false,
  className,
}: SliderProps) {
  const [prevValue, setPrevValue] = React.useState(value);
  const [internalValue, setInternalValue] = React.useState(value);
  const [isDragging, setIsDragging] = React.useState(false);
  const [trackWidth, setTrackWidth] = React.useState(1);

  if (!isDragging && prevValue !== value) {
    setPrevValue(value);
    setInternalValue(value);
  }

  const clamped = Math.min(max, Math.max(min, internalValue));
  const percent = max > min ? ((clamped - min) / (max - min)) * 100 : 0;

  const updateFromNativePos = React.useCallback(
    (x: number, isCommit = false) => {
      if (trackWidth <= 0) return;
      const ratio = Math.max(0, Math.min(1, x / trackWidth));
      const rawVal = min + ratio * (max - min);
      const stepped = Math.round(rawVal / step) * step;
      const finalVal = Math.min(max, Math.max(min, stepped));
      setInternalValue(finalVal);
      onChange?.(finalVal);
      if (isCommit) {
        onValueCommit?.(finalVal);
      }
    },
    [trackWidth, min, max, step, onChange, onValueCommit]
  );

  const panResponder = React.useMemo(() => {
    if (Platform.OS === "web") return null;
    return PanResponder.create({
      onStartShouldSetPanResponder: () => !disabled,
      onMoveShouldSetPanResponder: () => !disabled,
      onPanResponderGrant: (evt) => {
        setIsDragging(true);
        updateFromNativePos(evt.nativeEvent.locationX);
      },
      onPanResponderMove: (evt) => {
        updateFromNativePos(evt.nativeEvent.locationX);
      },
      onPanResponderRelease: (evt) => {
        setIsDragging(false);
        updateFromNativePos(evt.nativeEvent.locationX, true);
      },
      onPanResponderTerminate: () => {
        setIsDragging(false);
      },
    });
  }, [disabled, updateFromNativePos]);

  if (Platform.OS === "web") {
    return (
      <View className={cn("relative flex-1 h-9 justify-center select-none py-1", className)}>
        {/* Track Background */}
        <View className="h-2.5 w-full rounded-full bg-secondary/80 overflow-hidden border border-border/40">
          {/* Active Fill */}
          <View
            className="h-full bg-primary rounded-full transition-all duration-75"
            style={{ width: `${percent}%` }}
          />
        </View>

        {/* Handle / Thumb */}
        <View
          pointerEvents="none"
          className={cn(
            "absolute top-1/2 -translate-y-1/2 size-5 rounded-full bg-background border-2 border-primary shadow-sm items-center justify-center transition-transform",
            isDragging && "scale-125 border-primary shadow-md ring-2 ring-primary/30"
          )}
          style={{
            left: `${percent}%`,
            marginLeft: -10,
          }}
        >
          <View className="size-1.5 rounded-full bg-primary" />
        </View>

        {/* Native HTML range input overlay for accessible, frictionless web drag */}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={clamped}
          disabled={disabled}
          onChange={(e) => {
            const nextVal = Number(e.target.value);
            setInternalValue(nextVal);
            onChange?.(nextVal);
          }}
          onMouseDown={() => setIsDragging(true)}
          onTouchStart={() => setIsDragging(true)}
          onMouseUp={(e) => {
            setIsDragging(false);
            const finalVal = Number((e.target as HTMLInputElement).value);
            onValueCommit?.(finalVal);
          }}
          onTouchEnd={(e) => {
            setIsDragging(false);
            const finalVal = Number((e.target as HTMLInputElement).value);
            onValueCommit?.(finalVal);
          }}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            opacity: 0,
            cursor: disabled ? "not-allowed" : "pointer",
            margin: 0,
            padding: 0,
            zIndex: 10,
          }}
        />
      </View>
    );
  }

  // Native Implementation (iOS / Android)
  return (
    <View
      onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
      {...(panResponder?.panHandlers ?? {})}
      className={cn("relative flex-1 h-9 justify-center py-1", className)}
    >
      <View className="h-2.5 w-full rounded-full bg-secondary/80 overflow-hidden border border-border/40">
        <View
          className="h-full bg-primary rounded-full"
          style={{ width: `${percent}%` }}
        />
      </View>

      <View
        pointerEvents="none"
        className={cn(
          "absolute top-1/2 -translate-y-1/2 size-5 rounded-full bg-background border-2 border-primary shadow-sm items-center justify-center",
          isDragging && "scale-125 border-primary shadow-md"
        )}
        style={{
          left: `${percent}%`,
          marginLeft: -10,
        }}
      >
        <View className="size-1.5 rounded-full bg-primary" />
      </View>
    </View>
  );
}
