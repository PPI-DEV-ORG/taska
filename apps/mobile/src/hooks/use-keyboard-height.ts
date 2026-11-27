import * as React from "react";
import { Keyboard, Platform, type LayoutChangeEvent } from "react-native";

/**
 * Melacak tinggi soft keyboard di iOS/Android secara real-time (selalu 0 di Web).
 */
export function useKeyboardHeight(): number {
  const [height, setHeight] = React.useState(0);

  React.useEffect(() => {
    if (Platform.OS === "web") return;
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSub = Keyboard.addListener(showEvent, (e) => {
      setHeight(Math.max(0, Math.round(e.endCoordinates?.height ?? 0)));
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  return height;
}

/**
 * Menghitung offset bawah yang aman di Android edge-to-edge (keyboard overlay)
 * maupun Android adjustResize (container sudah menyusut) tanpa double offset.
 */
export function useKeyboardContainerOffset() {
  const keyboardHeight = useKeyboardHeight();
  const [containerHeight, setContainerHeight] = React.useState(0);
  const [maxHeight, setMaxHeight] = React.useState(0);

  const onContainerLayout = React.useCallback(
    (e: LayoutChangeEvent) => {
      if (Platform.OS === "web") return;
      const h = Math.round(e.nativeEvent.layout.height);
      if (h <= 0) return;
      setContainerHeight(h);
      setMaxHeight((prev) => (keyboardHeight === 0 ? h : Math.max(prev, h)));
    },
    [keyboardHeight],
  );

  const shrunk =
    keyboardHeight > 0 && containerHeight > 0 && maxHeight > 0
      ? Math.max(0, maxHeight - containerHeight)
      : 0;
  const effectiveOffset = keyboardHeight > 0 ? Math.max(0, keyboardHeight - shrunk) : 0;

  return {
    keyboardHeight,
    effectiveOffset,
    containerHeight,
    onContainerLayout,
  };
}
